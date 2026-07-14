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
    // ---- Mission: masked line reveal ----
    const mission = document.querySelector('.mission__statement[data-split="lines"]');
    if (mission) {
      const mSplit = new SplitText(mission, {
        type: "lines",
        linesClass: "reveal-line-inner",
      });
      // Wrap each line so it can be clipped.
      mSplit.lines.forEach((line) => {
        const wrap = document.createElement("span");
        wrap.className = "reveal-line";
        line.parentNode.insertBefore(wrap, line);
        wrap.appendChild(line);
      });
      gsap.set(mission, { autoAlpha: 1 });
      gsap.from(mSplit.lines, {
        yPercent: 110,
        duration: 0.8,
        ease: "power3.out",
        stagger: 0.12,
        scrollTrigger: { trigger: mission, start: "top 80%" },
      });
    }

    // ---- Numbered index items (Focus + Pipeline) ----
    gsap.utils.toArray(".index-item").forEach((item) => {
      item.classList.add("anim-hidden");
      gsap.to(item, {
        opacity: 1,
        y: 0,
        duration: 0.7,
        ease: "power3.out",
        scrollTrigger: { trigger: item, start: "top 85%" },
      });
      gsap.from(item, {
        y: 40,
        duration: 0.7,
        ease: "power3.out",
        scrollTrigger: { trigger: item, start: "top 85%" },
      });
    });

    // ---- Status tags pop in ----
    gsap.utils.toArray(".status-tag").forEach((tag) => {
      gsap.from(tag, {
        scale: 0.85,
        opacity: 0,
        duration: 0.4,
        ease: "back.out(1.7)",
        scrollTrigger: { trigger: tag, start: "top 90%" },
      });
    });

    // ---- Active nav link highlighting ----
    const navLinks = gsap.utils.toArray("[data-nav-link]");
    navLinks.forEach((link) => {
      const id = link.getAttribute("href");
      const section = document.querySelector(id);
      if (!section) return;
      ScrollTrigger.create({
        trigger: section,
        start: "top center",
        end: "bottom center",
        onToggle: (self) =>
          link.setAttribute("aria-current", self.isActive ? "true" : "false"),
      });
    });
  }
});
