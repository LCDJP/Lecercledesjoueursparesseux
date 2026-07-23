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

const normalizeSpace = (value = "") =>
  String(value)
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
    .replace(/\b(J’aime|Commenter|Partager|Like|Comment|Share)\b/gi, " ")
    .replace(/\b\d+\s+(commentaire|commentaires|partage|partages|réaction|réactions)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectTopics(text) {
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

  if (!topics.length) {
    topics.push({
      label: "vie du club",
      href: "index.html"
    });
  }

  return topics;
}

function makeArticleTitle(post) {
  const text = cleanFacebookText(post.text);
  const date = new Date(post.date);
  const dateFr = Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric"
      }).format(date);

  const firstSentence = text
    .split(/[.!?]\s+/)[0]
    .replace(/\s+/g, " ")
    .trim();

  if (firstSentence.length >= 18 && firstSentence.length <= 78) {
    return firstSentence;
  }

  return `Actualité du Cercle des Joueurs Paresseux${dateFr ? ` – ${dateFr}` : ""}`;
}

function makeDescription(post) {
  const text = cleanFacebookText(post.text);
  const topics = detectTopics(text)
    .map(topic => topic.label)
    .slice(0, 3)
    .join(", ");

  const intro =
    `Dernières actualités du Cercle des Joueurs Paresseux à Vailhauquès, près de Montarnaud, Juvignac, Grabels, Gignac et Montpellier.`;

  const topicText = topics ? ` Au programme : ${topics}.` : "";
  const description = `${intro}${topicText} ${text}`.trim();

  return description.slice(0, 158);
}

function paragraphs(text) {
  const cleaned = String(text || "").trim();

  return cleaned
    .split(/\n{2,}|\r?\n/)
    .map(cleanFacebookText)
    .filter(Boolean)
    .map(paragraph => `<p>${escapeHtml(paragraph)}</p>`)
    .join("\n");
}

function articleHtml(post, slug, title, description) {
  const topics = detectTopics(post.text);
  const date = new Date(post.date);
  const iso = Number.isNaN(date.getTime())
    ? new Date().toISOString()
    : date.toISOString();

  const dateFr = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long"
  }).format(new Date(iso));

  const canonical = `${BASE_URL}actualites/${slug}.html`;
  const image = post.local_image
    ? `${BASE_URL}${post.local_image}`
    : `${BASE_URL}assets/images/logo-cercle-joueurs-paresseux.webp`;

  const links = topics
    .map(topic =>
      `<a class="button button-ghost" href="../${topic.href}">${escapeHtml(topic.label)}</a>`
    )
    .join("\n");

  const sourceLink = post.url
    ? `<p><a class="button button-primary" href="${escapeHtml(post.url)}" rel="noopener noreferrer" target="_blank">Voir la publication Facebook</a></p>`
    : "";

  const img = post.local_image
    ? `<figure class="news-main-image"><img src="../${escapeHtml(post.local_image)}" alt="Illustration de l'actualité du Cercle des Joueurs Paresseux" loading="lazy"></figure>`
    : "";

  const schema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title,
    description,
    datePublished: iso,
    dateModified: iso,
    mainEntityOfPage: canonical,
    image: [image],
    author: {
      "@type": "Organization",
      name: "Le Cercle des Joueurs Paresseux",
      url: BASE_URL
    },
    publisher: {
      "@type": "Organization",
      name: "Le Cercle des Joueurs Paresseux",
      logo: {
        "@type": "ImageObject",
        url: `${BASE_URL}assets/images/logo-cercle-joueurs-paresseux.webp`
      }
    },
    contentLocation: {
      "@type": "Place",
      name: "Salle de l'Âge d'Or",
      address: {
        "@type": "PostalAddress",
        streetAddress: "19 Route de Montarnaud",
        postalCode: "34570",
        addressLocality: "Vailhauquès",
        addressCountry: "FR"
      }
    }
  };

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} | LCDJP</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="article">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${image}">
<meta property="og:locale" content="fr_FR">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="../assets/images/logo-cercle-joueurs-paresseux.webp">
<link rel="stylesheet" href="../assets/css/style.css">
<script type="application/ld+json">${JSON.stringify(schema)}</script>
</head>
<body>
<a class="skip-link" href="#contenu">Aller au contenu</a>
<header class="site-header">
<div class="container header-inner">
<a class="brand" href="../index.html">
<img src="../assets/images/logo-cercle-joueurs-paresseux.webp" alt="" width="72" height="72">
<span>
<strong>Le Cercle des Joueurs Paresseux</strong>
<small>Club de jeux près de Montpellier</small>
</span>
</a>
<nav aria-label="Navigation principale" class="main-nav page-nav">
<a href="../index.html">Accueil</a>
<a href="../jeux-de-societe.html">Jeux de société</a>
<a href="../jeux-de-cartes.html">Jeux de cartes</a>
<a href="../wargame.html">Wargame</a>
<a href="../actualites.html">Actualités</a>
</nav>
</div>
</header>

