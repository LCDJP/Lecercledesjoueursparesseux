const menuButton = document.querySelector(".menu-toggle");
const navigation = document.querySelector(".main-nav");

if (menuButton && navigation) {
  menuButton.addEventListener("click", () => {
    const isOpen = navigation.classList.toggle("is-open");
    menuButton.setAttribute("aria-expanded", String(isOpen));
  });

  navigation.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navigation.classList.remove("is-open");
      menuButton.setAttribute("aria-expanded", "false");
    });
  });
}

const yearTarget = document.querySelector("#current-year");
if (yearTarget) {
  yearTarget.textContent = new Date().getFullYear();
}

const observedElements = document.querySelectorAll(
  ".activity-card, .quote-card, .gallery-placeholder, .practical-card, .map-card"
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

  observedElements.forEach((element) => {
    element.classList.add("reveal");
    observer.observe(element);
  });
}
