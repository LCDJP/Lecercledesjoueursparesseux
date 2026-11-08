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
const MAX_POSTS = Number(process.env.FACEBOOK_MAX_POSTS || 40);
const MAX_SCROLL_PASSES = Number(process.env.FACEBOOK_SCROLL_PASSES || 28);
const SCROLL_WAIT_MS = Number(process.env.FACEBOOK_SCROLL_WAIT_MS || 1400);
const MAX_STAGNANT_PASSES = Number(process.env.FACEBOOK_MAX_STAGNANT_PASSES || 6);

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

function isUsablePostText(value = "") {
  const text = clean(value);
  if (text.length < 18) return false;
  if (/partagé avec\s*:\s*public|toutes les réactions|contenu ia|j’aime|commenter|\d+\s*(?:min|h|j)\s*[·•]/i.test(text)) return false;
  const meaningful = text.replace(/le cercle des joueurs paresseux/ig, "").trim();
  return meaningful.length >= 18 && /[A-Za-zÀ-ÿ]{3}/.test(meaningful);
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

  if (aUrl && bUrl) return aUrl === bUrl;
  if (a.id && b.id) return a.id === b.id;

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
  const currentClean = current?.text_source === "facebook-message-selector" && isUsablePostText(currentText);
  const candidateClean = candidate?.text_source === "facebook-message-selector" && isUsablePostText(candidateText);
  const currentTruncated = /(?:…|\.\.\.)\s*(?:En|Voir plus)?\s*$/i.test(currentText);
  const candidateTruncated = /(?:…|\.\.\.)\s*(?:En|Voir plus)?\s*$/i.test(candidateText);

  // Ne jamais remplacer une version propre et plus complète par une extraction
  // plus courte/tronquée. Une extraction ciblée ne gagne que si elle est réellement
  // plus fiable ou si l'ancienne version est manifestement polluée.
  let chosenText = currentText;
  let chosenSource = current?.text_source || candidate?.text_source || null;
  if (!currentClean && candidateClean) {
    chosenText = candidateText;
    chosenSource = candidate.text_source;
  } else if (currentClean && candidateClean) {
    if ((!candidateTruncated && currentTruncated) ||
        (candidateText.length > currentText.length && !candidateTruncated)) {
      chosenText = candidateText;
      chosenSource = candidate.text_source;
    }
  } else if (!currentText || candidateText.length > currentText.length) {
    chosenText = candidateText;
    chosenSource = candidate?.text_source || chosenSource;
  }

  return {
    ...(current || {}),
    ...(candidate || {}),
    id: current?.id || candidate?.id,
    text: chosenText,
    text_source: chosenSource,
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

    const collected = new Map();

    async function expandVisiblePosts() {
      // Facebook rend souvent les textes longs derrière un lien/bouton
      // « Voir plus ». On le cherche DANS chaque publication, pas dans
      // toute la page, pour éviter de cliquer sur des éléments sans rapport.
      const expanded = await page.evaluate(() => {
        const articles = [
          ...document.querySelectorAll('[role="article"]'),
          ...document.querySelectorAll('article')
        ];
        let clicks = 0;
        const labels = ['voir plus', 'see more', 'afficher plus'];
        const normalize = value => String(value || '')
          .replace(/\u00a0/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .toLocaleLowerCase('fr-FR');

        for (const article of articles) {
          const candidates = article.querySelectorAll(
            '[role="button"], button, [tabindex="0"], span, div'
          );
          for (const element of candidates) {
            const label = normalize(element.innerText || element.textContent);
            const aria = normalize(element.getAttribute('aria-label'));
            if (!labels.some(value => label === value || aria === value || label.startsWith(value + ' '))) continue;
            // Le libellé peut être imbriqué dans un span : remonter au contrôle cliquable.
            const target = element.closest('[role="button"], button, [tabindex="0"]') || element;
            if (target.dataset.lcdjpExpanded === '1') continue;
            target.dataset.lcdjpExpanded = '1';
            target.click();
            clicks += 1;
          }
        }
        return clicks;
      });

      if (expanded > 0) {
        // Laisser Facebook remplacer le texte tronqué par le texte complet.
        await page.waitForTimeout(1100);
      }
      return expanded;
    }

    async function collectVisiblePosts() {
      return await page.evaluate(() => {
        const items = [];
        const candidates = [
          ...document.querySelectorAll('[role="article"]'),
          ...document.querySelectorAll('article')
        ];

        const cleanText = value => String(value || '')
          .replace(/\u00a0/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        function getMessageText(node) {
          // Facebook utilise généralement ces attributs pour distinguer
          // le texte de la publication du reste du bloc (commentaires,
          // boutons, compteurs, etc.). On privilégie donc EXCLUSIVEMENT
          // ces zones lorsqu'elles sont disponibles.
          const selectors = [
            '[data-ad-preview="message"]',
            '[data-ad-comet-preview="message"]'
          ];

          const messages = [];
          for (const selector of selectors) {
            for (const message of node.querySelectorAll(selector)) {
              const text = cleanText(message.innerText || message.textContent);
              if (text && !messages.includes(text)) messages.push(text);
            }
          }

          if (messages.length) {
            return {
              text: messages.join('\n\n'),
              source: 'facebook-message-selector'
            };
          }

          // Pas de récupération du bloc complet en secours : il contient
          // fréquemment les réactions, commentaires et commandes Facebook.
          // Mieux vaut manquer temporairement une publication que fabriquer
          // une fausse actualité à partir de l'interface.
          return { text: '', source: 'none' };
        }

        for (const node of candidates) {
          const extracted = getMessageText(node);
          if (!extracted.text || extracted.text.length < 5) continue;

          const links = [...node.querySelectorAll('a[href]')].map(a => a.href);
          const postUrl = links.find(href =>
            /\/posts\/|story_fbid=|permalink\.php|\/photos\/|\/videos\//i.test(href)
          ) || null;

          const timeNode = node.querySelector('time');
          const labelledTime = [...node.querySelectorAll('a[aria-label], span[aria-label]')]
            .map(el => el.getAttribute('aria-label'))
            .find(Boolean);
          const date =
            timeNode?.dateTime ||
            timeNode?.getAttribute('datetime') ||
            labelledTime ||
            null;

          const images = [...node.querySelectorAll('img[src]')]
            .map(img => ({
              src: img.currentSrc || img.src,
              alt: img.alt || '',
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
            text: extracted.text,
            text_source: extracted.source,
            url: postUrl,
            date,
            image: images[0]?.src || null
          });
        }

        return items;
      });
    }

    let stagnantPasses = 0;
    let previousCount = 0;
    let passesDone = 0;

    for (let pass = 0; pass < MAX_SCROLL_PASSES; pass += 1) {
      passesDone = pass + 1;
      await expandVisiblePosts();
      await expandVisiblePosts();

      const snapshot = await collectVisiblePosts();

      for (const item of snapshot) {
        const textKey = clean(item.text).slice(0, 500);
        const key = normalizePostUrl(item.url) || `text:${sha(textKey)}`;
        const current = collected.get(key);

        // Plusieurs instantanés d'une même publication peuvent être vus :
        // d'abord tronqués, puis complets après le clic sur « Voir plus ».
        // Ne jamais remplacer un texte plus long par un instantané plus court.
        if (
          !current ||
          clean(item.text).length > clean(current.text).length
        ) {
          collected.set(key, item);
        }
      }

      if (collected.size === previousCount) {
        stagnantPasses += 1;
      } else {
        stagnantPasses = 0;
        previousCount = collected.size;
      }

      console.log(
        `Facebook : passage ${passesDone}/${MAX_SCROLL_PASSES}, ${collected.size} bloc(s) unique(s) collecté(s).`
      );

      if (collected.size >= MAX_POSTS * 2) break;
      if (pass >= 5 && stagnantPasses >= MAX_STAGNANT_PASSES) break;

      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await page.waitForTimeout(SCROLL_WAIT_MS);
    }

    // Une dernière collecte après le dernier chargement différé.
    await expandVisiblePosts();
    await expandVisiblePosts();
    const finalSnapshot = await collectVisiblePosts();
    for (const item of finalSnapshot) {
      const textKey = clean(item.text).slice(0, 500);
      const key = normalizePostUrl(item.url) || `text:${sha(textKey)}`;
      const current = collected.get(key);
      // Même règle pour la collecte finale : conserver la version la plus
      // complète, même si Facebook renvoie ensuite une version tronquée.
      if (
        !current ||
        clean(item.text).length > clean(current.text).length
      ) {
        collected.set(key, item);
      }
    }

    console.log(`Facebook : ${passesDone} passage(s) de défilement effectués.`);
    console.log(`Facebook : ${collected.size} bloc(s) public(s) collecté(s) avant dédoublonnage.`);

    return [...collected.values()].slice(0, MAX_POSTS * 4);
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
  // Seules les extractions ciblées du message sont acceptées.
  const text = removeFacebookInterfaceText(item.text);
  if (item.text_source !== "facebook-message-selector" || !isUsablePostText(text)) continue;

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
    local_image: local_image || null,
    text_source: item.text_source || prior?.text_source || null
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
