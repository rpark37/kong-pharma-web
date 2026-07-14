document.addEventListener("DOMContentLoaded", () => {
  // Core nav behavior — always runs, independent of GSAP / reduced motion.
  initNav();

  // Generative hero backdrop — self-contained, honors reduced motion.
  initHeroCanvas();

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

  function initHeroCanvas() {
    const canvas = document.querySelector(".hero__canvas");
    if (!canvas) return;
    let gl = null;
    try {
      gl =
        canvas.getContext("webgl", { antialias: true, alpha: false }) ||
        canvas.getContext("experimental-webgl");
    } catch (e) {
      gl = null;
    }
    if (gl) initHeroShader(canvas, gl);
    else if (canvas.getContext) initHeroCanvas2D(canvas);
  }

  // Hematogenix-tier backdrop: a real-time WebGL fragment shader that renders
  // domain-warped fractal noise (organic, flowing) in the teal palette.
  function initHeroShader(canvas, gl) {
    const hero = canvas.closest(".hero");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const SCALE = 0.55; // internal render resolution (upscaled by the GPU)
    const pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
    let raf = null;
    let startTime = 0;

    const VS = "attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}";
    const FS = [
      "precision highp float;",
      "uniform vec2 u_res;uniform float u_time;uniform vec2 u_pointer;",
      "float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}",
      "float noise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);vec2 u=f*f*(3.0-2.0*f);",
      "return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),u.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x),u.y);}",
      "float fbm(vec2 p){float v=0.0;float a=0.5;for(int i=0;i<4;i++){v+=a*noise(p);p*=2.0;a*=0.5;}return v;}",
      "void main(){",
      "vec2 uv=gl_FragCoord.xy/u_res;",
      "vec2 p=uv*2.4;p.x*=u_res.x/u_res.y;",
      "float t=u_time*0.06;",
      "p+=(u_pointer-0.5)*0.5;",
      "vec2 q=vec2(fbm(p+t),fbm(p+vec2(5.2,1.3)-t));",
      "vec2 r=vec2(fbm(p+3.0*q+vec2(1.7,9.2)+0.12*t),fbm(p+3.0*q+vec2(8.3,2.8)-0.10*t));",
      "float f=fbm(p+3.0*r);",
      "f=clamp((f-0.15)*1.55,0.0,1.0);",
      "vec3 low=vec3(0.141,0.706,0.635);",
      "vec3 mid=vec3(0.267,0.878,0.800);",
      "vec3 hi=vec3(0.784,1.0,0.957);",
      "vec3 col=mix(low,mid,smoothstep(0.0,0.55,f));",
      "col=mix(col,hi,smoothstep(0.6,0.96,f));",
      "gl_FragColor=vec4(col,1.0);",
      "}",
    ].join("\n");

    function compile(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.warn(gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    }

    const vs = compile(gl.VERTEX_SHADER, VS);
    const fs = compile(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) {
      initHeroCanvas2D(canvas);
      return;
    }
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      initHeroCanvas2D(canvas);
      return;
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "u_res");
    const uTime = gl.getUniformLocation(prog, "u_time");
    const uPtr = gl.getUniformLocation(prog, "u_pointer");

    function resize() {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * SCALE));
      canvas.height = Math.max(1, Math.round(rect.height * SCALE));
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    function drawAt(seconds) {
      pointer.x += (pointer.tx - pointer.x) * 0.05;
      pointer.y += (pointer.ty - pointer.y) * 0.05;
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, seconds);
      gl.uniform2f(uPtr, pointer.x, pointer.y);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function frame(now) {
      if (!startTime) startTime = now;
      drawAt((now - startTime) / 1000);
      raf = requestAnimationFrame(frame);
    }

    function start() {
      if (raf || reduce) return;
      startTime = 0;
      raf = requestAnimationFrame(frame);
    }
    function stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = null;
    }

    resize();
    drawAt(12.0);
    start();

    if (hero) {
      hero.addEventListener("pointermove", (e) => {
        const rect = hero.getBoundingClientRect();
        pointer.tx = (e.clientX - rect.left) / rect.width;
        pointer.ty = (e.clientY - rect.top) / rect.height;
      });
    }
    window.addEventListener("resize", () => {
      resize();
      if (reduce) drawAt(12.0);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stop();
      else start();
    });
  }

  function initHeroCanvas2D(canvas) {
    const ctx = canvas.getContext("2d");
    const hero = canvas.closest(".hero");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Palette pulled from the teal system: deep shadow teal + bright mint.
    const COLORS = [
      [3, 34, 30],
      [8, 74, 66],
      [214, 255, 244],
    ];

    let w = 0;
    let h = 0;
    let blobs = [];
    let raf = null;
    const pointer = { x: 0.5, y: 0.5 };

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function makeBlobs() {
      const count = Math.max(6, Math.min(14, Math.round((w * h) / 90000)));
      blobs = Array.from({ length: count }, (_, i) => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 110 + Math.random() * 190,
        vx: (Math.random() - 0.5) * 0.55,
        vy: (Math.random() - 0.5) * 0.55,
        a: 0.16 + Math.random() * 0.16,
        depth: 0.4 + Math.random() * 0.9,
        c: COLORS[i % COLORS.length],
      }));
    }

    function render(animated) {
      ctx.clearRect(0, 0, w, h);
      const ox = (pointer.x - 0.5) * 30;
      const oy = (pointer.y - 0.5) * 30;
      for (const b of blobs) {
        if (animated) {
          b.x += b.vx;
          b.y += b.vy;
          if (b.x < -b.r) b.x = w + b.r;
          else if (b.x > w + b.r) b.x = -b.r;
          if (b.y < -b.r) b.y = h + b.r;
          else if (b.y > h + b.r) b.y = -b.r;
        }
        const px = b.x + ox * b.depth;
        const py = b.y + oy * b.depth;
        const [r, g, bl] = b.c;
        const grad = ctx.createRadialGradient(px, py, 0, px, py, b.r);
        grad.addColorStop(0, `rgba(${r},${g},${bl},${b.a})`);
        grad.addColorStop(1, `rgba(${r},${g},${bl},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(px, py, b.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function loop() {
      render(true);
      raf = requestAnimationFrame(loop);
    }

    function start() {
      if (raf || reduce) return;
      raf = requestAnimationFrame(loop);
    }
    function stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = null;
    }

    resize();
    makeBlobs();
    render(false);
    start();

    if (hero) {
      hero.addEventListener("pointermove", (e) => {
        const rect = hero.getBoundingClientRect();
        pointer.x = (e.clientX - rect.left) / rect.width;
        pointer.y = (e.clientY - rect.top) / rect.height;
      });
    }
    window.addEventListener("resize", () => {
      resize();
      makeBlobs();
      render(false);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stop();
      else start();
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
        "#focus .eyebrow",
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
