document.addEventListener("DOMContentLoaded", () => {
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  // With reduced motion (or no GSAP), leave the DOM fully visible and do nothing.
  if (prefersReducedMotion || !window.gsap) {
    return;
  }

  gsap.registerPlugin(ScrollTrigger, SplitText);

  // Wait for web fonts so SplitText measures final glyph widths.
  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
  fontsReady.then(() => {
    initAnimations();
    ScrollTrigger.refresh();
  });

  function initAnimations() {
    // Task 10 (intro/hero) and Task 11 (scroll reveals) add their code here.
  }
});
