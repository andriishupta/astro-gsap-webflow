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
  const dialogScroll = scope.querySelector<HTMLElement>(
    "[data-mobile-dialog-scroll]",
  );
  const rewindButton = scope.querySelector<HTMLButtonElement>(
    "[data-mobile-rewind]",
  );
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  let lockedPageScroll = 0;

  const lockPage = () => {
    lockedPageScroll = window.scrollY;
    document.documentElement.style.setProperty(
      "--mobile-dialog-page-offset",
      `${-lockedPageScroll}px`,
    );
    document.documentElement.classList.add("mobile-dialog-open");
  };

  const openDialog = () => {
    if (dialog && !dialog.open) {
      lockPage();
      dialog.showModal();
      dialogScroll?.scrollTo({ top: 0 });
    }
  };

  const closeDialog = () => {
    if (dialog?.open) {
      dialog.close();
    }
  };

  const unlockPage = () => {
    if (!document.documentElement.classList.contains("mobile-dialog-open")) {
      return;
    }

    document.documentElement.classList.remove("mobile-dialog-open");
    document.documentElement.style.removeProperty(
      "--mobile-dialog-page-offset",
    );
    window.scrollTo({ top: lockedPageScroll, behavior: "auto" });
  };

  const rewind = () => {
    scope.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
  };

  openButton?.addEventListener("click", openDialog);
  closeButton?.addEventListener("click", closeDialog);
  dialog?.addEventListener("close", unlockPage);
  rewindButton?.addEventListener("click", rewind);

  const teardown = () => {
    openButton?.removeEventListener("click", openDialog);
    closeButton?.removeEventListener("click", closeDialog);
    dialog?.removeEventListener("close", unlockPage);
    rewindButton?.removeEventListener("click", rewind);
    unlockPage();
  };

  document.addEventListener("astro:before-swap", teardown, { once: true });
}
