const desktopQuery = window.matchMedia("(min-width: 901px)");
let desktopLoaded = false;

const loadDesktopExperience = () => {
  if (!desktopQuery.matches || desktopLoaded) {
    return;
  }

  desktopLoaded = true;
  void import("./CoordinateExperience");
};

loadDesktopExperience();
desktopQuery.addEventListener("change", loadDesktopExperience);

document.addEventListener(
  "astro:before-swap",
  () => desktopQuery.removeEventListener("change", loadDesktopExperience),
  { once: true },
);
