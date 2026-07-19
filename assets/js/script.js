const navToggle = document.querySelector(".nav-toggle");
const mainNav = document.querySelector(".main-nav");

if (navToggle && mainNav) {
  navToggle.addEventListener("click", () => {
    const isOpen = mainNav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
    document.body.classList.toggle("menu-open", isOpen);
  });

  mainNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      mainNav.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
      document.body.classList.remove("menu-open");
    });
  });
}

const year = document.querySelector("#current-year");
if (year) {
  year.textContent = new Date().getFullYear();
}

const revealTargets = document.querySelectorAll(
  ".universe-card, .manifesto, .step, .monthly-game-card, .practical-item, .location-card, details"
);

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  revealTargets.forEach((element) => {
    element.classList.add("reveal");
    observer.observe(element);
  });
}

// Prevent placeholder social links from jumping to the top.
document.querySelectorAll("[data-social]").forEach((link) => {
  if (link.getAttribute("href") === "#") {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      alert("Ajoutez ici le lien du réseau social dans le fichier index.html.");
    });
  }
});

/* =========================================================
   GALERIE AUTOMATIQUE
   La liste des photos est générée par GitHub Actions dans :
   assets/data/gallery.json
   ========================================================= */

function makeAltText(filename) {
  const withoutExtension = filename.replace(/\.[^.]+$/, "");
  const readable = withoutExtension
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!readable) {
    return "Photo du Cercle des Joueurs Paresseux";
  }

  return `${readable.charAt(0).toUpperCase()}${readable.slice(1)} — Le Cercle des Joueurs Paresseux`;
}

function addGalleryStyles() {
  if (document.querySelector("#gallery-auto-styles")) return;

  const style = document.createElement("style");
  style.id = "gallery-auto-styles";
  style.textContent = `
    .gallery-photo {
      overflow: hidden;
      padding: 0 !important;
      background: #263f32 !important;
    }

    .gallery-photo img {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: cover;
      transition: transform .35s ease, filter .35s ease;
    }

    .gallery-photo:hover img {
      transform: scale(1.045);
      filter: brightness(1.04);
    }

    .gallery-empty {
      grid-column: 1 / -1;
      min-height: 180px;
      display: grid;
      place-items: center;
      padding: 1.5rem;
      border: 1px dashed rgba(58, 43, 32, .25);
      border-radius: 18px;
      color: #6c625a;
      background: #fffaf1;
      text-align: center;
    }
  `;
  document.head.appendChild(style);
}

async function loadAutomaticGallery() {
  const gallery = document.querySelector(".gallery-grid");
  if (!gallery) return;

  addGalleryStyles();

  try {
    const response = await fetch(`assets/data/gallery.json?v=${Date.now()}`, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP ${response.status}`);
    }

    const files = await response.json();

    if (!Array.isArray(files) || files.length === 0) {
      gallery.innerHTML = `
        <div class="gallery-empty">
          Aucune photo n'est encore répertoriée. Ajoutez des images dans
          <strong>assets/images/galerie</strong>, puis attendez la fin de l'action GitHub.
        </div>
      `;
      return;
    }

    gallery.innerHTML = "";

    files.forEach((filename, index) => {
      const figure = document.createElement("figure");
      figure.className = "gallery-tile gallery-photo";

      if (index === 0) {
        figure.classList.add("tile-large");
      } else if (index === 4) {
        figure.classList.add("tile-wide");
      }

      const image = document.createElement("img");
      image.src = `assets/images/galerie/${encodeURIComponent(filename)}`;
      image.alt = makeAltText(filename);
      image.loading = index < 2 ? "eager" : "lazy";
      image.decoding = "async";

      figure.appendChild(image);
      gallery.appendChild(figure);
    });
  } catch (error) {
    console.error("Impossible de charger la galerie automatique :", error);
    gallery.innerHTML = `
      <div class="gallery-empty">
        La galerie n'a pas pu être chargée. Vérifiez que le fichier
        <strong>assets/data/gallery.json</strong> existe.
      </div>
    `;
  }
}

loadAutomaticGallery();
