import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const BASE_URL = "https://lcdjp.github.io/Lecercledesjoueursparesseux/";
const DATA_FILE = path.join(ROOT, "data", "facebook-posts.json");
const NEWS_DIR = path.join(ROOT, "actualites");
const INDEX_FILE = path.join(ROOT, "actualites.html");
const SITEMAP_FILE = path.join(ROOT, "sitemap.xml");

fs.mkdirSync(NEWS_DIR, { recursive: true });

const escapeHtml = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

const normalizeSpace = (value = "") => String(value)
  .replace(/<[^>]*>/g, " ")
  .replace(/\s+/g, " ")
  .trim();

function slugify(value) {
  return normalizeSpace(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72) || "actualite-lcdjp";
}

function cleanFacebookText(value = "") {
  return normalizeSpace(value)
    .replace(/^Le Cercle des Joueurs Paresseux\s*/i, "")
    .replace(/^\d+\s*(min|h|j|sem\.?|mois)\s*[·•-]\s*/i, "")
    .replace(/\b(J’aime|Commenter|Partager|Like|Comment|Share)\b/gi, " ")
    .replace(/\bToutes les réactions\s*:?\s*\d*(?:\s+\d+)*\b/gi, " ")
    .replace(/\b\d+\s+(?:de\s+)?commentaires?\b/gi, " ")
    .replace(/\b\d+\s+(commentaire|commentaires|partage|partages|réaction|réactions)\b/gi, " ")
    .replace(/\bVoir plus\b/gi, " ")
    .replace(/\s+[Vv]…(?:\s+En)?\s*$/u, "…")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSentences(value = "") {
  return String(value)
    .split(/(?<=[.!?…])\s+/u)
    .map(sentence => sentence.trim())
    .filter(sentence => sentence.length >= 12);
}

function wordCount(value = "") {
  return normalizeSpace(value).split(/\s+/).filter(Boolean).length;
}

function trimWords(value, maxWords) {
  const words = normalizeSpace(value).split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(" ");
  return `${words.slice(0, maxWords).join(" ").replace(/[,:;.!?…-]+$/u, "")}…`;
}

function sentenceScore(sentence, index, topics) {
  let score = Math.max(0, 10 - index);
  const lower = sentence.toLowerCase();
  if (/\b(organise|propose|accueille|présente|découvre|tournoi|soirée|événement|nouveau|désormais|site internet|jeu|partie|club)\b/i.test(lower)) score += 7;
  if (/\b(vailhauquès|vendredi|samedi|dimanche|\d{1,2}\s*(?:h|heures?|janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre))\b/i.test(lower)) score += 4;
  if (/^(merci|bravo|encore une|quelle belle)/i.test(sentence)) score -= 4;
  for (const topic of topics) {
    if (lower.includes(topic.label.toLowerCase())) score += 3;
  }
  return score;
}

function detectTopics(text = "") {
  const value = text.toLowerCase();
  const topics = [];
  const tests = [
    ["Warhammer 40K", /\b(40k|warhammer 40|warhammer 40000|warhammer 40 000)\b/i, "wargame.html"],
    ["Age of Sigmar", /\b(age of sigmar|aos)\b/i, "wargame.html"],
    ["StarCraft Tabletop", /\bstarcraft\b/i, "wargame.html"],
    ["jeux de figurines", /\b(wargame|figurines?|kill team|combat patrol)\b/i, "wargame.html"],
    ["jeux de cartes", /\b(magic|lorcana|altered|pok[eé]mon|star wars unlimited|flesh and blood|one piece)\b/i, "jeux-de-cartes.html"],
    ["jeux de société", /\b(jeu[x]? de soci[eé]t[eé]|jeu[x]? de plateau|soir[eé]e jeux|partie|joueurs?)\b/i, "jeux-de-societe.html"]
  ];
  for (const [label, regex, href] of tests) {
    if (regex.test(value)) topics.push({ label, href });
  }
  if (!topics.length) topics.push({ label: "vie du club", href: "index.html" });
  return topics;
}

function buildSummaries(post) {
  const cleaned = cleanFacebookText(post.text);
  if (!cleaned) {
    const fallback = "Une nouvelle actualité du Cercle des Joueurs Paresseux est disponible sur Facebook.";
    return { card: fallback, article: fallback, sourceTooShort: true };
  }
  if (/a changé sa photo de couverture/i.test(cleaned)) {
    const text = "Le Cercle des Joueurs Paresseux a mis à jour sa photo de couverture afin de mieux présenter l’identité et l’univers du club. Cette nouvelle illustration accompagne désormais la communication du Cercle et permet d’identifier plus facilement ses activités autour des jeux de société, des jeux de cartes et des jeux de figurines à Vailhauquès.";
    return { card: trimWords(text, 100), article: text, sourceTooShort: true };
  }

  const topics = detectTopics(cleaned);
  const sentences = splitSentences(cleaned);
  const selected = sentences
    .map((sentence, index) => ({ sentence, index, score: sentenceScore(sentence, index, topics) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, Math.min(10, sentences.length))
    .sort((a, b) => a.index - b.index)
    .map(item => item.sentence);

  const articleBase = selected.join(" ") || cleaned;
  const article = trimWords(articleBase, 300);
  const card = trimWords(articleBase, 120);
  return {
    card: wordCount(card) < 35 ? trimWords(cleaned, 120) : card,
    article,
    sourceTooShort: wordCount(cleaned) < 80
  };
}

function makeArticleTitle(post) {
  const cleaned = cleanFacebookText(post.text);
  if (/photo de couverture/i.test(cleaned)) return "Une nouvelle image pour présenter le Cercle";
  if (/a désormais son site Internet/i.test(cleaned)) return "Le Cercle a désormais son site Internet";
  const firstSentence = splitSentences(cleaned)[0]?.replace(/\s+/g, " ").trim() || "";
  if (firstSentence.length >= 18 && firstSentence.length <= 78) return firstSentence;
  const date = new Date(post.date);
  const dateFr = Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(date);
  return `Actualité du Cercle des Joueurs Paresseux${dateFr ? ` – ${dateFr}` : ""}`;
}

function makeDescription(summary) {
  return trimWords(summary, 26).slice(0, 158);
}

function summaryHtml(summary, sourceTooShort) {
  const note = sourceTooShort
    ? '<p class="news-source-note">Le texte Facebook disponible est court ou tronqué : le résumé reprend uniquement les informations vérifiables.</p>'
    : "";
  return `<div class="news-summary"><p class="eyebrow">L’essentiel</p><p>${escapeHtml(summary)}</p>${note}</div>`;
}

function sharedStyles() {
  return `
.page-hero{position:relative;overflow:hidden;background:radial-gradient(circle at 85% 20%,rgba(246,190,66,.28),transparent 28%),linear-gradient(135deg,#213c31 0%,#2f5746 58%,#3f6b56 100%)!important;color:#fff!important;padding:clamp(3.5rem,8vw,6.5rem) 0!important}
.page-hero::after{content:"";position:absolute;right:-90px;bottom:-210px;width:420px;height:420px;border-radius:50%;background:rgba(255,255,255,.06);pointer-events:none}
.page-hero .container{position:relative;z-index:1}.page-hero .eyebrow{color:#ffd56a!important;font-weight:800;letter-spacing:.14em}.page-hero h1{color:#fff!important;max-width:900px;text-shadow:0 3px 16px rgba(0,0,0,.24)}.page-hero .hero-intro{color:rgba(255,255,255,.95)!important;max-width:780px;font-size:clamp(1.05rem,2vw,1.3rem);line-height:1.65}
.news-grid{margin-top:1.5rem;display:grid;gap:1.5rem}.news-card{display:grid;grid-template-columns:minmax(190px,260px) 1fr;overflow:hidden}.news-card-image{display:block;min-height:180px;max-height:220px;background:#e7ece8}.news-card-image img{display:block;width:100%;height:100%;min-height:180px;max-height:220px;object-fit:cover}.news-card-body{padding:1.4rem}.news-card-body h2{margin-top:.2rem}.news-card-body>p:not(.eyebrow){line-height:1.65}.news-topic-line{font-size:.92rem;color:#52645b;margin:.25rem 0 .9rem}.news-summary{margin:0 0 1.75rem;padding:1.25rem 1.4rem;border-left:5px solid #d7a82f;border-radius:0 16px 16px 0;background:#f7f3e8}.news-summary p:last-of-type{margin-bottom:0;font-size:1.08rem;line-height:1.75}.news-source-note{margin-top:1rem!important;font-size:.9rem!important;color:#5e655f}.news-main-image img{width:100%;max-height:560px;object-fit:contain;border-radius:18px}.news-topic-links{display:flex;gap:.6rem;flex-wrap:wrap;margin:1.25rem 0}
@media(max-width:760px){.news-card{grid-template-columns:1fr}.news-card-image,.news-card-image img{height:190px;min-height:190px;max-height:190px}}
`;
}

function articleHtml(post, slug, title, description, summaries) {
  const topics = detectTopics(post.text);
  const date = new Date(post.date);
  const iso = Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  const dateFr = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(iso));
  const canonical = `${BASE_URL}actualites/${slug}.html`;
  const image = post.local_image ? `${BASE_URL}${post.local_image}` : `${BASE_URL}assets/images/logo-cercle-joueurs-paresseux.webp`;
  const links = topics.map(topic => `<a class="button button-ghost" href="../${topic.href}">${escapeHtml(topic.label)}</a>`).join("\n");
  const sourceLink = post.url ? `<p><a class="button button-primary" href="${escapeHtml(post.url)}" rel="noopener noreferrer" target="_blank">Voir la publication originale sur Facebook</a></p>` : "";
  const img = post.local_image ? `<figure class="news-main-image"><img src="../${escapeHtml(post.local_image)}" alt="Illustration de l'actualité du Cercle des Joueurs Paresseux" loading="lazy"></figure>` : "";
  const schema = {"@context":"https://schema.org","@type":"BlogPosting",headline:title,description,datePublished:iso,dateModified:iso,mainEntityOfPage:canonical,image:[image],author:{"@type":"Organization",name:"Le Cercle des Joueurs Paresseux",url:BASE_URL},publisher:{"@type":"Organization",name:"Le Cercle des Joueurs Paresseux"}};
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)} | LCDJP</title><meta name="description" content="${escapeHtml(description)}"><meta name="robots" content="index, follow, max-image-preview:large"><link rel="canonical" href="${canonical}"><meta property="og:type" content="article"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${image}"><link rel="icon" href="../assets/images/logo-cercle-joueurs-paresseux.webp"><link rel="stylesheet" href="../assets/css/style.css"><style>${sharedStyles()}</style><script type="application/ld+json">${JSON.stringify(schema)}</script></head><body><a class="skip-link" href="#contenu">Aller au contenu</a><header class="site-header"><div class="container header-inner"><a class="brand" href="../index.html"><img src="../assets/images/logo-cercle-joueurs-paresseux.webp" alt="" width="72" height="72"><span><strong>Le Cercle des Joueurs Paresseux</strong><small>Club de jeux près de Montpellier</small></span></a><nav aria-label="Navigation principale" class="main-nav page-nav"><a href="../index.html">Accueil</a><a href="../jeux-de-societe.html">Jeux de société</a><a href="../jeux-de-cartes.html">Jeux de cartes</a><a href="../wargame.html">Wargame</a><a href="../actualites.html">Actualités</a></nav></div></header><main id="contenu"><section class="page-hero compact-hero"><div class="container"><p class="eyebrow">Dernières actualités</p><h1>${escapeHtml(title)}</h1><p class="hero-intro">Publié le ${escapeHtml(dateFr)} par le Cercle des Joueurs Paresseux.</p></div></section><section class="section"><article class="container prose news-article">${img}${summaryHtml(summaries.article, summaries.sourceTooShort)}<div class="news-topic-links">${links}</div>${sourceLink}<p><a href="../actualites.html">← Toutes les actualités du Cercle</a></p></article></section></main><footer class="site-footer"><div class="container footer-main"><div><strong>Le Cercle des Joueurs Paresseux</strong><span>Vendredi à 20 h 30 · Salle de l'Âge d'Or, Vailhauquès</span></div></div></footer></body></html>`;
}

