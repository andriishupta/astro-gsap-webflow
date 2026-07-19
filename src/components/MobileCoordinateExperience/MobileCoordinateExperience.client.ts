const mobileRoot = document.querySelector<HTMLElement>("[data-mobile-coordinate]");
const mobileQuery = window.matchMedia("(max-width: 900px)");

if (mobileRoot && mobileQuery.matches) {
  setupMobileExperience(mobileRoot);
}

function setupMobileExperience(scope: HTMLElement) {
  const dialog = scope.querySelector<HTMLDialogElement>("[data-mobile-dialog]");
  const openButton = scope.querySelector<HTMLButtonElement>(
    "[data-mobile-dialog-open]",
  );
  const closeButton = scope.querySelector<HTMLButtonElement>(
    "[data-mobile-dialog-close]",
  );
  const rewindButton = scope.querySelector<HTMLButtonElement>(
    "[data-mobile-rewind]",
  );
  const scenes = Array.from(
    scope.querySelectorAll<HTMLElement>("[data-mobile-scene]"),
  );
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  let animationFrame = 0;

  const openDialog = () => {
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  };

  const closeDialog = () => {
    if (dialog?.open) {
      dialog.close();
    }
  };

  const rewind = () => {
    scope.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
  };

  const updateScenes = () => {
    animationFrame = 0;
    const viewportHeight = Math.max(1, window.innerHeight);

    scenes.forEach((scene) => {
      const rect = scene.parentElement?.getBoundingClientRect();
      if (!rect) {
        return;
      }

      const progress = Math.min(
        1,
        Math.max(0, (viewportHeight - rect.top) / (viewportHeight + rect.height)),
      );
      const shift = (progress - 0.5) * 28;
      scene.style.setProperty("--mobile-parallax", `${shift.toFixed(2)}px`);
    });
  };

  const requestSceneUpdate = () => {
    if (!animationFrame && !document.hidden) {
      animationFrame = window.requestAnimationFrame(updateScenes);
    }
  };

  openButton?.addEventListener("click", openDialog);
  closeButton?.addEventListener("click", closeDialog);
  rewindButton?.addEventListener("click", rewind);

  if (!reducedMotion) {
    window.addEventListener("scroll", requestSceneUpdate, { passive: true });
    window.addEventListener("resize", requestSceneUpdate, { passive: true });
    document.addEventListener("visibilitychange", requestSceneUpdate);
    requestSceneUpdate();
  }

  const teardown = () => {
    if (animationFrame) {
      window.cancelAnimationFrame(animationFrame);
    }
    openButton?.removeEventListener("click", openDialog);
    closeButton?.removeEventListener("click", closeDialog);
    rewindButton?.removeEventListener("click", rewind);
    window.removeEventListener("scroll", requestSceneUpdate);
    window.removeEventListener("resize", requestSceneUpdate);
    document.removeEventListener("visibilitychange", requestSceneUpdate);
  };

  document.addEventListener("astro:before-swap", teardown, { once: true });
}
