import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { chromium } from "playwright";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const FACEBOOK_URL = process.env.FACEBOOK_PUBLIC_URL ||
  "https://www.facebook.com/people/Le-Cercle-des-Joueurs-Paresseux/61553506266229/";
const DATA_FILE = path.join(ROOT, "data", "facebook-posts.json");
const ASSET_DIR = path.join(ROOT, "assets", "actualites");
const MAX_POSTS = Number(process.env.FACEBOOK_MAX_POSTS || 12);

fs.mkdirSync(ASSET_DIR, { recursive: true });

const existing = fs.existsSync(DATA_FILE)
  ? JSON.parse(fs.readFileSync(DATA_FILE, "utf8"))
  : { source: FACEBOOK_URL, updated_at: null, posts: [] };

const clean = value => String(value || "")
  .replace(/\u00a0/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const sha = value =>
  crypto.createHash("sha1").update(String(value)).digest("hex").slice(0, 16);

function normalizePostUrl(value = "") {
  if (!value) return "";

  try {
    const url = new URL(value);
    const kept = new URLSearchParams();

    for (const key of ["story_fbid", "id", "fbid", "set", "v"]) {
      if (url.searchParams.has(key)) kept.set(key, url.searchParams.get(key));
    }

    url.search = kept.toString();
    url.hash = "";
    url.pathname = url.pathname.replace(/\/+$/, "");

    return url.toString().replace(/\/$/, "");
  } catch {
    return String(value)
      .split("#")[0]
      .replace(/([?&])(ref|__cft__|__tn__|mibextid)=[^&]*/gi, "")
      .replace(/[?&]+$/, "")
      .replace(/\/+$/, "");
  }
}

function removeFacebookInterfaceText(value = "") {
  return clean(value)
    .replace(/\b(J’aime|Commenter|Partager|Like|Comment|Share)\b/gi, " ")
    .replace(/\b\d+\s+(commentaire|commentaires|partage|partages|réaction|réactions)\b/gi, " ")
    .replace(/\b(Écrire un commentaire|Voir plus|Afficher plus|Tous les commentaires)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fingerprint(value = "") {
  return removeFacebookInterfaceText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .slice(0, 260);
}

function similarityKey(value = "") {
  const words = fingerprint(value)
    .split(" ")
    .filter(word => word.length > 2)
    .slice(0, 35);

  return [...new Set(words)].sort().join(" ");
}

function samePost(a, b) {
  if (!a || !b) return false;

  const aUrl = normalizePostUrl(a.url);
  const bUrl = normalizePostUrl(b.url);

  if (aUrl && bUrl && aUrl === bUrl) return true;
  if (a.id && b.id && a.id === b.id) return true;

  const aFingerprint = fingerprint(a.text);
  const bFingerprint = fingerprint(b.text);

  if (aFingerprint && bFingerprint && aFingerprint === bFingerprint) return true;

  const aSimilarity = similarityKey(a.text);
  const bSimilarity = similarityKey(b.text);

  return Boolean(
    aSimilarity &&
    bSimilarity &&
    (
      aSimilarity === bSimilarity ||
      aFingerprint.includes(bFingerprint) ||
      bFingerprint.includes(aFingerprint)
    )
  );
}

function mergePostVersions(current, candidate) {
  const currentText = removeFacebookInterfaceText(current?.text);
  const candidateText = removeFacebookInterfaceText(candidate?.text);

  return {
    ...(current || {}),
    ...(candidate || {}),
    id: current?.id || candidate?.id,
    text: candidateText.length > currentText.length ? candidateText : currentText,
    url: normalizePostUrl(current?.url) || normalizePostUrl(candidate?.url) || FACEBOOK_URL,
    local_image: current?.local_image || candidate?.local_image || null,
    image_url: current?.image_url || candidate?.image_url || null,
    date: (() => {
      const dates = [current?.date, candidate?.date]
        .filter(Boolean)
        .map(value => new Date(value))
        .filter(value => !Number.isNaN(value.getTime()));
      if (!dates.length) return new Date().toISOString();
      return new Date(Math.min(...dates.map(value => value.getTime()))).toISOString();
    })()
  };
}

async function downloadImage(url, id) {
  if (!url || url.startsWith("data:")) return null;

  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0",
        "referer": "https://www.facebook.com/"
      }
    });

    if (!response.ok) return null;

    const type = response.headers.get("content-type") || "";
    if (!type.startsWith("image/")) return null;

    const ext = type.includes("png")
      ? "png"
      : type.includes("webp")
        ? "webp"
        : "jpg";

    const rel = `assets/actualites/facebook-${id}.${ext}`;
    fs.writeFileSync(path.join(ROOT, rel), Buffer.from(await response.arrayBuffer()));
    return rel;
  } catch {
    return null;
  }
}