function card(post, slug, title, summaries) {
  const date = new Date(post.date);
  const dateFr = Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(date);
  const img = post.local_image ? `<img src="${escapeHtml(post.local_image)}" alt="" loading="lazy">` : `<img src="assets/images/logo-cercle-joueurs-paresseux.webp" alt="" loading="lazy">`;
  const topics = detectTopics(post.text).map(topic => topic.label).join(" · ");
  return `<article class="news-card"><a class="news-card-image" href="actualites/${slug}.html">${img}</a><div class="news-card-body"><p class="eyebrow">${escapeHtml(dateFr)}</p><h2><a href="actualites/${slug}.html">${escapeHtml(title)}</a></h2><p class="news-topic-line">${escapeHtml(topics)}</p><p>${escapeHtml(summaries.card)}</p><a class="button button-primary" href="actualites/${slug}.html">Lire l'article</a></div></article>`;
}

if (!fs.existsSync(DATA_FILE)) throw new Error(`Fichier introuvable : ${DATA_FILE}`);
const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
const uniquePosts = [];
for (const post of (data.posts || [])) {
  if (!post?.text || !post?.date) continue;
  const key = post.id || crypto.createHash("sha1").update(`${post.date}|${cleanFacebookText(post.text)}`).digest("hex");
  const textKey = cleanFacebookText(post.text).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().slice(0, 260);
  const existingIndex = uniquePosts.findIndex(item => item.key === key || item.textKey === textKey || item.textKey.includes(textKey) || textKey.includes(item.textKey));
  if (existingIndex === -1) uniquePosts.push({ ...post, key, textKey });
  else if (post.text.length > uniquePosts[existingIndex].text.length) uniquePosts[existingIndex] = { ...post, key: uniquePosts[existingIndex].key, textKey };
}
uniquePosts.sort((a, b) => new Date(b.date) - new Date(a.date));
for (const file of fs.readdirSync(NEWS_DIR)) if (file.endsWith(".html")) fs.unlinkSync(path.join(NEWS_DIR, file));

