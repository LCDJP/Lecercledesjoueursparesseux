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

const sha = value => crypto.createHash("sha1").update(value).digest("hex").slice(0, 16);

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
    const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
    const rel = `assets/actualites/facebook-${id}.${ext}`;
    fs.writeFileSync(path.join(ROOT, rel), Buffer.from(await response.arrayBuffer()));
    return rel;
  } catch {
    return null;
  }
}

async function scrape() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    locale: "fr-FR",
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
    viewport: { width: 1440, height: 1200 }
  });

  await page.goto(FACEBOOK_URL, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(7000);

  // Fermer les fenêtres de cookies/connexion lorsque cela est possible.
  for (const label of ["Autoriser tous les cookies", "Allow all cookies", "Fermer", "Close", "Plus tard", "Not now"]) {
    const button = page.getByRole("button", { name: label }).first();
    if (await button.count()) {
      try { await button.click({ timeout: 1500 }); } catch {}
    }
  }

  // Quelques défilements pour faire apparaître les publications récentes.
  for (let i = 0; i < 4; i++) {
    await page.mouse.wheel(0, 1100);
    await page.waitForTimeout(1200);
  }

  const raw = await page.evaluate(() => {
    const items = [];
    const candidates = [
      ...document.querySelectorAll('[role="article"]'),
      ...document.querySelectorAll('article')
    ];

    for (const node of candidates) {
      const text = (node.innerText || "").trim();
      if (!text || text.length < 20) continue;

      const links = [...node.querySelectorAll("a[href]")].map(a => a.href);
      const postUrl = links.find(href =>
        /\/posts\/|story_fbid=|permalink\.php|\/photos\/|\/videos\//i.test(href)
      ) || null;

      const timeNode = node.querySelector("time");
      const date = timeNode?.dateTime || timeNode?.getAttribute("datetime") || null;

      const images = [...node.querySelectorAll("img[src]")]
        .map(img => ({ src: img.currentSrc || img.src, alt: img.alt || "", width: img.naturalWidth || 0 }))
        .filter(img => img.src && img.width >= 250 && !/emoji|profile|logo/i.test(img.alt));

      items.push({
        text,
        url: postUrl,
        date,
        image: images[0]?.src || null
      });
    }
    return items;
  });

  await browser.close();
  return raw;
}

let scraped = [];
try {
  scraped = await scrape();
} catch (error) {
  console.warn("Facebook n'a pas pu être lu aujourd'hui :", error.message);
}

const now = new Date();
const normalized = [];
for (const item of scraped) {
  let text = clean(item.text);
  if (!text) continue;

  // Retire quelques éléments d'interface fréquemment inclus dans le texte.
  text = text
    .replace(/\b(J’aime|Commenter|Partager|Like|Comment|Share)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const id = sha(`${item.url || ""}|${text}`);
  const prior = (existing.posts || []).find(p => p.id === id || (item.url && p.url === item.url));

  let date = item.date;
  if (!date || Number.isNaN(new Date(date).getTime())) {
    // En l'absence de date exploitable, on conserve la date déjà connue ;
    // sinon on date la découverte. Le script n'invente pas une date passée.
    date = prior?.date || now.toISOString();
  }

  const local_image = prior?.local_image || await downloadImage(item.image, id);
  normalized.push({
    id,
    date,
    text,
    url: item.url || prior?.url || FACEBOOK_URL,
    image_url: item.image || prior?.image_url || null,
    local_image: local_image || null
  });
}

const merged = [...normalized, ...(existing.posts || [])]
  .filter((post, index, array) => array.findIndex(p => p.id === post.id) === index)
  .sort((a, b) => new Date(b.date) - new Date(a.date))
  .slice(0, 120);

const output = {
  source: FACEBOOK_URL,
  updated_at: now.toISOString(),
  scrape_status: normalized.length ? "ok" : "no-new-public-post-detected",
  posts: merged
};

fs.writeFileSync(DATA_FILE, JSON.stringify(output, null, 2) + "\n", "utf8");
console.log(`Publications détectées aujourd'hui : ${normalized.length}`);
console.log(`Publications conservées : ${merged.length}`);

// Le site est toujours reconstruit, même si Facebook bloque temporairement.
const build = spawnSync(process.execPath, ["scripts/build-actualites.mjs"], {
  cwd: ROOT,
  stdio: "inherit"
});
process.exit(build.status ?? 0);
