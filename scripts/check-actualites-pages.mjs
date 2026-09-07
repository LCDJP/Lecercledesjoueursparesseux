import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const entryFiles = ["actualites.html"];
const archivePattern = /^actualites-page-(\d+)\.html$/i;

for (const name of fs.readdirSync(ROOT)) {
  if (archivePattern.test(name)) entryFiles.push(name);
}

const missing = new Set();
const links = new Set();

for (const file of entryFiles) {
  const fullPath = path.join(ROOT, file);
  if (!fs.existsSync(fullPath)) continue;
  const html = fs.readFileSync(fullPath, "utf8");
  const regex = /href=["'](actualites-page-\d+\.html)["']/gi;
  for (const match of html.matchAll(regex)) {
    links.add(match[1]);
    if (!fs.existsSync(path.join(ROOT, match[1]))) missing.add(match[1]);
  }
}

if (missing.size) {
  console.error("ERREUR : page(s) d'archives référencée(s) mais absente(s) :");
  for (const file of missing) console.error(` - ${file}`);
  process.exit(1);
}

const archives = entryFiles
  .filter(name => archivePattern.test(name))
  .sort((a, b) => Number(a.match(archivePattern)[1]) - Number(b.match(archivePattern)[1]));

console.log(`Contrôle archives OK : ${archives.length} page(s) d'archives présente(s), ${links.size} lien(s) d'archives vérifié(s).`);