<main id="contenu">
<section class="page-hero compact-hero">
<div class="container">
<p class="eyebrow">Dernières actualités</p>
<h1>${escapeHtml(title)}</h1>
<p class="hero-intro">Publié le ${escapeHtml(dateFr)} par le Cercle des Joueurs Paresseux.</p>
</div>
</section>

<section class="section">
<article class="container prose news-article">
${img}
${paragraphs(post.text)}
<div class="news-topic-links">${links}</div>
${sourceLink}
<p><a href="../actualites.html">← Toutes les actualités du Cercle</a></p>
</article>
</section>
</main>

<footer class="site-footer">
<div class="container footer-main">
<div>
<strong>Le Cercle des Joueurs Paresseux</strong>
<span>Vendredi à 20 h 30 · Salle de l'Âge d'Or, Vailhauquès</span>
</div>
</div>
</footer>
</body>
</html>`;
}

function card(post, slug, title, description) {
  const date = new Date(post.date);
  const dateFr = Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "long"
      }).format(date);

  const img = post.local_image
    ? `<img src="${escapeHtml(post.local_image)}" alt="" loading="lazy">`
    : `<img src="assets/images/logo-cercle-joueurs-paresseux.webp" alt="" loading="lazy">`;

  return `<article class="news-card">
<a class="news-card-image" href="actualites/${slug}.html">${img}</a>
<div class="news-card-body">
<p class="eyebrow">${escapeHtml(dateFr)}</p>
<h2><a href="actualites/${slug}.html">${escapeHtml(title)}</a></h2>
<p>${escapeHtml(description)}</p>
<a class="button button-primary" href="actualites/${slug}.html">Lire l'actualité</a>
</div>
</article>`;
}

const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

const uniquePosts = [];

for (const post of (data.posts || [])) {
  if (!post?.text || !post?.date) continue;

  const key = post.id ||
    crypto.createHash("sha1")
      .update(`${post.date}|${cleanFacebookText(post.text)}`)
      .digest("hex");

  const textKey = cleanFacebookText(post.text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .slice(0, 260);

  const existingIndex = uniquePosts.findIndex(item =>
    item.key === key ||
    item.textKey === textKey ||
    item.textKey.includes(textKey) ||
    textKey.includes(item.textKey)
  );

  if (existingIndex === -1) {
    uniquePosts.push({ ...post, key, textKey });
  } else if (post.text.length > uniquePosts[existingIndex].text.length) {
    uniquePosts[existingIndex] = {
      ...post,
      key: uniquePosts[existingIndex].key,
      textKey
    };
  }
}

uniquePosts.sort((a, b) => new Date(b.date) - new Date(a.date));

// Supprime les anciennes pages générées afin d'éliminer physiquement les doublons.
for (const file of fs.readdirSync(NEWS_DIR)) {
  if (file.endsWith(".html")) {
    fs.unlinkSync(path.join(NEWS_DIR, file));
  }
}

const cards = [];
const sitemapUrls = [];

for (const post of uniquePosts) {
  const title = makeArticleTitle(post);
  const date = new Date(post.date);
  const prefix = Number.isNaN(date.getTime())
    ? "actualite"
    : date.toISOString().slice(0, 10);

  const slug = `${prefix}-${slugify(title)}-${post.key.slice(0, 8)}`;
  const description = makeDescription(post);

  fs.writeFileSync(
    path.join(NEWS_DIR, `${slug}.html`),
    articleHtml(post, slug, title, description),
    "utf8"
  );

  cards.push(card(post, slug, title, description));

  sitemapUrls.push({
    loc: `${BASE_URL}actualites/${slug}.html`,
    lastmod: Number.isNaN(date.getTime())
      ? new Date().toISOString().slice(0, 10)
      : date.toISOString().slice(0, 10)
  });
}

const emptyState = `<div class="info-card">
<h2>Les actualités arrivent bientôt</h2>
<p>Cette page est alimentée automatiquement à partir des publications publiques de la page Facebook du club.</p>
<p><a class="button button-primary" href="${data.source || "#"}" target="_blank" rel="noopener noreferrer">Voir notre page Facebook</a></p>
</div>`;

const indexSchema = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "Dernières actualités du Cercle des Joueurs Paresseux",
  url: `${BASE_URL}actualites.html`,
  description: "Dernières actualités, publications, événements et photos du Cercle des Joueurs Paresseux à Vailhauquès, près de Montpellier."
};

const indexHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Dernières actualités du Cercle des Joueurs Paresseux | LCDJP</title>
<meta name="description" content="Dernières actualités, événements, jeux et photos du Cercle des Joueurs Paresseux à Vailhauquès, près de Montarnaud, Juvignac, Grabels, Gignac et Montpellier.">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="${BASE_URL}actualites.html">
<meta property="og:type" content="website">
<meta property="og:title" content="Dernières actualités du Cercle des Joueurs Paresseux">
<meta property="og:description" content="Retrouvez les dernières publications et nouvelles du Cercle des Joueurs Paresseux.">
<meta property="og:url" content="${BASE_URL}actualites.html">
<meta property="og:image" content="${BASE_URL}assets/images/logo-cercle-joueurs-paresseux.webp">
<link rel="icon" href="assets/images/logo-cercle-joueurs-paresseux.webp">
<link rel="stylesheet" href="assets/css/style.css">
<script type="application/ld+json">${JSON.stringify(indexSchema)}</script>
</head>
<body>
<a class="skip-link" href="#contenu">Aller au contenu</a>

<header class="site-header">
<div class="container header-inner">
<a class="brand" href="index.html">
<img src="assets/images/logo-cercle-joueurs-paresseux.webp" alt="" width="72" height="72">
<span>
<strong>Le Cercle des Joueurs Paresseux</strong>
<small>Club de jeux près de Montpellier</small>
</span>
</a>

<nav aria-label="Navigation principale" class="main-nav page-nav">
<a href="index.html">Accueil</a>
<a href="jeux-de-societe.html">Jeux de société</a>
<a href="jeux-de-cartes.html">Jeux de cartes</a>
<a href="wargame.html">Wargame</a>
<a aria-current="page" href="actualites.html">Actualités</a>
<a class="nav-cta" href="index.html#venir">Nous rejoindre</a>
</nav>
</div>
</header>

<main id="contenu">
<section class="page-hero compact-hero">
<div class="container">
<p class="eyebrow">La vie du club</p>
<h1>Dernières actualités du Cercle des Joueurs Paresseux</h1>
<p class="hero-intro">Retrouvez ici les dernières publications, annonces, événements, photos et nouvelles du club à Vailhauquès, près de Montarnaud, Juvignac, Grabels, Gignac et Montpellier.</p>
</div>
</section>

<section class="section">
<div class="container news-grid">
${cards.length ? cards.join("\n") : emptyState}
</div>
</section>
</main>

<footer class="site-footer">
<div class="container footer-main">
<div>
<strong>Le Cercle des Joueurs Paresseux</strong>
<span>Vendredi à 20 h 30 · Salle de l'Âge d'Or, Vailhauquès</span>
</div>
</div>
</footer>
</body>
</html>`;

fs.writeFileSync(INDEX_FILE, indexHtml, "utf8");

let sitemap = fs.existsSync(SITEMAP_FILE)
  ? fs.readFileSync(SITEMAP_FILE, "utf8")
  : `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`;

sitemap = sitemap.replace(
  /\s*<url>\s*<loc>https:\/\/lcdjp\.github\.io\/Lecercledesjoueursparesseux\/actualites\/.*?<\/url>\s*/gs,
  "\n"
);

if (!sitemap.includes(`${BASE_URL}actualites.html`)) {
  sitemap = sitemap.replace(
    "</urlset>",
    `<url><loc>${BASE_URL}actualites.html</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>\n</urlset>`
  );
}

const newsXml = sitemapUrls
  .map(item =>
    `<url><loc>${item.loc}</loc><lastmod>${item.lastmod}</lastmod><changefreq>monthly</changefreq><priority>0.65</priority></url>`
  )
  .join("\n");

sitemap = sitemap.replace(
  "</urlset>",
  `${newsXml ? newsXml + "\n" : ""}</urlset>`
);

fs.writeFileSync(SITEMAP_FILE, sitemap, "utf8");

console.log(`Actualités uniques générées : ${uniquePosts.length}`);
