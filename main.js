document.addEventListener("DOMContentLoaded", () => {
  // Core nav behavior — always runs, independent of GSAP / reduced motion.
  initNav();
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="tel:"], a[href^="mailto:"]');
    if (a && typeof window.gtag === "function") window.gtag("event", "contact_click", { method: a.protocol.replace(":", "") });
  });

  // The drug row in the reading band is bracketed; the others step back.
  initReadingCursor();

  // Mission explainer video plays only while it is on screen.
  initScienceVideo();

  // Partnership speed bars grow in when they scroll into view.
  initSpeedBars();

  // Sections mark themselves visible (perpetual CSS loops pause off-screen),
  // cards fade-rise once as they enter, and the globe module loads lazily.
  initSectionVisibility();
  initReveals();
  initLazyGlobe();

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

  function initSectionVisibility() {
    const sections = document.querySelectorAll("main > section");
    if (!sections.length || typeof IntersectionObserver !== "function") {
      sections.forEach((sec) => sec.classList.add("is-visible", "is-seen"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        e.target.classList.toggle("is-visible", e.isIntersecting);
        if (e.isIntersecting) e.target.classList.add("is-seen"); // one-shot hook for entrances
      });
    }, { rootMargin: "120px 0px", threshold: 0 });
    sections.forEach((sec) => io.observe(sec));
  }

  function initReadingCursor() {
    const items = document.querySelectorAll(".pipeline .index-item");
    if (!items.length || typeof IntersectionObserver !== "function") return;
    const seen = new Set();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        items.forEach((li) => li.classList.toggle("is-reading", li === e.target));
        if (!seen.has(e.target) && typeof window.gtag === "function") {
          seen.add(e.target);
          window.gtag("event", "program_read", { program: e.target.id });
        }
      });
    }, { rootMargin: "-25% 0px -45% 0px", threshold: 0 });
    items.forEach((li) => io.observe(li));
  }

  function initReveals() {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cards = document.querySelectorAll(".panel, .member, .tox__card, .dmta__card, .pipeline .index-item");
    if (reduce || !cards.length || typeof IntersectionObserver !== "function") return;
    cards.forEach((el) => {
      el.classList.add("js-reveal");
      // stagger within each parent so a grid ripples in
      const i = Array.prototype.indexOf.call(el.parentElement.children, el);
      el.style.transitionDelay = Math.min(i, 5) * 70 + "ms";
    });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-in");
        io.unobserve(e.target);
        // a drug row brings its overview in with it: caption and milestones
        // fade, the paragraphs rise line by line
        const content = e.target.querySelector(".program__content");
        if (content && window.gsap) {
          content.querySelectorAll(".milestones li").forEach((li) => li.classList.add("is-in"));
          gsap.from(content.querySelectorAll(".program__viz-cap, .milestones li"),
            { autoAlpha: 0, y: 10, duration: 0.3, stagger: 0.1, ease: "power2.out", overwrite: true, delay: 0.25 });
          revealLines(content.querySelectorAll(".program__content > p"), 0.35);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.1 });
    cards.forEach((el) => io.observe(el));
  }

  function initLazyGlobe() {
    const host = document.querySelector("[data-globe]");
    if (!host) return;
    const load = () => import("./globe.js").catch((err) => console.warn("globe failed to load", err));
    if (typeof IntersectionObserver !== "function") return load();
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); load(); }
    }, { rootMargin: "1200px 0px" });
    io.observe(host);
  }

  function initSpeedBars() {
    const box = document.querySelector("[data-speed]");
    if (!box) return;
    if (typeof IntersectionObserver !== "function") return box.classList.add("is-in");
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { box.classList.add("is-in"); io.disconnect(); }
    }, { threshold: 0.4 });
    io.observe(box);
  }

  function initScienceVideo() {
    const video = document.querySelector(".science__video video");
    if (!video || typeof IntersectionObserver !== "function") return;
    new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) video.play().catch(() => {});
        else video.pause();
      },
      { threshold: 0.25 }
    ).observe(video);
  }

  function initNavTheme() {
    const nav = document.querySelector("[data-nav]");
    if (!nav) return;

    // Frosted background appears once you scroll past the top.
    const onScroll = () =>
      nav.classList.toggle("nav--scrolled", window.scrollY > 60);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const targets = document.querySelectorAll("main > section");
    if (!targets.length || typeof IntersectionObserver !== "function") return;
    // A section is "active" when it crosses the thin band just under the bar.
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const dark = e.target.classList.contains("section--ink");
          nav.classList.toggle("nav--light", dark);
        });
      },
      { rootMargin: "-34px 0px -95% 0px", threshold: 0 }
    );
    targets.forEach((t) => io.observe(t));
  }

  // Overview copy: each paragraph's lines rise out of a mask, one after the
  // other, 0.3s per line staggered 0.06s. Falls back to a fade without SplitText.
  function revealLines(paragraphs, delay) {
    const els = Array.from(paragraphs);
    if (!els.length) return;
    if (!window.SplitText) {
      gsap.from(els, { autoAlpha: 0, y: 10, duration: 0.3, stagger: 0.1, ease: "power2.out", overwrite: true, delay: delay || 0 });
      return;
    }
    let at = delay || 0.1;
    els.forEach((p) => {
      if (p._split) p._split.revert();
      const split = new SplitText(p, { type: "lines", mask: "lines", linesClass: "split-line" });
      p._split = split;
      gsap.from(split.lines, {
        yPercent: 100, opacity: 0, duration: 0.3, stagger: 0.06, ease: "power2.out", delay: at,
        onComplete: () => { split.revert(); p._split = null; },
      });
      at += 0.06 * split.lines.length + 0.05;
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

    // ---- Detailed text: fade-rise, 0.3s per tween, siblings staggered 0.1s ----
    // Drug overview copy is animated by initReveals as its row enters.
    const detail = gsap.utils.toArray(
      ".science__intro p, .science__blurb, .panel__def, .panel__note, .readout p, " +
      ".dmta__card p, .speed__row, .speed__src, .tox__card p, .pipeline-group__desc, " +
      ".index-desc, .index-links, .index-platform, .board__summary, " +
      ".member__role, .member__bio, .contact__list li, .contact__globe-cap"
    );
    gsap.set(detail, { autoAlpha: 0, y: 10 });
    ScrollTrigger.batch(detail, {
      start: "top 88%",
      once: true,
      onEnter: (batch) => {
        // Only what is on screen ripples in; copy jumped past (menu links, fast
        // scrolls) appears at once so a long batch never queues for seconds.
        const h = window.innerHeight;
        batch.forEach((el) => el.classList.add("is-in")); // CSS hook for the icons inside
        const seen = batch.filter((el) => el.getBoundingClientRect().bottom > 0 && el.getBoundingClientRect().top < h);
        gsap.set(batch.filter((el) => !seen.includes(el)), { autoAlpha: 1, y: 0, overwrite: true });
        gsap.to(seen, { autoAlpha: 1, y: 0, duration: 0.3, stagger: 0.1, ease: "power2.out", overwrite: true });
      },
    });

    // ---- Active nav link highlighting ----
    gsap.utils.toArray("[data-nav-link]").forEach((link) => {
      const href = link.getAttribute("href") || "";
      if (!href.startsWith("#") || href.length < 2) return; // only in-page anchors (the Labs link is a path)
      const section = document.querySelector(href);
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
