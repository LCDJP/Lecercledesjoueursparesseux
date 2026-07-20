#!/usr/bin/env python3
from pathlib import Path
from PIL import Image
import re, unicodedata

ROOT = Path(__file__).resolve().parents[1]
GALLERY = ROOT / "assets" / "images" / "galerie"
SUPPORTED = {".jpg", ".jpeg", ".png"}

def slugify(value):
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-zA-Z0-9]+", "-", value).strip("-").lower() or "photo-club-jeux"

for source in sorted(GALLERY.glob("*")) if GALLERY.exists() else []:
    if source.suffix.lower() not in SUPPORTED:
        continue
    name = slugify(source.stem)
    if not name.startswith("cercle-joueurs-paresseux-"):
        name = "cercle-joueurs-paresseux-" + name
    target = source.with_name(name + ".webp")
    with Image.open(source) as image:
        image = image.convert("RGB")
        if image.width > 1800:
            ratio = 1800 / image.width
            image = image.resize((1800, round(image.height * ratio)), Image.Resampling.LANCZOS)
        image.save(target, "WEBP", quality=82, method=6)
    print(f"{source.name} -> {target.name}")
