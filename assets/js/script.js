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
  ".universe-card, .manifesto, .step, .monthly-game-card, .gallery-tile, .practical-item, .location-card, details"
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
