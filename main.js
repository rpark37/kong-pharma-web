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
    document.documentElement.classList.add("js-anim");

    // ---- Intro / hero ----
    const headline = document.querySelector('.hero__headline[data-split="chars"]');
    const heroBits = gsap.utils.toArray([
      "#hero .eyebrow",
      "#hero .hero__mission",
      "#hero .btn",
      "#hero .hero__scrollcue",
    ]);
    heroBits.forEach((el) => el.classList.add("anim-hidden"));

    const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

    if (headline) {
      const split = new SplitText(headline, { type: "chars", charsClass: "split-char" });
      gsap.set(headline, { autoAlpha: 1 });
      tl.from(split.chars, {
        yPercent: 120,
        opacity: 0,
        duration: 0.7,
        stagger: 0.02,
      });
    }

    tl.to(
      heroBits,
      { opacity: 1, y: 0, duration: 0.6, stagger: 0.12 },
      "-=0.3"
    ).from(
      heroBits,
      { y: 20, duration: 0.6, stagger: 0.12 },
      "<"
    );
    // Task 11 (scroll reveals) adds its code here.
  }
});