const cards = [];
const sitemapUrls = [];
for (const post of uniquePosts) {
  const title = makeArticleTitle(post);
  const summaries = buildSummaries(post);
  const date = new Date(post.date);
  const prefix = Number.isNaN(date.getTime()) ? "actualite" : date.toISOString().slice(0, 10);
  const slug = `${prefix}-${slugify(title)}-${post.key.slice(0, 8)}`;
  const description = makeDescription(summaries.card);
  fs.writeFileSync(path.join(NEWS_DIR, `${slug}.html`), articleHtml(post, slug, title, description, summaries), "utf8");
  cards.push(card(post, slug, title, summaries));
  sitemapUrls.push({ loc: `${BASE_URL}actualites/${slug}.html`, lastmod: Number.isNaN(date.getTime()) ? new Date().toISOString().slice(0, 10) : date.toISOString().slice(0, 10) });
}

const emptyState = `<div class="info-card"><h2>Les actualités arrivent bientôt</h2><p>Cette page est alimentée automatiquement à partir des publications publiques de la page Facebook du club.</p><p><a class="button button-primary" href="${data.source || "#"}" target="_blank" rel="noopener noreferrer">Voir notre page Facebook</a></p></div>`;
const indexSchema = {"@context":"https://schema.org","@type":"CollectionPage",name:"Dernières actualités du Cercle des Joueurs Paresseux",url:`${BASE_URL}actualites.html`,description:"Dernières actualités, publications, événements et photos du Cercle des Joueurs Paresseux à Vailhauquès, près de Montpellier."};
const indexHtml = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Dernières actualités du Cercle des Joueurs Paresseux | LCDJP</title><meta name="description" content="Dernières actualités, événements, jeux et photos du Cercle des Joueurs Paresseux à Vailhauquès, près de Montpellier."><meta name="robots" content="index, follow, max-image-preview:large"><link rel="canonical" href="${BASE_URL}actualites.html"><meta property="og:type" content="website"><meta property="og:title" content="Dernières actualités du Cercle des Joueurs Paresseux"><meta property="og:description" content="Des actualités développées automatiquement à partir des publications Facebook du Cercle."><meta property="og:url" content="${BASE_URL}actualites.html"><meta property="og:image" content="${BASE_URL}assets/images/logo-cercle-joueurs-paresseux.webp"><link rel="icon" href="assets/images/logo-cercle-joueurs-paresseux.webp"><link rel="stylesheet" href="assets/css/style.css"><style>${sharedStyles()}</style><script type="application/ld+json">${JSON.stringify(indexSchema)}</script></head><body><a class="skip-link" href="#contenu">Aller au contenu</a><header class="site-header"><div class="container header-inner"><a class="brand" href="index.html"><img src="assets/images/logo-cercle-joueurs-paresseux.webp" alt="" width="72" height="72"><span><strong>Le Cercle des Joueurs Paresseux</strong><small>Club de jeux près de Montpellier</small></span></a><nav aria-label="Navigation principale" class="main-nav page-nav"><a href="index.html">Accueil</a><a href="jeux-de-societe.html">Jeux de société</a><a href="jeux-de-cartes.html">Jeux de cartes</a><a href="wargame.html">Wargame</a><a aria-current="page" href="actualites.html">Actualités</a><a class="nav-cta" href="index.html#venir">Nous rejoindre</a></nav></div></header><main id="contenu"><section class="page-hero compact-hero"><div class="container"><p class="eyebrow">La vie du club</p><h1>Dernières actualités du Cercle des Joueurs Paresseux</h1><p class="hero-intro">Chaque carte donne assez d’informations pour comprendre le sujet avant d’ouvrir l’article. La publication Facebook originale reste accessible en fin de page.</p></div></section><section class="section"><div class="container news-grid">${cards.length ? cards.join("\n") : emptyState}</div></section></main><footer class="site-footer"><div class="container footer-main"><div><strong>Le Cercle des Joueurs Paresseux</strong><span>Vendredi à 20 h 30 · Salle de l'Âge d'Or, Vailhauquès</span></div></div></footer></body></html>`;
fs.writeFileSync(INDEX_FILE, indexHtml, "utf8");

let sitemap = fs.existsSync(SITEMAP_FILE) ? fs.readFileSync(SITEMAP_FILE, "utf8") : `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`;
sitemap = sitemap.replace(/\s*<url>\s*<loc>https:\/\/lcdjp\.github\.io\/Lecercledesjoueursparesseux\/actualites\/.*?<\/url>\s*/gs, "\n");
if (!sitemap.includes(`${BASE_URL}actualites.html`)) sitemap = sitemap.replace("</urlset>", `<url><loc>${BASE_URL}actualites.html</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>\n</urlset>`);
const newsXml = sitemapUrls.map(item => `<url><loc>${item.loc}</loc><lastmod>${item.lastmod}</lastmod><changefreq>monthly</changefreq><priority>0.65</priority></url>`).join("\n");
sitemap = sitemap.replace("</urlset>", `${newsXml ? `\n${newsXml}\n` : ""}</urlset>`);
fs.writeFileSync(SITEMAP_FILE, sitemap, "utf8");
console.log(`Actualités V16.7 générées : ${uniquePosts.length} publication(s).`);
