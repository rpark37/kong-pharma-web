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
    const targets = document.querySelectorAll("main > section, .site-footer");
    if (!nav || !targets.length || typeof IntersectionObserver !== "function") {
      return;
    }
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
            { duration: 380, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
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
            { duration: 300, easing: "cubic-bezier(0.4, 0, 0.2, 1)" }
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
      const split = new SplitText(headline, {
        type: "words,chars",
        charsClass: "split-char",
        wordsClass: "split-word",
      });
      gsap.set(headline, { autoAlpha: 1 });
      tl.from(split.chars, {
        yPercent: 120,
        opacity: 0,
        duration: 0.7,
        stagger: 0.02,
        onComplete: () => split.revert(),
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

    // ---- Section headings reveal as each section enters ----
    gsap.utils
      .toArray([
        "#mission .eyebrow",
        "#pipeline .eyebrow",
        "#contact .eyebrow",
        ".contact__title",
      ])
      .forEach((el) => {
        el.classList.add("anim-hidden");
        gsap.to(el, {
          opacity: 1,
          y: 0,
          duration: 0.6,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 88%" },
        });
        gsap.from(el, {
          y: 24,
          duration: 0.6,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 88%" },
        });
      });

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
