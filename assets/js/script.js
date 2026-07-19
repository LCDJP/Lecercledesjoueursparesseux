const navToggle = document.querySelector(".nav-toggle");
const mainNav = document.querySelector(".main-nav");

function closeMenu() {
  if (!navToggle || !mainNav) return;
  mainNav.classList.remove("is-open");
  navToggle.setAttribute("aria-expanded", "false");
  document.body.classList.remove("menu-open");
}

if (navToggle && mainNav) {
  navToggle.addEventListener("click", () => {
    const isOpen = mainNav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
    document.body.classList.toggle("menu-open", isOpen);
  });

  mainNav.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeMenu));

  document.addEventListener("click", (event) => {
    if (mainNav.classList.contains("is-open") && !mainNav.contains(event.target) && !navToggle.contains(event.target)) {
      closeMenu();
    }
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 860) closeMenu();
  });
}

const year = document.querySelector("#current-year");
if (year) year.textContent = new Date().getFullYear();

const revealTargets = document.querySelectorAll(
  ".universe-card, .manifesto, .step, .practical-item, .location-card, details"
);

if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  revealTargets.forEach((element) => {
    element.classList.add("reveal");
    observer.observe(element);
  });
}

function makeAltText(filename) {
  const readable = filename.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  return readable
    ? `${readable.charAt(0).toUpperCase()}${readable.slice(1)} — Le Cercle des Joueurs Paresseux`
    : "Photo du Cercle des Joueurs Paresseux";
}

let galleryImages = [];
let currentImageIndex = 0;
let lastFocusedElement = null;
let touchStartX = 0;

function createLightbox() {
  if (document.querySelector("#gallery-lightbox")) return;
  const lightbox = document.createElement("div");
  lightbox.id = "gallery-lightbox";
  lightbox.className = "lightbox";
  lightbox.hidden = true;
  lightbox.setAttribute("role", "dialog");
  lightbox.setAttribute("aria-modal", "true");
  lightbox.setAttribute("aria-label", "Photo agrandie");
  lightbox.innerHTML = `
    <button class="lightbox-close" type="button" aria-label="Fermer la photo">×</button>
    <button class="lightbox-nav lightbox-prev" type="button" aria-label="Photo précédente">‹</button>
    <figure class="lightbox-figure">
      <img class="lightbox-image" src="" alt="">
      <figcaption class="lightbox-caption" aria-live="polite"></figcaption>
    </figure>
    <button class="lightbox-nav lightbox-next" type="button" aria-label="Photo suivante">›</button>
  `;
  document.body.appendChild(lightbox);

  lightbox.querySelector(".lightbox-close").addEventListener("click", closeLightbox);
  lightbox.querySelector(".lightbox-prev").addEventListener("click", () => showLightboxImage(currentImageIndex - 1));
  lightbox.querySelector(".lightbox-next").addEventListener("click", () => showLightboxImage(currentImageIndex + 1));
  lightbox.addEventListener("click", (event) => { if (event.target === lightbox) closeLightbox(); });
  lightbox.addEventListener("touchstart", (event) => { touchStartX = event.changedTouches[0].clientX; }, { passive: true });
  lightbox.addEventListener("touchend", (event) => {
    const distance = event.changedTouches[0].clientX - touchStartX;
    if (Math.abs(distance) > 50) showLightboxImage(currentImageIndex + (distance < 0 ? 1 : -1));
  }, { passive: true });
}

function showLightboxImage(index) {
  const lightbox = document.querySelector("#gallery-lightbox");
  if (!lightbox || galleryImages.length === 0) return;
  currentImageIndex = (index + galleryImages.length) % galleryImages.length;
  const source = galleryImages[currentImageIndex];
  const image = lightbox.querySelector(".lightbox-image");
  image.src = source.currentSrc || source.src;
  image.alt = source.alt;
  lightbox.querySelector(".lightbox-caption").textContent = `${source.alt} — ${currentImageIndex + 1} / ${galleryImages.length}`;
}

function openLightbox(index, trigger) {
  createLightbox();
  const lightbox = document.querySelector("#gallery-lightbox");
  lastFocusedElement = trigger;
  showLightboxImage(index);
  lightbox.hidden = false;
  document.body.classList.add("lightbox-open");
  lightbox.querySelector(".lightbox-close").focus();
}

function closeLightbox() {
  const lightbox = document.querySelector("#gallery-lightbox");
  if (!lightbox || lightbox.hidden) return;
  lightbox.hidden = true;
  document.body.classList.remove("lightbox-open");
  if (lastFocusedElement) lastFocusedElement.focus();
}

document.addEventListener("keydown", (event) => {
  const lightbox = document.querySelector("#gallery-lightbox");
  if (!lightbox || lightbox.hidden) return;
  if (event.key === "Escape") closeLightbox();
  if (event.key === "ArrowLeft") showLightboxImage(currentImageIndex - 1);
  if (event.key === "ArrowRight") showLightboxImage(currentImageIndex + 1);
});

async function loadAutomaticGallery() {
  const gallery = document.querySelector(".gallery-grid");
  if (!gallery) return;

  try {
    const response = await fetch(`assets/data/gallery.json?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);
    const files = await response.json();

    if (!Array.isArray(files) || files.length === 0) {
      gallery.innerHTML = '<div class="gallery-empty">La galerie sera bientôt enrichie de nouvelles photos.</div>';
      return;
    }

    gallery.innerHTML = "";
    files.forEach((filename, index) => {
      const figure = document.createElement("figure");
      figure.className = "gallery-tile gallery-photo";
      if (index === 0) figure.classList.add("tile-large");
      else if (index === 4) figure.classList.add("tile-wide");

      const button = document.createElement("button");
      button.type = "button";
      button.className = "gallery-button";
      button.setAttribute("aria-label", `Agrandir : ${makeAltText(filename)}`);

      const image = document.createElement("img");
      image.src = `assets/images/galerie/${encodeURIComponent(filename)}`;
      image.alt = makeAltText(filename);
      image.loading = index < 2 ? "eager" : "lazy";
      image.decoding = "async";

      button.appendChild(image);
      figure.appendChild(button);
      gallery.appendChild(figure);
    });

    galleryImages = Array.from(gallery.querySelectorAll("img"));
    gallery.querySelectorAll(".gallery-button").forEach((button, index) => {
      button.addEventListener("click", () => openLightbox(index, button));
    });
  } catch (error) {
    console.error("Impossible de charger la galerie automatique :", error);
    gallery.innerHTML = '<div class="gallery-empty">La galerie est momentanément indisponible.</div>';
  }
}

createLightbox();
loadAutomaticGallery();
