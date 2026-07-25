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
  const topics = detectTopics(cleaned);

  if (!cleaned) {
    const fallback = "Une nouvelle actualité du Cercle des Joueurs Paresseux est disponible. La publication originale reste accessible sur Facebook pour consulter les informations transmises par le club.";
    return { card: fallback, paragraphs: [fallback], sourceTooShort: true };
  }

  // Ces deux publications très courtes nécessitent une reformulation éditoriale
  // dédiée. Les phrases ci-dessous n'ajoutent aucun événement non indiqué :
  // elles replacent uniquement l'information dans le contexte stable du site.
  if (/photo de couverture/i.test(cleaned)) {
    const paragraphs = [
      "Le Cercle des Joueurs Paresseux a renouvelé sa photo de couverture. Cette image devient le principal visuel de présentation du club sur ses supports de communication et permet de reconnaître plus rapidement son identité. Elle rassemble les éléments graphiques associés à l’univers du Cercle et à ses activités ludiques.",
      "Cette mise à jour accompagne la présentation du club auprès des joueurs de Vailhauquès et des communes voisines. Le Cercle réunit des personnes intéressées par les jeux de société, les jeux de cartes et les jeux de figurines. La nouvelle couverture sert donc de repère commun à ces différentes pratiques, sans privilégier un seul type de jeu.",
      "Le visuel peut désormais accompagner les annonces, les actualités et les informations pratiques publiées par le Cercle. Il contribue à rendre la communication plus cohérente entre le site Internet et la page Facebook, tout en facilitant l’identification du club par les personnes qui le découvrent.",
      "La publication Facebook originale permet de consulter l’image dans son contexte et de retrouver les réactions laissées par la communauté. Le site conserve pour sa part une présentation durable de cette évolution dans les actualités du Cercle."
    ];
    const card = "Le Cercle des Joueurs Paresseux a renouvelé sa photo de couverture afin de mieux identifier le club et son univers. Ce nouveau visuel accompagne désormais sa communication et rassemble, dans une même image, les différentes pratiques proposées : jeux de société, jeux de cartes et jeux de figurines. Il sert de repère aux joueurs de Vailhauquès et des environs qui découvrent les activités du Cercle. Cette mise à jour contribue aussi à rendre plus cohérente la présentation du club entre son site Internet et sa page Facebook. L’article explique le rôle de cette nouvelle identité visuelle et renvoie vers la publication originale pour voir l’image dans son contexte.";
    return { card: trimWords(card, 180), paragraphs, sourceTooShort: true };
  }

  if (/a désormais son site Internet/i.test(cleaned)) {
    const paragraphs = [
      "Le Cercle des Joueurs Paresseux dispose désormais de son propre site Internet. Cette ouverture constitue une étape importante pour le club, qui peut maintenant regrouper ses informations essentielles dans un espace accessible à tous, sans dépendre uniquement des publications diffusées sur les réseaux sociaux.",
      "Le site présente les principales familles de jeux pratiquées au Cercle : jeux de société, jeux de cartes et jeux de figurines. Chaque visiteur peut ainsi comprendre rapidement la diversité des activités proposées et repérer les pages correspondant à ses centres d’intérêt avant de venir rencontrer les membres.",
      "Les informations pratiques ont également été réunies pour faciliter une première visite. Le fonctionnement du club, le lieu des rencontres et les indications utiles pour venir jouer à Vailhauquès sont accessibles depuis les différentes pages. L’objectif est de répondre aux questions les plus fréquentes et de rendre la découverte du Cercle plus simple.",
      "Ce nouveau support complète la page Facebook. Le site conserve une présentation structurée et durable des activités, tandis que Facebook reste utile pour suivre les publications originales, les réactions et les échanges de la communauté. Les deux espaces ont donc des rôles complémentaires.",
      "La rubrique Actualités permet enfin de retrouver les informations récentes du Cercle sous une forme plus lisible. Chaque publication peut y être présentée avec un titre, une image, un texte développé et un lien vers sa source Facebook. Le visiteur dispose ainsi d’assez d’éléments pour savoir si le sujet l’intéresse avant de quitter le site.",
      "Avec cette mise en ligne, le Cercle améliore sa visibilité auprès des joueurs de Vailhauquès et des communes proches de Montpellier. Le site devient la porte d’entrée principale pour découvrir le club, ses pratiques et les renseignements nécessaires pour venir jouer."
    ];
    const card = "Le Cercle des Joueurs Paresseux possède désormais son propre site Internet. Cette nouvelle vitrine rassemble les jeux pratiqués, le fonctionnement du club et les informations utiles pour venir jouer à Vailhauquès. Les visiteurs peuvent y découvrir les activités autour des jeux de société, des jeux de cartes et des jeux de figurines, puis repérer facilement les pages qui correspondent à leurs envies. Le site complète la page Facebook : il conserve une présentation structurée et durable, tandis que le réseau social reste le lieu des publications originales et des échanges. Cette mise en ligne améliore donc à la fois l’information des futurs joueurs et la visibilité locale du Cercle.";
    return { card: trimWords(card, 180), paragraphs, sourceTooShort: true };
  }

  const sentences = splitSentences(cleaned);
  const selected = sentences
    .map((sentence, index) => ({ sentence, index, score: sentenceScore(sentence, index, topics) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, Math.min(14, sentences.length))
    .sort((a, b) => a.index - b.index)
    .map(item => item.sentence);

  const articleBase = selected.join(" ") || cleaned;
  const paragraphs = [];
  let current = [];
  let count = 0;
  for (const sentence of selected.length ? selected : [cleaned]) {
    const words = wordCount(sentence);
    if (current.length && count + words > 105) {
      paragraphs.push(current.join(" "));
      current = [];
      count = 0;
    }
    current.push(sentence);
    count += words;
  }
  if (current.length) paragraphs.push(current.join(" "));

  return {
    card: trimWords(articleBase, 180),
    paragraphs: paragraphs.map(p => trimWords(p, 130)),
    sourceTooShort: wordCount(cleaned) < 120
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

function summaryHtml(paragraphs, sourceTooShort) {
  const note = sourceTooShort
    ? '<p class="news-source-note">La publication Facebook disponible est courte ou tronquée. L’article développe uniquement les informations vérifiables et le contexte stable du Cercle.</p>'
    : "";
  const body = (paragraphs || []).map(paragraph => `<p>${escapeHtml(paragraph)}</p>`).join("\n");
  return `<div class="news-summary"><p class="eyebrow">L’essentiel</p>${body}${note}</div>`;
}

function sharedStyles() {
  return `
.page-hero{position:relative;overflow:hidden;background:radial-gradient(circle at 85% 20%,rgba(246,190,66,.28),transparent 28%),linear-gradient(135deg,#213c31 0%,#2f5746 58%,#3f6b56 100%)!important;color:#fff!important;padding:clamp(3.25rem,7vw,5.75rem) 0!important}
.page-hero::after{content:"";position:absolute;right:-90px;bottom:-210px;width:420px;height:420px;border-radius:50%;background:rgba(255,255,255,.06);pointer-events:none}
.page-hero .container{position:relative;z-index:1}.page-hero .eyebrow{color:#ffd56a!important;font-weight:800;letter-spacing:.14em}.page-hero h1{color:#fff!important;max-width:900px;font-size:clamp(2rem,5vw,4rem)!important;line-height:1.08!important;text-shadow:0 3px 16px rgba(0,0,0,.24)}.page-hero .hero-intro{color:rgba(255,255,255,.95)!important;max-width:780px;font-size:clamp(1.02rem,2vw,1.22rem);line-height:1.65}
.news-grid{margin-top:1.5rem;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1.5rem;align-items:start}.news-card{display:flex!important;flex-direction:column!important;min-width:0;overflow:hidden;border-radius:18px;background:#fff;box-shadow:0 12px 32px rgba(31,48,39,.10)}.news-card-image{display:block;width:100%;height:180px;overflow:hidden;background:#e7ece8;flex:0 0 180px}.news-card-image img{display:block;width:100%;height:180px;object-fit:cover}.news-card-body{padding:1.35rem 1.4rem 1.5rem;min-width:0}.news-card-body .eyebrow{margin:0 0 .45rem;font-size:.78rem}.news-card-body h2{margin:.1rem 0 .55rem!important;font-size:clamp(1.35rem,2.2vw,1.85rem)!important;line-height:1.18!important;overflow-wrap:anywhere}.news-card-body h2 a{color:inherit;text-decoration:none}.news-card-body>p:not(.eyebrow){line-height:1.65}.news-topic-line{font-size:.9rem;color:#52645b;margin:.2rem 0 .85rem}.news-summary{margin:0 0 1.75rem;padding:1.35rem 1.5rem;border-left:5px solid #d7a82f;border-radius:0 16px 16px 0;background:#f7f3e8}.news-summary>p:not(.eyebrow){margin:.8rem 0;font-size:1.06rem;line-height:1.78}.news-source-note{margin-top:1.15rem!important;padding-top:1rem;border-top:1px solid rgba(70,80,73,.18);font-size:.9rem!important;color:#5e655f}.news-main-image{margin:0 0 1.6rem}.news-main-image img{display:block;width:100%;max-height:560px;object-fit:contain;border-radius:18px}.news-topic-links{display:flex;gap:.6rem;flex-wrap:wrap;margin:1.25rem 0}
@media(max-width:820px){.news-grid{grid-template-columns:1fr}.news-card-image,.news-card-image img{height:175px;flex-basis:175px}}
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
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)} | LCDJP</title><meta name="description" content="${escapeHtml(description)}"><meta name="robots" content="index, follow, max-image-preview:large"><link rel="canonical" href="${canonical}"><meta property="og:type" content="article"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${image}"><link rel="icon" href="../assets/images/logo-cercle-joueurs-paresseux.webp"><link rel="stylesheet" href="../assets/css/style.css"><style>${sharedStyles()}</style><script type="application/ld+json">${JSON.stringify(schema)}</script></head><body><a class="skip-link" href="#contenu">Aller au contenu</a><header class="site-header"><div class="container header-inner"><a class="brand" href="../index.html"><img src="../assets/images/logo-cercle-joueurs-paresseux.webp" alt="" width="72" height="72"><span><strong>Le Cercle des Joueurs Paresseux</strong><small>Club de jeux près de Montpellier</small></span></a><nav aria-label="Navigation principale" class="main-nav page-nav"><a href="../index.html">Accueil</a><a href="../jeux-de-societe.html">Jeux de société</a><a href="../jeux-de-cartes.html">Jeux de cartes</a><a href="../wargame.html">Wargame</a><a href="../actualites.html">Actualités</a></nav></div></header><main id="contenu"><section class="page-hero compact-hero"><div class="container"><p class="eyebrow">Dernières actualités</p><h1>${escapeHtml(title)}</h1><p class="hero-intro">Publié le ${escapeHtml(dateFr)} par le Cercle des Joueurs Paresseux.</p></div></section><section class="section"><article class="container prose news-article">${img}${summaryHtml(summaries.paragraphs, summaries.sourceTooShort)}<div class="news-topic-links">${links}</div>${sourceLink}<p><a href="../actualites.html">← Toutes les actualités du Cercle</a></p></article></section></main><footer class="site-footer"><div class="container footer-main"><div><strong>Le Cercle des Joueurs Paresseux</strong><span>Vendredi à 20 h 30 · Salle de l'Âge d'Or, Vailhauquès</span></div></div></footer></body></html>`;
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
console.log(`Actualités V16.8 générées : ${uniquePosts.length} publication(s).`);
