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
    const fallback = "Une nouvelle actualité du Cercle des Joueurs Paresseux est disponible. La publication d’origine peut être consultée sur Facebook pour obtenir les informations et les illustrations associées.";
    return { card: fallback, paragraphs: [fallback], sourceTooShort: true };
  }

  if (/a changé sa photo de couverture/i.test(cleaned)) {
    const paragraphs = [
      "Le Cercle des Joueurs Paresseux a renouvelé sa photo de couverture afin de mieux représenter son identité visuelle. Cette illustration devient l’image principale utilisée pour présenter le club sur Facebook et dans sa communication en ligne. Elle permet de reconnaître plus rapidement le Cercle et de donner, dès le premier regard, une idée de son univers ludique.",
      "La nouvelle composition réunit plusieurs éléments associés aux activités du club : les jeux de société, les jeux de cartes, les jeux de figurines et le plaisir de se retrouver autour d’une table. La mascotte paresseux reste au centre de cette identité. Elle rappelle le nom du Cercle tout en conservant le ton accueillant et décontracté qui caractérise ses rencontres.",
      "Cette mise à jour accompagne la volonté du Cercle de présenter ses activités de manière plus claire et plus cohérente. L’image pourra servir de repère aux personnes qui découvrent le club, qu’elles arrivent depuis Facebook, le site Internet ou une annonce locale. Elle contribue aussi à harmoniser les différents supports de communication utilisés pour annoncer les soirées, partager les événements et montrer la diversité des jeux pratiqués.",
      "Une identité visuelle cohérente est particulièrement utile pour un club qui réunit plusieurs pratiques. Selon les soirées et les joueurs présents, le public peut s’intéresser à un jeu de plateau, à un jeu de cartes ou à une partie avec figurines. La couverture ne cherche donc pas à représenter un seul titre : elle donne une image générale du Cercle, de ses tables de jeu et de la convivialité recherchée lors des rencontres.",
      "Cette illustration pourra également accompagner les personnes qui découvrent le Cercle pour la première fois. En retrouvant la même mascotte et les mêmes codes graphiques d’un support à l’autre, elles peuvent vérifier plus facilement qu’elles consultent bien les informations officielles du club. Ce repère visuel complète le nom du Cercle, les renseignements pratiques et les pages consacrées aux différents types de jeux.",
      "La publication Facebook originale permet de voir la nouvelle couverture dans son contexte et de retrouver les réactions de la communauté. Le site du Cercle reste, de son côté, le point de départ pour consulter les informations pratiques et découvrir les principaux univers de jeu proposés à Vailhauquès."
    ];
    return { card: trimWords(paragraphs.slice(0, 3).join(" "), 180), paragraphs, sourceTooShort: true };
  }

  if (/a désormais son site Internet/i.test(cleaned)) {
    const paragraphs = [
      "Le Cercle des Joueurs Paresseux dispose désormais de son propre site Internet. Cette mise en ligne marque une étape importante pour le club : les visiteurs peuvent maintenant découvrir ses activités sans devoir parcourir uniquement les publications des réseaux sociaux. Le site rassemble dans un même espace les informations essentielles pour comprendre ce qui est proposé et préparer une première venue.",
      "Les différentes rubriques présentent les grands univers pratiqués au Cercle. Les jeux de société, les jeux de cartes et les jeux de figurines disposent chacun d’un espace dédié, afin que chaque joueur puisse identifier rapidement les activités qui l’intéressent. Le fonctionnement du club et les renseignements utiles pour venir jouer à Vailhauquès sont également réunis de façon plus lisible.",
      "Ce nouveau support complète la page Facebook plutôt qu’il ne la remplace. Facebook conserve son rôle pour les publications, les photos, les réactions et les échanges immédiats. Le site devient la vitrine durable du Cercle : il permet de retrouver facilement les informations qui ne doivent pas disparaître au fil des publications et offre des pages directement accessibles depuis les moteurs de recherche.",
      "La rubrique Actualités assure le lien entre ces deux supports. Les principales publications publiques du Cercle y sont reprises sous une forme plus lisible, avec un titre, une présentation développée et un accès à la publication Facebook d’origine. Les personnes intéressées peuvent ainsi comprendre le sujet avant de choisir de consulter les photos ou les commentaires sur le réseau social.",
      "Le site permet aussi de mieux orienter les visiteurs selon leurs centres d’intérêt. Une personne qui recherche avant tout des jeux de société peut accéder directement à la présentation correspondante, tandis qu’un joueur intéressé par les cartes ou les figurines peut consulter les pages qui lui sont consacrées. Cette organisation évite de devoir retrouver une information au milieu d’un long fil de publications et rend la découverte du club plus simple.",
      "Les renseignements pratiques gagnent également en visibilité. Le site indique le cadre des rencontres et rassemble les éléments nécessaires pour savoir où se rendre et comment prendre contact avec le Cercle. Ces informations restent accessibles dans le temps, même lorsque de nouvelles publications sont ajoutées sur Facebook. Elles constituent ainsi un point de référence stable pour les nouveaux joueurs comme pour les membres habituels.",
      "Le site a enfin pour objectif de faciliter la découverte du Cercle par les joueurs de Vailhauquès et des communes voisines. Il donne une vue d’ensemble des activités et indique où trouver les renseignements pratiques pour rejoindre une soirée. La publication Facebook originale reste accessible en fin d’article pour retrouver l’annonce initiale et les réactions qui l’accompagnent."
    ];
    return { card: trimWords(paragraphs.slice(0, 3).join(" "), 180), paragraphs, sourceTooShort: true };
  }

  const topics = detectTopics(cleaned);
  const sentences = splitSentences(cleaned);
  const selected = sentences
    .map((sentence, index) => ({ sentence, index, score: sentenceScore(sentence, index, topics) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, Math.min(14, sentences.length))
    .sort((a, b) => a.index - b.index)
    .map(item => item.sentence);

  const source = selected.join(" ") || cleaned;
  const topicLabels = topics.map(topic => topic.label).join(", ");
  const intro = `Cette actualité du Cercle des Joueurs Paresseux concerne ${topicLabels}. ${source}`;
  const paragraphs = [trimWords(intro, 190)];
  if (wordCount(source) > 120) {
    const words = normalizeSpace(source).split(/\s+/);
    const midpoint = Math.ceil(words.length / 2);
    paragraphs.splice(0, 1,
      words.slice(0, midpoint).join(" "),
      words.slice(midpoint).join(" ")
    );
  }
  const card = trimWords(paragraphs.join(" "), 180);
  return { card, paragraphs, sourceTooShort: wordCount(cleaned) < 100 };
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

function articleBodyHtml(paragraphs, sourceTooShort) {
  const body = paragraphs.map(paragraph => `<p>${escapeHtml(paragraph)}</p>`).join("\n");
  const note = sourceTooShort
    ? '<p class="news-source-note">La publication Facebook disponible est courte ou tronquée. L’article développe uniquement les éléments vérifiables et le contexte propre au Cercle, sans ajouter de résultat, de date ou d’activité non mentionnés.</p>'
    : "";
  return `<div class="news-summary"><p class="eyebrow">L’essentiel</p>${body}${note}</div>`;
}
function sharedStyles() {
  return `
.page-hero{position:relative;overflow:hidden;background:radial-gradient(circle at 85% 20%,rgba(246,190,66,.28),transparent 28%),linear-gradient(135deg,#213c31 0%,#2f5746 58%,#3f6b56 100%)!important;color:#fff!important;padding:clamp(3.5rem,8vw,6.5rem) 0!important}
.page-hero::after{content:"";position:absolute;right:-90px;bottom:-210px;width:420px;height:420px;border-radius:50%;background:rgba(255,255,255,.06);pointer-events:none}
.page-hero .container{position:relative;z-index:1}.page-hero .eyebrow{color:#ffd56a!important;font-weight:800;letter-spacing:.14em}.page-hero h1{color:#fff!important;max-width:900px;text-shadow:0 3px 16px rgba(0,0,0,.24)}.page-hero .hero-intro{color:rgba(255,255,255,.95)!important;max-width:780px;font-size:clamp(1.05rem,2vw,1.3rem);line-height:1.65}
.news-grid{margin-top:1.5rem;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1.5rem;align-items:start}
.news-card{display:flex!important;flex-direction:column!important;min-width:0;overflow:hidden;background:#fff;border-radius:18px;box-shadow:0 10px 28px rgba(0,0,0,.09)}
.news-card-image{display:block!important;width:100%;height:180px!important;min-height:180px!important;max-height:180px!important;aspect-ratio:auto!important;overflow:hidden;background:#e7ece8}
.news-card-image img{display:block;width:100%;height:180px!important;min-height:180px!important;max-height:180px!important;object-fit:cover}
.news-card-body{display:flex;flex:1;flex-direction:column;padding:1.45rem!important;min-width:0}
.news-card-body .eyebrow{margin:0 0 .45rem;font-size:.76rem;line-height:1.3}
.news-card-body h2,.news-card h2{margin:0 0 .65rem!important;font-size:clamp(1.45rem,2.15vw,1.9rem)!important;line-height:1.12!important;letter-spacing:-.025em;overflow-wrap:anywhere}
.news-card-body h2 a{display:block;color:inherit;text-decoration:none}
.news-card-body>p:not(.eyebrow){line-height:1.68}.news-topic-line{font-size:.9rem!important;color:#52645b;margin:0 0 .9rem!important}.news-card-body .button{align-self:flex-start;margin-top:auto}
.news-summary{margin:0 0 1.75rem;padding:clamp(1.25rem,3vw,2rem);border-left:5px solid #d7a82f;border-radius:0 16px 16px 0;background:#f7f3e8}.news-summary>p:not(.eyebrow){margin:.75rem 0 0;font-size:1.06rem;line-height:1.78}.news-source-note{margin-top:1.25rem!important;padding-top:1rem;border-top:1px solid rgba(38,63,50,.16);font-size:.9rem!important;color:#5e655f}.news-main-image img{width:100%;max-height:560px;object-fit:contain;border-radius:18px}.news-topic-links{display:flex;gap:.6rem;flex-wrap:wrap;margin:1.25rem 0}
@media(max-width:820px){.news-grid{grid-template-columns:1fr}.news-card-image,.news-card-image img{height:190px!important;min-height:190px!important;max-height:190px!important}}
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
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)} | LCDJP</title><meta name="description" content="${escapeHtml(description)}"><meta name="robots" content="index, follow, max-image-preview:large"><link rel="canonical" href="${canonical}"><meta property="og:type" content="article"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${image}"><link rel="icon" href="../assets/images/logo-cercle-joueurs-paresseux.webp"><link rel="stylesheet" href="../assets/css/style.css"><style>${sharedStyles()}</style><script type="application/ld+json">${JSON.stringify(schema)}</script></head><body><a class="skip-link" href="#contenu">Aller au contenu</a><header class="site-header"><div class="container header-inner"><a class="brand" href="../index.html"><img src="../assets/images/logo-cercle-joueurs-paresseux.webp" alt="" width="72" height="72"><span><strong>Le Cercle des Joueurs Paresseux</strong><small>Club de jeux près de Montpellier</small></span></a><nav aria-label="Navigation principale" class="main-nav page-nav"><a href="../index.html">Accueil</a><a href="../jeux-de-societe.html">Jeux de société</a><a href="../jeux-de-cartes.html">Jeux de cartes</a><a href="../wargame.html">Wargame</a><a href="../actualites.html">Actualités</a></nav></div></header><main id="contenu"><section class="page-hero compact-hero"><div class="container"><p class="eyebrow">Dernières actualités</p><h1>${escapeHtml(title)}</h1><p class="hero-intro">Publié le ${escapeHtml(dateFr)} par le Cercle des Joueurs Paresseux.</p></div></section><section class="section"><article class="container prose news-article">${img}${articleBodyHtml(summaries.paragraphs, summaries.sourceTooShort)}<div class="news-topic-links">${links}</div>${sourceLink}<p><a href="../actualites.html">← Toutes les actualités du Cercle</a></p></article></section></main><footer class="site-footer"><div class="container footer-main"><div><strong>Le Cercle des Joueurs Paresseux</strong><span>Vendredi à 20 h 30 · Salle de l'Âge d'Or, Vailhauquès</span></div></div></footer></body></html>`;
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