async function scrape() {
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({
      locale: "fr-FR",
      userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      viewport: { width: 1440, height: 1200 }
    });

    await page.goto(FACEBOOK_URL, {
      waitUntil: "domcontentloaded",
      timeout: 90000
    });

    await page.waitForTimeout(7000);

    for (const label of [
      "Autoriser tous les cookies",
      "Allow all cookies",
      "Fermer",
      "Close",
      "Plus tard",
      "Not now"
    ]) {
      const button = page.getByRole("button", { name: label }).first();

      if (await button.count()) {
        try {
          await button.click({ timeout: 1500 });
        } catch {}
      }
    }

    for (let i = 0; i < 4; i++) {
      await page.mouse.wheel(0, 1100);
      await page.waitForTimeout(1200);
    }

    return await page.evaluate(maxPosts => {
      const items = [];
      const candidates = [
        ...document.querySelectorAll('[role="article"]'),
        ...document.querySelectorAll("article")
      ];

      for (const node of candidates) {
        const text = (node.innerText || "").trim();
        if (!text || text.length < 20) continue;

        const links = [...node.querySelectorAll("a[href]")].map(a => a.href);
        const postUrl = links.find(href =>
          /\/posts\/|story_fbid=|permalink\.php|\/photos\/|\/videos\//i.test(href)
        ) || null;

        const timeNode = node.querySelector("time");
        const date =
          timeNode?.dateTime ||
          timeNode?.getAttribute("datetime") ||
          null;

        const images = [...node.querySelectorAll("img[src]")]
          .map(img => ({
            src: img.currentSrc || img.src,
            alt: img.alt || "",
            width: img.naturalWidth || 0,
            height: img.naturalHeight || 0
          }))
          .filter(img =>
            img.src &&
            img.width >= 250 &&
            img.height >= 180 &&
            !/emoji|profile|logo|photo de profil/i.test(img.alt)
          );

        items.push({
          text,
          url: postUrl,
          date,
          image: images[0]?.src || null
        });

        if (items.length >= maxPosts * 4) break;
      }

      return items;
    }, MAX_POSTS);
  } finally {
    await browser.close();
  }
}

let scraped = [];

try {
  scraped = await scrape();
} catch (error) {
  console.warn("Facebook n'a pas pu être lu aujourd'hui :", error.message);
}

const now = new Date();
const detected = [];

for (const item of scraped) {
  const text = removeFacebookInterfaceText(item.text);
  if (!text) continue;

  const url = normalizePostUrl(item.url);
  const prior = (existing.posts || []).find(post =>
    samePost(post, { text, url })
  );

  const id =
    prior?.id ||
    sha(url || fingerprint(text) || `${item.date || ""}|${text}`);

  let date = item.date;
  if (!date || Number.isNaN(new Date(date).getTime())) {
    date = prior?.date || now.toISOString();
  }

  const local_image =
    prior?.local_image ||
    await downloadImage(item.image, id);

  const candidate = {
    id,
    date,
    text,
    url: url || prior?.url || FACEBOOK_URL,
    image_url: item.image || prior?.image_url || null,
    local_image: local_image || null
  };

  const duplicateIndex = detected.findIndex(post =>
    samePost(post, candidate)
  );

  if (duplicateIndex === -1) {
    detected.push(candidate);
  } else {
    detected[duplicateIndex] = mergePostVersions(
      detected[duplicateIndex],
      candidate
    );
  }
}

const merged = [];

for (const candidate of [...detected, ...(existing.posts || [])]) {
  const duplicateIndex = merged.findIndex(post =>
    samePost(post, candidate)
  );

  if (duplicateIndex === -1) {
    merged.push(candidate);
  } else {
    merged[duplicateIndex] = mergePostVersions(
      merged[duplicateIndex],
      candidate
    );
  }
}

merged.sort((a, b) => new Date(b.date) - new Date(a.date));
merged.splice(120);

const output = {
  source: FACEBOOK_URL,
  updated_at: now.toISOString(),
  scrape_status: detected.length
    ? "ok"
    : "no-new-public-post-detected",
  posts: merged
};

fs.writeFileSync(
  DATA_FILE,
  JSON.stringify(output, null, 2) + "\n",
  "utf8"
);

console.log(`Publications uniques détectées aujourd'hui : ${detected.length}`);
console.log(`Publications uniques conservées : ${merged.length}`);

const build = spawnSync(
  process.execPath,
  ["scripts/build-actualites.mjs"],
  {
    cwd: ROOT,
    stdio: "inherit"
  }
);

process.exit(build.status ?? 0);
