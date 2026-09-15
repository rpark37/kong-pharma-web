document.addEventListener("DOMContentLoaded", () => {
  // Core nav behavior — always runs, independent of GSAP / reduced motion.
  initNav();

  // Animated expand/collapse for the program-overview <details> accordions.
  initProgramAccordions();

  // Transparent toolbar: adapt mark/text color to the section behind it.
  initNavTheme();

  // Hero 3D backdrop lives in hero3d.js (ES module + Three.js).

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

  function initNav() {
    const nav = document.querySelector("[data-nav]");
    const toggle = nav && nav.querySelector(".nav__toggle");
    if (!nav || !toggle) return;
    const setOpen = (open) => {
      nav.classList.toggle("is-open", open);
      document.documentElement.classList.toggle("menu-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Menu");
      // Return focus to the toggle when closing from inside the overlay,
      // so keyboard focus isn't dropped to <body> when it hides.
      if (!open && nav.contains(document.activeElement)) toggle.focus();
    };
    toggle.addEventListener("click", () =>
      setOpen(!nav.classList.contains("is-open"))
    );
    nav.querySelectorAll(".nav__links a").forEach((a) =>
      a.addEventListener("click", () => setOpen(false))
    );
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setOpen(false);
    });
  }

  function initNavTheme() {
    const nav = document.querySelector("[data-nav]");
    if (!nav) return;

    // Frosted background appears once you scroll past the top.
    const onScroll = () =>
      nav.classList.toggle("nav--scrolled", window.scrollY > 60);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const targets = document.querySelectorAll("main > section, .site-footer");
    if (!targets.length || typeof IntersectionObserver !== "function") return;
    // A section is "active" when it crosses the thin band just under the bar.
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const dark =
            e.target.classList.contains("section--ink") ||
            e.target.classList.contains("site-footer");
          nav.classList.toggle("nav--light", dark);
        });
      },
      { rootMargin: "-34px 0px -95% 0px", threshold: 0 }
    );
    targets.forEach((t) => io.observe(t));
  }

  function initProgramAccordions() {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    // Reduced motion (or no Web Animations API): keep the native instant toggle.
    if (reduce || typeof Element.prototype.animate !== "function") return;

    document.querySelectorAll("details.program").forEach((d) => {
      const summary = d.querySelector("summary");
      const content = d.querySelector(".program__content");
      if (!summary || !content) return;

      summary.addEventListener("click", (e) => {
        e.preventDefault();
        if (d.dataset.animating) return;
        d.dataset.animating = "1";
        content.style.overflow = "hidden";

        if (!d.open) {
          d.open = true; // reveal + expose to assistive tech, then grow in
          const h = content.scrollHeight;
          const anim = content.animate(
            [
              { height: "0px", opacity: 0 },
              { height: h + "px", opacity: 1 },
            ],
            { duration: 253.333, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
          );
          anim.onfinish = anim.oncancel = () => {
            content.style.overflow = "";
            delete d.dataset.animating;
          };
        } else {
          const h = content.scrollHeight;
          const anim = content.animate(
            [
              { height: h + "px", opacity: 1 },
              { height: "0px", opacity: 0 },
            ],
            { duration: 200.0, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }
          );
          anim.onfinish = anim.oncancel = () => {
            d.open = false; // collapse + hide from assistive tech
            content.style.overflow = "";
            delete d.dataset.animating;
          };
        }
      });
    });
  }

  // Split an element and reveal its parts (masked rise + fade), then revert to
  // clean, selectable text. mode "chars" = per character, "words" = per word.
  function splitAndReveal(el, mode) {
    if (mode === "anime") {
      const split = new SplitText(el, {
        type: "words,chars",
        charsClass: "split-char",
        wordsClass: "split-word",
      });
      el.classList.remove("anim-hidden");
      gsap.set(el, { autoAlpha: 1 });
      // Anime "title-card" impact: each character zooms in slightly oversized
      // and softly blurred, then snaps sharp — a rapid left-to-right slam.
      gsap.from(split.chars, {
        opacity: 0,
        scale: 1.6,
        filter: "blur(7px)",
        rotation: () => gsap.utils.random(-8, 8),
        y: () => gsap.utils.random(-14, 14),
        transformOrigin: "50% 50%",
        ease: "expo.out",
        duration: 0.45,
        stagger: { each: 0.02, from: "start" },
        onComplete: () => split.revert(),
      });
    } else if (mode === "chars") {
      const split = new SplitText(el, {
        type: "words,chars",
        charsClass: "split-char",
        wordsClass: "split-word",
      });
      el.classList.remove("anim-hidden");
      gsap.set(el, { autoAlpha: 1 });
      // Scatter-and-assemble: each char drops in from a random height/rotation.
      gsap.from(split.chars, {
        opacity: 0,
        yPercent: () => gsap.utils.random(-140, 140),
        rotation: () => gsap.utils.random(-40, 40),
        scale: 0.3,
        transformOrigin: "50% 50%",
        ease: "power1.out",
        duration: 0.533,
        stagger: { each: 0.013, from: "random" },
        onComplete: () => split.revert(),
      });
    } else {
      const split = new SplitText(el, {
        type: "lines,words",
        mask: "lines",
        wordsClass: "split-word",
        linesClass: "split-line",
      });
      el.classList.remove("anim-hidden");
      gsap.set(el, { autoAlpha: 1 });
      gsap.from(split.words, {
        yPercent: 100,
        opacity: 0,
        ease: "power1.out",
        duration: 0.4,
        stagger: 0.02,
        onComplete: () => split.revert(),
      });
    }
  }

  // Reveal an element the first time it scrolls into view.
  function revealOnScroll(el, mode) {
    if (!el) return;
    el.classList.add("anim-hidden");
    ScrollTrigger.create({
      trigger: el,
      // Fire as the element first enters from the bottom, so it never animates
      // once it has scrolled up into a closer region of the viewport.
      start: "top bottom",
      once: true,
      onEnter: () => splitAndReveal(el, mode),
    });
  }

  function initAnimations() {
    document.documentElement.classList.add("js-anim");

    // ---- Intro / hero (plays on load) ----
    const headline = document.querySelector(".hero__headline");
    const heroEyebrow = document.querySelector("#hero .eyebrow");
    const heroMission = document.querySelector("#hero .hero__mission");
    const heroTail = gsap.utils.toArray(["#hero .btn", "#hero .hero__scrollcue"]);
    [headline, heroEyebrow, heroMission, ...heroTail].forEach(
      (el) => el && el.classList.add("anim-hidden")
    );

    const tl = gsap.timeline({ defaults: { ease: "power1.out" } });

    if (heroEyebrow) {
      const s = new SplitText(heroEyebrow, { type: "chars", charsClass: "split-char" });
      heroEyebrow.classList.remove("anim-hidden");
      gsap.set(heroEyebrow, { autoAlpha: 1 });
      tl.from(s.chars, {
        opacity: 0, yPercent: () => gsap.utils.random(-90, 90),
        rotation: () => gsap.utils.random(-30, 30), scale: 0.4,
        transformOrigin: "50% 50%", ease: "power1.out",
        duration: 0.4, stagger: { each: 0.01, from: "random" },
        onComplete: () => s.revert(),
      }, 0);
    }
    if (headline) {
      const s = new SplitText(headline, { type: "words,chars", charsClass: "split-char", wordsClass: "split-word" });
      headline.classList.remove("anim-hidden");
      gsap.set(headline, { autoAlpha: 1 });
      tl.from(s.chars, {
        opacity: 0, yPercent: () => gsap.utils.random(-160, 160),
        rotation: () => gsap.utils.random(-45, 45), scale: 0.3,
        transformOrigin: "50% 50%", ease: "power1.out",
        duration: 0.6, stagger: { each: 0.013, from: "random" },
        onComplete: () => s.revert(),
      }, 0.15);
    }
    if (heroMission) {
      const s = new SplitText(heroMission, { type: "lines,words", mask: "lines", wordsClass: "split-word" });
      heroMission.classList.remove("anim-hidden");
      gsap.set(heroMission, { autoAlpha: 1 });
      tl.from(s.words, { yPercent: 100, opacity: 0, duration: 0.333, stagger: 0.02, onComplete: () => s.revert() }, "-=0.25");
    }
    tl.to(heroTail, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.08 }, "-=0.2")
      .from(heroTail, { y: 20, duration: 0.4, stagger: 0.08 }, "<");

    // ---- Titles: per character (scatter) — mission ----
    [
      "#mission .eyebrow",
    ].forEach((sel) =>
      gsap.utils.toArray(sel).forEach((el) => revealOnScroll(el, "chars"))
    );

    // ---- Other text: per word — mission statement ----
    [
      ".mission__statement",
    ].forEach((sel) =>
      gsap.utils.toArray(sel).forEach((el) => revealOnScroll(el, "words"))
    );

    // ---- Active nav link highlighting ----
    gsap.utils.toArray("[data-nav-link]").forEach((link) => {
      const section = document.querySelector(link.getAttribute("href"));
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
