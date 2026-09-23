document.addEventListener("DOMContentLoaded", () => {
  // Core nav behavior — always runs, independent of GSAP / reduced motion.
  initNav();

  // Animated expand/collapse for the program-overview <details> accordions.
  initProgramAccordions();

  // Deep links to a drug (#cr-067 etc.) expand its overview before scrolling.
  initProgramLinks();

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
      sections.forEach((sec) => sec.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => e.target.classList.toggle("is-visible", e.isIntersecting));
    }, { rootMargin: "120px 0px", threshold: 0 });
    sections.forEach((sec) => io.observe(sec));
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

  function initProgramLinks() {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const NAV_OFFSET = 84; // matches .index-item { scroll-margin-top }

    const programOf = (hash) => {
      if (!hash || hash.length < 2) return {};
      const item = document.getElementById(hash.slice(1));
      const d = item && item.querySelector("details.program");
      return d ? { item, d } : {};
    };
    // One drug at a time. Collapsing is instant (setting .open fires `toggle`,
    // so the viz timelines pause) which keeps the scroll target stable.
    const collapseOthers = (d) =>
      document.querySelectorAll("details.program").forEach((other) => {
        if (other !== d && other.open) other.open = false;
      });
    // Opening goes through the summary so the accordion's grow-in animation runs.
    const openProgram = (d) => {
      if (d.open) return;
      const summary = d.querySelector("summary");
      if (summary && !reduce) summary.click();
      else d.open = true;
    };
    // Scroll the item under the toolbar first; open it only once we've arrived.
    const scrollThenOpen = (item, d) => {
      collapseOthers(d);
      const html = document.documentElement;
      const target = () =>
        Math.min(
          Math.round(item.getBoundingClientRect().top + window.scrollY - NAV_OFFSET),
          html.scrollHeight - window.innerHeight
        );
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        window.removeEventListener("scrollend", finish);
        openProgram(d);
      };
      // `scrollend` fires exactly when the smooth scroll settles; the frame
      // check is the fallback for browsers without it (long jumps can take >2 s)
      window.addEventListener("scrollend", finish, { once: true });
      window.scrollTo({ top: target(), behavior: reduce ? "auto" : "smooth" });
      const t0 = performance.now();
      let still = 0, lastY = -1;
      const check = () => {
        if (done) return;
        const y = window.scrollY;
        still = Math.abs(y - lastY) < 0.5 ? still + 1 : 0;
        lastY = y;
        const arrived = Math.abs(y - target()) < 2 || still > 6; // settled, even if short of target
        if (!arrived && performance.now() - t0 < 4000) return requestAnimationFrame(check);
        finish();
      };
      requestAnimationFrame(check);
    };

    document.querySelectorAll('a[href^="#"]').forEach((a) =>
      a.addEventListener("click", (e) => {
        const { item, d } = programOf(a.getAttribute("href"));
        if (!d) return;
        e.preventDefault(); // we drive the scroll ourselves
        history.pushState(null, "", a.getAttribute("href"));
        scrollThenOpen(item, d);
      })
    );
    window.addEventListener("hashchange", () => {
      const { d } = programOf(location.hash);
      if (d) { collapseOthers(d); openProgram(d); }
    });
    // Arriving on a #drug URL: the browser scrolls there itself, so open at once.
    const { d: initial } = programOf(location.hash);
    if (initial) { collapseOthers(initial); initial.open = true; }
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
        duration: 0.3,
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
        ease: "expo.out",
        duration: 0.3,
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
        ease: "expo.out",
        duration: 0.3,
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

    const tl = gsap.timeline({ defaults: { ease: "expo.out" } });

    if (heroEyebrow) {
      const s = new SplitText(heroEyebrow, { type: "chars", charsClass: "split-char" });
      heroEyebrow.classList.remove("anim-hidden");
      gsap.set(heroEyebrow, { autoAlpha: 1 });
      tl.from(s.chars, {
        opacity: 0, yPercent: () => gsap.utils.random(-90, 90),
        rotation: () => gsap.utils.random(-30, 30), scale: 0.4,
        transformOrigin: "50% 50%", ease: "expo.out",
        duration: 0.3, stagger: { each: 0.01, from: "random" },
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
        transformOrigin: "50% 50%", ease: "expo.out",
        duration: 0.3, stagger: { each: 0.013, from: "random" },
        onComplete: () => s.revert(),
      }, 0.15);
    }
    if (heroMission) {
      const s = new SplitText(heroMission, { type: "lines,words", mask: "lines", wordsClass: "split-word" });
      heroMission.classList.remove("anim-hidden");
      gsap.set(heroMission, { autoAlpha: 1 });
      tl.from(s.words, { yPercent: 100, opacity: 0, duration: 0.3, stagger: 0.02, onComplete: () => s.revert() }, "-=0.2");
    }
    tl.to(heroTail, { autoAlpha: 1, y: 0, duration: 0.3, stagger: 0.1 }, "-=0.15")
      .from(heroTail, { y: 20, duration: 0.3, stagger: 0.1 }, "<");

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
      // Not every nav link points at a section on this page — the Labs link is href="/app/",
      // which querySelector throws on rather than returning null, so the `!section` guard below
      // never got the chance to run and the throw took the rest of the loop with it.
      const href = link.getAttribute("href");
      if (!href || !href.startsWith("#")) return;
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
