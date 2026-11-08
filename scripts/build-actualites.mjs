import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const BASE_URL = "https://lcdjp.github.io/Lecercledesjoueursparesseux/";
const DATA_FILE = path.join(ROOT, "data", "facebook-posts.json");
const NEWS_DIR = path.join(ROOT, "actualites");
const INDEX_FILE = path.join(ROOT, "actualites.html");
const SITEMAP_FILE = path.join(ROOT, "sitemap.xml");
const NEWS_PER_PAGE = 8;
fs.mkdirSync(NEWS_DIR, { recursive: true });

const escapeHtml = (value = "") => String(value)
 .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
 .replaceAll('"',"&quot;").replaceAll("'","&#039;");
const normalizeSpace = value => String(value || "").replace(/<[^>]*>/g," ").replace(/\u00a0/g," ").replace(/\s+/g," ").trim();

function cleanFacebookText(value = "") {
 let text = normalizeSpace(value);
 // Retire uniquement l'en-tête de la page et les marqueurs connus de l'interface.
 text = text.replace(/^Le Cercle des Joueurs Paresseux\s*/i, "");
 text = text.replace(/^\d{1,2}\s+(?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+à\s+\d{1,2}:\d{2}\s*[·•-]\s*/i,"");
 text = text.replace(/^(?:il y a )?\d+\s*(?:minutes?|heures?|jours?|semaines?|mois)(?:\s+\d+\s*(?:min|h|j))?\s*[·•-]\s*/i,"");
 text = text.replace(/^\d+\s*(?:min|h|j|sem\.?)\s*[·•-]\s*/i,"");
 const markers = [/\s+Toutes les réactions\s*:?/i,/\s+\d+\s+de commentaires?\b/i,/\s+J’aime\s+Commenter\b/i,/\s+Partagé avec\s*:\s*Public/i,/\s+Contenu IA\s*[·•]/i];
 for (const marker of markers) { const i=text.search(marker); if(i>=0) text=text.slice(0,i).trim(); }
 text=text.replace(/\s+[Vv]…(?:\s+En)?\s*$/u,"…").replace(/\s+/g," ").trim();
 return text;
}
function isPublishablePost(post) {
 if (!post?.text) return false;
 // Les extractions de secours Facebook contiennent fréquemment des commentaires/UI.
 if (post.text_source === "facebook-article-fallback") return false;
 const t=cleanFacebookText(post.text);
 return t.length>=18 && /[A-Za-zÀ-ÿ]{3}/.test(t) &&
   !/^(?:Le Cercle des Joueurs Paresseux)?\s*(?:Contenu IA|Toutes les réactions|J’aime|Commenter)/i.test(t);
}
function fingerprint(text) {
 return cleanFacebookText(text).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim();
}
function similar(a,b) {
 const x=fingerprint(a), y=fingerprint(b);
 if(!x||!y) return false;
 if(x===y || x.startsWith(y) || y.startsWith(x)) return true;
 const ax=new Set(x.split(" ").filter(w=>w.length>3)), by=new Set(y.split(" ").filter(w=>w.length>3));
 const overlap=[...ax].filter(w=>by.has(w)).length;
 return overlap>=12 && overlap/Math.min(ax.size,by.size)>.88;
}
function titleFor(post) {
 const t=cleanFacebookText(post.text);
 const first=t.split(/(?<=[.!?])\s+/u)[0] || t;
 return first.length>78 ? `${first.slice(0,75).replace(/\s+\S*$/,"")}…` : first;
}
function makeDescription(text) { return text.slice(0,155); }
function detectTopics(text="") {
 const v=text.toLowerCase(), out=[];
 if(/warhammer|figurine|wargame|age of sigmar|kill team/.test(v)) out.push(["Jeux de figurines","wargame.html"]);
 if(/magic|lorcana|altered|pokémon|pokemon/.test(v)) out.push(["Jeux de cartes","jeux-de-cartes.html"]);
 if(/jeu|soirée|joueurs|partie|brunch/.test(v)) out.push(["Jeux de société","jeux-de-societe.html"]);
 return out.length?out:[["Vie du club","index.html"]];
}
function teaser(text, lines) {
 // Une ligne visuelle est approximée par 18 mots : stable sur mobile et desktop.
 const words=text.split(/\s+/).filter(Boolean);
 const limit=lines*18;
 return words.length<=limit ? text : words.slice(0,limit).join(" ")+"…";
}
function sharedStyles() {
  return `
.page-hero{position:relative;overflow:hidden;background:radial-gradient(circle at 85% 20%,rgba(246,190,66,.28),transparent 28%),linear-gradient(135deg,#213c31 0%,#2f5746 58%,#3f6b56 100%)!important;color:#fff!important;padding:clamp(3.25rem,7vw,5.75rem) 0!important}
.page-hero::after{content:"";position:absolute;right:-90px;bottom:-210px;width:420px;height:420px;border-radius:50%;background:rgba(255,255,255,.06);pointer-events:none}
.page-hero .container{position:relative;z-index:1}.page-hero .eyebrow{color:#ffd56a!important;font-weight:800;letter-spacing:.14em}.page-hero h1{color:#fff!important;max-width:900px;font-size:clamp(2rem,5vw,4rem)!important;line-height:1.08!important;text-shadow:0 3px 16px rgba(0,0,0,.24)}.page-hero .hero-intro{color:rgba(255,255,255,.95)!important;max-width:780px;font-size:clamp(1.02rem,2vw,1.22rem);line-height:1.65}
.news-grid{margin-top:1.5rem;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1.5rem;align-items:start}.news-card{display:flex!important;flex-direction:column!important;min-width:0;overflow:hidden;border-radius:18px;background:#fff;box-shadow:0 12px 32px rgba(31,48,39,.10)}.news-card-image{display:block;width:100%;height:180px;overflow:hidden;background:#e7ece8;flex:0 0 180px}.news-card-image img{display:block;width:100%;height:180px;object-fit:cover}.news-card-body{padding:1.35rem 1.4rem 1.5rem;min-width:0}.news-card-body .eyebrow{margin:0 0 .45rem;font-size:.78rem}.news-card-body h2{margin:.1rem 0 .55rem!important;font-size:clamp(1.35rem,2.2vw,1.85rem)!important;line-height:1.18!important;overflow-wrap:anywhere}.news-card-body h2 a{color:inherit;text-decoration:none}.news-card-body>p:not(.eyebrow){line-height:1.65}.news-topic-line{font-size:.9rem;color:#52645b;margin:.2rem 0 .85rem}.news-summary{margin:0 0 1.75rem;padding:1.35rem 1.5rem;border-left:5px solid #d7a82f;border-radius:0 16px 16px 0;background:#f7f3e8}.news-summary>p:not(.eyebrow){margin:.8rem 0;font-size:1.06rem;line-height:1.78}.news-source-note{margin-top:1.15rem!important;padding-top:1rem;border-top:1px solid rgba(70,80,73,.18);font-size:.9rem!important;color:#5e655f}.news-article .news-main-image{float:none!important;display:block!important;clear:both!important;width:100%!important;max-width:100%!important;margin:0 0 1.6rem!important}.news-article .news-main-image img{float:none!important;display:block!important;clear:both!important;width:100%!important;max-width:100%!important;height:auto!important;max-height:560px;object-fit:contain;border-radius:18px}.news-article .news-raw{float:none!important;clear:both!important;width:100%!important;max-width:100%!important}.news-card-body .news-raw{float:none!important;clear:both!important;width:100%!important;max-width:100%!important}.news-topic-links{display:flex;gap:.6rem;flex-wrap:wrap;margin:1.25rem 0}
.news-pagination{display:flex;justify-content:center;align-items:center;gap:.5rem;flex-wrap:wrap;margin:2.25rem auto .5rem}
.news-pagination a,.news-pagination span{display:inline-flex;align-items:center;justify-content:center;min-width:2.6rem;min-height:2.6rem;padding:.55rem .8rem;border:1px solid rgba(38,63,50,.2);border-radius:999px;text-decoration:none;font-weight:800;background:#fff;color:#263f32}
.news-pagination a:hover{border-color:#263f32;background:#f4f1e8}
.news-pagination .current{background:#263f32;color:#fff;border-color:#263f32}
.news-pagination .wide{padding-left:1rem;padding-right:1rem}
.news-count{text-align:center;color:#657269;font-size:.92rem;margin-top:1rem}
@media(max-width:820px){.news-grid{grid-template-columns:1fr}.news-card-image,.news-card-image img{height:175px;flex-basis:175px}}
`;
}

function articleHtml(post,slug,title,description) {
 const text=cleanFacebookText(post.text), date=new Date(post.date);
 const dateFr=Number.isNaN(date.getTime())?"":new Intl.DateTimeFormat("fr-FR",{dateStyle:"long"}).format(date);
 const image=post.local_image?`<figure class="news-main-image"><img src="../${escapeHtml(post.local_image)}" alt="Photo de l'actualité du Cercle" loading="lazy"></figure>`:"";
 const source=post.url?`<p class="news-source"><a class="button button-primary" href="${escapeHtml(post.url)}" target="_blank" rel="noopener noreferrer">Lire la suite sur Facebook</a></p>`:"";
 const topics=detectTopics(text).map(([label,href])=>`<a class="button button-ghost" href="../${href}">${escapeHtml(label)}</a>`).join(" ");
 const schema={"@context":"https://schema.org","@type":"BlogPosting",headline:title,description,datePublished:post.date,mainEntityOfPage:`${BASE_URL}actualites/${slug}.html`};
 return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} | LCDJP</title><meta name="description" content="${escapeHtml(description)}"><link rel="canonical" href="${BASE_URL}actualites/${slug}.html"><link rel="stylesheet" href="../assets/css/style.css"><style>${sharedStyles()} .news-raw{white-space:normal;line-height:1.8;font-size:1.05rem}.news-raw.clamped{display:-webkit-box!important;float:none!important;clear:both!important;width:100%!important;max-width:100%!important;-webkit-line-clamp:10;-webkit-box-orient:vertical;overflow:hidden}</style><script type="application/ld+json">${JSON.stringify(schema)}</script></head><body><header class="site-header"><div class="container header-inner"><a class="brand" href="../index.html"><strong>Le Cercle des Joueurs Paresseux</strong></a><nav class="main-nav"><a href="../index.html">Accueil</a><a href="../actualites.html">Actualités</a></nav></div></header><main><section class="page-hero compact-hero"><div class="container"><p class="eyebrow">Actualité du club</p><h1>${escapeHtml(title)}</h1><p class="hero-intro">${escapeHtml(dateFr)}</p></div></section><section class="section"><article class="container prose news-article">${image}<div class="news-raw clamped" id="article-text">${escapeHtml(text)}</div><p><button class="button button-ghost" id="expand-text" type="button">Afficher le texte complet</button></p>${source}<div class="news-topic-links">${topics}</div><p><a href="../actualites.html">← Toutes les actualités</a></p></article></section></main><script>document.getElementById("expand-text").addEventListener("click",function(){document.getElementById("article-text").classList.remove("clamped");this.remove();});</script></body></html>`;
}
function card(post,slug,title) {
 const text=cleanFacebookText(post.text), date=new Date(post.date);
 const dateFr=Number.isNaN(date.getTime())?"":new Intl.DateTimeFormat("fr-FR",{dateStyle:"long"}).format(date);
 const img=post.local_image?`<img src="${escapeHtml(post.local_image)}" alt="" loading="lazy">`:"";
 const topics=detectTopics(text).map(x=>x[0]).join(" · ");
 return `<article class="news-card"><a class="news-card-image" href="actualites/${slug}.html">${img}</a><div class="news-card-body"><p class="eyebrow">${escapeHtml(dateFr)}</p><h2><a href="actualites/${slug}.html">${escapeHtml(title)}</a></h2><p class="news-topic-line">${escapeHtml(topics)}</p><p class="news-raw clamped-card">${escapeHtml(teaser(text,5))}</p><a class="button button-primary" href="actualites/${slug}.html">Lire l'article</a></div></article>`;
}
if(!fs.existsSync(DATA_FILE)) throw new Error(`Fichier introuvable : ${DATA_FILE}`);
const data=JSON.parse(fs.readFileSync(DATA_FILE,"utf8"));
const unique=[];
for(const p of (data.posts||[]).filter(isPublishablePost)) {
 const idx=unique.findIndex(q=>similar(q.text,p.text));
 if(idx<0) unique.push(p);
 else {
  const old=unique[idx];
  // Garder la version la plus complète, et la date la plus ancienne connue.
  const best=(p.text||"").length>(old.text||"").length?p:old;
  unique[idx]={...old,...best,date:new Date(Math.min(new Date(old.date).getTime(),new Date(p.date).getTime())).toISOString(),local_image:old.local_image||p.local_image||null,url:old.url||p.url};
 }
}
unique.sort((a,b)=>new Date(b.date)-new Date(a.date));
for(const f of fs.readdirSync(NEWS_DIR)) if(f.endsWith(".html")) fs.unlinkSync(path.join(NEWS_DIR,f));
const cards=[], urls=[];
for(const p of unique) {
 const text=cleanFacebookText(p.text), title=titleFor(p);
 const slug=`${new Date(p.date).toISOString().slice(0,10)}-${crypto.createHash("sha1").update(fingerprint(text)).digest("hex").slice(0,8)}`;
 const desc=makeDescription(text);
 fs.writeFileSync(path.join(NEWS_DIR,`${slug}.html`),articleHtml(p,slug,title,desc),"utf8");
 cards.push(card(p,slug,title));
 urls.push(`<url><loc>${BASE_URL}actualites/${slug}.html</loc><lastmod>${p.date.slice(0,10)}</lastmod></url>`);
}
function pageFile(n){return n===1?"actualites.html":`actualites-page-${n}.html`;}
function pageHtml(items,n,total) {
 const intro=n===1?"Les dernières publications du Cercle des Joueurs Paresseux.":"Archives des publications du Cercle des Joueurs Paresseux.";
 const pager=total>1?`<nav class="news-pagination">${n>1?`<a href="${pageFile(n-1)}">← Plus récentes</a>`:""} ${Array.from({length:total},(_,i)=>i+1).map(i=>i===n?`<span class="current">${i}</span>`:`<a href="${pageFile(i)}">${i}</a>`).join(" ")} ${n<total?`<a href="${pageFile(n+1)}">Plus anciennes →</a>`:""}</nav>`:"";
 return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Actualités du Cercle des Joueurs Paresseux${n>1?` – page ${n}`:""}</title><meta name="description" content="Les actualités du Cercle des Joueurs Paresseux à Vailhauquès."><link rel="canonical" href="${BASE_URL}${pageFile(n)}"><link rel="stylesheet" href="assets/css/style.css"><style>${sharedStyles()}.clamped-card{display:-webkit-box!important;float:none!important;clear:both!important;width:100%!important;max-width:100%!important;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden;line-height:1.65}.news-card-image img{width:100%;height:180px;object-fit:cover}</style></head><body><header class="site-header"><div class="container header-inner"><a class="brand" href="index.html"><strong>Le Cercle des Joueurs Paresseux</strong></a><nav class="main-nav"><a href="index.html">Accueil</a><a href="actualites.html">Actualités</a></nav></div></header><main><section class="page-hero compact-hero"><div class="container"><p class="eyebrow">La vie du club</p><h1>Actualités</h1><p class="hero-intro">${intro}</p></div></section><section class="section"><div class="container news-grid">${items.join("")||"<p>Aucune actualité disponible.</p>"}</div><div class="container"><p class="news-count">${unique.length} publication(s) conservée(s).</p>${pager}</div></section></main></body></html>`;
}
const pages=Math.max(1,Math.ceil(cards.length/NEWS_PER_PAGE));
for(const f of fs.readdirSync(ROOT)) if(/^actualites-page-\d+\.html$/i.test(f)) fs.unlinkSync(path.join(ROOT,f));
for(let n=1;n<=pages;n++) fs.writeFileSync(path.join(ROOT,pageFile(n)),pageHtml(cards.slice((n-1)*NEWS_PER_PAGE,n*NEWS_PER_PAGE),n,pages),"utf8");
let sitemap=fs.existsSync(SITEMAP_FILE)?fs.readFileSync(SITEMAP_FILE,"utf8"):`<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`;
sitemap=sitemap.replace(/<url>\s*<loc>https:\/\/lcdjp\.github\.io\/Lecercledesjoueursparesseux\/actualites\/.*?<\/url>/gs,"").replace(/<url>\s*<loc>https:\/\/lcdjp\.github\.io\/Lecercledesjoueursparesseux\/actualites-page-\d+\.html<\/loc>.*?<\/url>/gs,"");
const pageUrls=Array.from({length:pages},(_,i)=>`<url><loc>${BASE_URL}${pageFile(i+1)}</loc></url>`).join("\
");
sitemap=sitemap.replace("</urlset>",`${pageUrls}\
${urls.join("\
")}\
</urlset>`);
fs.writeFileSync(SITEMAP_FILE,sitemap,"utf8");
console.log(`Actualités générées : ${unique.length} publications uniques, ${pages} page(s).`);
