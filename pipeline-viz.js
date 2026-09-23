// Per-drug pipeline visualizations.
// Injects theme-adaptive line-art SVG into the row emblems and the expanded
// program banners, then wires GSAP draw-on + loop timelines that play when a
// program opens. Runs synchronously at parse time so the banner exists in the
// DOM before main.js measures content.scrollHeight for the accordion grow.
(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var G = window.gsap;

  // ---- geometry helpers -------------------------------------------------
  function hex(cx, cy, r, rot) {
    rot = rot || 0;
    var d = "";
    for (var i = 0; i < 6; i++) {
      var a = (Math.PI / 180) * (60 * i + rot);
      d +=
        (i === 0 ? "M" : "L") +
        (cx + r * Math.cos(a)).toFixed(1) +
        " " +
        (cy + r * Math.sin(a)).toFixed(1);
    }
    return d + "Z";
  }
  function circle(cx, cy, r, cls) {
    return '<circle class="' + cls + '" cx="' + cx + '" cy="' + cy + '" r="' + r + '"/>';
  }
  function path(d, cls, draw) {
    return (
      '<path class="' +
      cls +
      (draw ? " draw" : "") +
      '" ' +
      (draw ? 'pathLength="1" ' : "") +
      'd="' +
      d +
      '"/>'
    );
  }
  function svg(vb, body) {
    return (
      '<svg viewBox="' +
      vb +
      '" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">' +
      body +
      "</svg>"
    );
  }
  var BVB = "0 0 400 300"; // figure viewBox (4:3)
  var EVB = "0 0 100 100"; // emblem viewBox

  // ---- schematic figure scaffolding -------------------------------------
  // Plot area shared by all three figures: x 56..372, y 40..248.
  var PX0 = 56, PX1 = 372, PY0 = 40, PY1 = 248;
  function px(t) { return PX0 + t * (PX1 - PX0); }
  function py(t) { return PY1 - t * (PY1 - PY0); }
  function poly(fn, n, cls) {
    // sample a unit function fn(t)->[0,1] into a draw-on polyline
    var d = "";
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      d += (i ? "L" : "M") + px(t).toFixed(1) + " " + py(fn(t)).toFixed(1);
    }
    return path(d, cls, true);
  }
  function label(x, y, txt, cls, anchor) {
    return '<text class="viz-label ' + (cls || "") + '" x="' + x + '" y="' + y + '"' +
      (anchor ? ' style="text-anchor:' + anchor + '"' : "") + ">" + txt + "</text>";
  }
  function axes(xl, yl) {
    return (
      path("M" + PX0 + " " + PY0 + " V" + PY1 + " H" + PX1, "viz-base viz-thin", true) +
      label((PX0 + PX1) / 2, PY1 + 22, xl, "ax") +
      '<text class="viz-label ax" transform="translate(' + (PX0 - 14) + ' ' + ((PY0 + PY1) / 2) + ') rotate(-90)">' + yl + "</text>"
    );
  }
  function sig(m, w) { return function (t) { return 1 / (1 + Math.exp(-(t - m) / w)); }; }
  function finish(tl, s) {
    // one soft, staged draw-on for every figure: axes, then series, then annotations
    tl.from(s.querySelectorAll(".draw"), { strokeDashoffset: 1, duration: 0.6, stagger: 0.12, ease: "power2.out" }, 0)
      .from(s.querySelectorAll(".fade"), { opacity: 0, duration: 0.5, stagger: 0.08, ease: "power2.out" }, 0.4);
    return tl;
  }

  // =======================================================================
  // Fig. 1  CR-067: dose-response. The combination reaches the target effect
  // at a lower dose than monotherapy. Loop: a dose cursor sweeps and two
  // readouts ride their curves.
  // =======================================================================
  var CR_MONO = sig(0.62, 0.075), CR_COMBO = sig(0.36, 0.075);
  function cr067Banner() {
    var target = 0.5;
    var xm = 0.62, xc = 0.36; // ED50 of each curve (sigmoid midpoints)
    var body =
      axes("DOSE", "EFFECT") +
      // target effect line + drop lines to the dose axis
      '<path class="viz-base viz-thin viz-dash fade" d="M' + PX0 + " " + py(target).toFixed(1) + " H" + px(xm).toFixed(1) + '"/>' +
      '<path class="viz-base viz-thin viz-dash fade" d="M' + px(xc).toFixed(1) + " " + py(target).toFixed(1) + " V" + PY1 + '"/>' +
      '<path class="viz-base viz-thin viz-dash fade" d="M' + px(xm).toFixed(1) + " " + py(target).toFixed(1) + " V" + PY1 + '"/>' +
      // series
      poly(CR_MONO, 48, "viz-base") +
      poly(CR_COMBO, 48, "viz-bright") +
      // the gap: bracket + label
      '<path class="viz-copper draw" pathLength="1" d="M' + px(xc).toFixed(1) + " " + (py(target) + 12).toFixed(1) + " H" + px(xm).toFixed(1) + '"/>' +
      label((px(xc) + px(xm)) / 2, py(target) - 8, "LOWER DOSE", "fade copper") +
      label(px(0.66), py(0.5) + 16, "SINGLE AGENT", "fade", "start") +
      label(px(0.45), py(0.93) - 8, "CR-067", "fade bright", "start") +
      // loop actors
      '<line class="viz-base viz-thin cursor" x1="' + PX0 + '" y1="' + PY0 + '" x2="' + PX0 + '" y2="' + PY1 + '" opacity="0.35"/>' +
      circle(PX0, py(CR_MONO(0)), 4.5, "viz-fill-ink dot-m") +
      circle(PX0, py(CR_COMBO(0)), 4.5, "viz-fill-bright dot-c");
    return svg(BVB, body);
  }
  function cr067Anim(s, g) {
    var tl = finish(g.timeline(), s);
    var cur = s.querySelector(".cursor"), dm = s.querySelector(".dot-m"), dc = s.querySelector(".dot-c");
    var st = { t: 0 };
    tl.to(st, {
      t: 1, duration: 3.2, yoyo: true, repeat: -1, ease: "sine.inOut",
      onUpdate: function () {
        var x = px(st.t);
        cur.setAttribute("x1", x); cur.setAttribute("x2", x);
        dm.setAttribute("cx", x); dm.setAttribute("cy", py(CR_MONO(st.t)));
        dc.setAttribute("cx", x); dc.setAttribute("cy", py(CR_COMBO(st.t)));
      },
    }, ">-0.2");
    return tl;
  }
  function cr067Emblem() {
    var body =
      path("M16 82 H84", "viz-base viz-thin") +
      path("M16 78 C48 78 52 24 84 22", "viz-base") +
      path("M16 78 C34 78 36 24 84 22", "viz-bright") +
      circle(50, 50, 3.5, "viz-fill-bright emb-cr-dot");
    return svg(EVB, body);
  }

  // =======================================================================
  // Fig. 2  K-119: release profile. Immediate release spikes past the
  // toxicity threshold and falls below the effective level; the coated
  // extended-release form holds a plateau between them. Loop: a time cursor
  // sweeps with a readout on each curve.
  // =======================================================================
  function K_IR(t) { return t < 0.08 ? Math.pow(t / 0.08, 1.6) * 0.96 : 0.96 * Math.exp(-(t - 0.08) * 6.5); }
  function K_ER(t) { return 0.58 * (1 - Math.exp(-t * 9)) * Math.exp(-Math.max(0, t - 0.55) * 1.3); }
  function k119Banner() {
    var tox = 0.8, eff = 0.3;
    var body =
      axes("TIME", "PLASMA CONC.") +
      '<path class="viz-copper viz-thin viz-dash fade" d="M' + PX0 + " " + py(tox).toFixed(1) + " H" + PX1 + '"/>' +
      label(PX1, py(tox) - 7, "TOXICITY THRESHOLD", "fade copper", "end") +
      '<path class="viz-base viz-thin viz-dash fade" d="M' + PX0 + " " + py(eff).toFixed(1) + " H" + PX1 + '"/>' +
      label(PX1, py(eff) + 15, "EFFECTIVE LEVEL", "fade", "end") +
      poly(K_IR, 80, "viz-base") +
      poly(K_ER, 80, "viz-bright") +
      label(px(0.15), py(0.96) - 8, "IMMEDIATE RELEASE", "fade", "start") +
      label(px(0.62), py(0.58) - 10, "K-119 COATED", "fade bright") +
      '<line class="viz-base viz-thin cursor" x1="' + PX0 + '" y1="' + PY0 + '" x2="' + PX0 + '" y2="' + PY1 + '" opacity="0.35"/>' +
      circle(PX0, PY1, 4.5, "viz-fill-ink dot-m") +
      circle(PX0, PY1, 4.5, "viz-fill-bright dot-c");
    return svg(BVB, body);
  }
  function k119Anim(s, g) {
    var tl = finish(g.timeline(), s);
    var cur = s.querySelector(".cursor"), dm = s.querySelector(".dot-m"), dc = s.querySelector(".dot-c");
    var st = { t: 0 };
    tl.to(st, {
      t: 1, duration: 4.5, repeat: -1, repeatDelay: 0.6, ease: "none",
      onUpdate: function () {
        var x = px(st.t), ir = K_IR(st.t);
        cur.setAttribute("x1", x); cur.setAttribute("x2", x);
        dm.setAttribute("cx", x); dm.setAttribute("cy", py(ir));
        dm.classList.toggle("over", ir > 0.8); // readout turns copper above the threshold
        dc.setAttribute("cx", x); dc.setAttribute("cy", py(K_ER(st.t)));
      },
    }, ">-0.2");
    return tl;
  }
  function k119Emblem() {
    var body =
      path("M16 82 H84", "viz-base viz-thin") +
      path("M14 32 H86", "viz-copper viz-thin viz-dash") +
      path("M16 82 L24 26 C30 60 40 74 84 80", "viz-base") +
      path("M16 82 C26 52 40 50 84 56", "viz-bright") +
      '<line class="viz-base viz-thin emb-k-cursor" x1="20" y1="22" x2="20" y2="82" opacity="0.5"/>';
    return svg(EVB, body);
  }

  // =======================================================================
  // Fig. 3  XTL-152: candidate landscape. Screened molecules plotted by
  // predicted potency against predicted toxicity; the 30 patented hits sit
  // in the selection window, one lead marked. Loop: the lead ring breathes
  // and a scan line sweeps the field.
  // =======================================================================
  function xtlPoints() {
    // deterministic scatter (seeded LCG) so the figure is stable across loads
    var seed = 7, pts = [], i;
    function rnd() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }
    for (i = 0; i < 70; i++) pts.push({ x: 0.08 + rnd() * 0.88, y: 0.06 + rnd() * 0.6, hit: false });
    for (i = 0; i < 30; i++) pts.push({ x: 0.08 + rnd() * 0.3, y: 0.62 + rnd() * 0.3, hit: true });
    return pts;
  }
  var XTL_LEAD = { x: 0.19, y: 0.84 };
  function xtlBanner() {
    var pts = xtlPoints(), dots = "";
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      dots += circle(px(p.x).toFixed(1), py(p.y).toFixed(1), p.hit ? 3.5 : 2.5, (p.hit ? "viz-fill-bright hit" : "viz-fill-ink pt"));
    }
    var wx0 = px(0.05), wy0 = py(0.96), ww = px(0.41) - wx0, wh = py(0.58) - wy0;
    var body =
      axes("PREDICTED TOXICITY", "PREDICTED POTENCY") +
      dots +
      '<rect class="viz-bright viz-thin viz-dash fade" x="' + wx0.toFixed(1) + '" y="' + wy0.toFixed(1) + '" width="' + ww.toFixed(1) + '" height="' + wh.toFixed(1) + '" rx="6"/>' +
      label(wx0 + ww + 8, wy0 + 14, "30 PATENTED HITS", "fade bright", "start") +
      circle(px(XTL_LEAD.x).toFixed(1), py(XTL_LEAD.y).toFixed(1), 5, "viz-fill-bright lead") +
      '<circle class="viz-bright ring" cx="' + px(XTL_LEAD.x).toFixed(1) + '" cy="' + py(XTL_LEAD.y).toFixed(1) + '" r="10"/>' +
      label(px(XTL_LEAD.x) + 16, py(XTL_LEAD.y) + 4, "LEAD", "fade bright", "start") +
      '<line class="viz-bright scan" x1="' + PX0 + '" y1="' + PY0 + '" x2="' + PX0 + '" y2="' + PY1 + '" opacity="0.4"/>';
    return svg(BVB, body);
  }
  function xtlAnim(s, g) {
    var tl = g.timeline();
    tl.from(s.querySelectorAll(".draw"), { strokeDashoffset: 1, duration: 0.6, ease: "power2.out" }, 0)
      .from(s.querySelectorAll(".pt"), { opacity: 0, scale: 0, transformOrigin: "50% 50%", stagger: { each: 0.012, from: "random" }, duration: 0.35, ease: "power2.out" }, 0.2)
      .from(s.querySelectorAll(".hit"), { opacity: 0, scale: 0, transformOrigin: "50% 50%", stagger: { each: 0.03, from: "random" }, duration: 0.4, ease: "back.out(2)" }, 0.9)
      .from(s.querySelectorAll(".fade"), { opacity: 0, duration: 0.5, stagger: 0.1 }, 1.3)
      .from(s.querySelector(".lead"), { scale: 0, transformOrigin: "50% 50%", duration: 0.4, ease: "back.out(2.5)" }, 1.6)
      .fromTo(s.querySelector(".ring"), { attr: { r: 6 }, opacity: 0.9 }, { attr: { r: 16 }, opacity: 0, repeat: -1, duration: 1.8, ease: "power1.out" }, 2.0)
      .fromTo(s.querySelector(".scan"), { attr: { x1: PX0, x2: PX0 } }, { attr: { x1: PX1, x2: PX1 }, repeat: -1, repeatDelay: 1.2, duration: 3.2, ease: "none" }, 2.0);
    return tl;
  }
  function xtlEmblem() {
    var dots = "", seed = 3;
    function rnd() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }
    for (var i = 0; i < 14; i++) dots += circle((26 + rnd() * 58).toFixed(1), (36 + rnd() * 44).toFixed(1), 2.2, "viz-fill-ink");
    for (var j = 0; j < 6; j++) dots += circle((24 + rnd() * 20).toFixed(1), (20 + rnd() * 18).toFixed(1), 2.6, "viz-fill-bright");
    var body =
      path("M16 82 H84", "viz-base viz-thin") + path("M16 82 V18", "viz-base viz-thin") +
      dots +
      '<rect class="viz-bright viz-thin viz-dash" x="20" y="16" width="28" height="26" rx="3"/>' +
      '<circle class="viz-bright emb-x-sel" cx="34" cy="29" r="5"/>';
    return svg(EVB, body);
  }

  // ---- registry ---------------------------------------------------------
  var VIZ = {
    cr067: { emblem: cr067Emblem, banner: cr067Banner, anim: cr067Anim },
    k119: { emblem: k119Emblem, banner: k119Banner, anim: k119Anim },
    xtl: { emblem: xtlEmblem, banner: xtlBanner, anim: xtlAnim },
  };

  // ---- inject -----------------------------------------------------------
  var i, host, key;
  var emblems = document.querySelectorAll("[data-viz-emblem]");
  for (i = 0; i < emblems.length; i++) {
    host = emblems[i];
    key = host.getAttribute("data-viz-emblem");
    if (VIZ[key]) host.innerHTML = VIZ[key].emblem();
  }
  var banners = document.querySelectorAll("[data-viz-banner]");
  for (i = 0; i < banners.length; i++) {
    host = banners[i];
    key = host.getAttribute("data-viz-banner");
    if (VIZ[key]) host.insertAdjacentHTML("afterbegin", VIZ[key].banner());
  }

  // ---- animate (skip entirely under reduced motion / no GSAP) -----------
  if (reduce || !G) return;

  // Each figure builds its timeline the first time it scrolls into view,
  // then plays while visible and pauses off-screen.
  var banners2 = document.querySelectorAll("[data-viz-banner]");
  if ("IntersectionObserver" in window) {
    var vio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var b = e.target, k = b.getAttribute("data-viz-banner"), s = b.querySelector("svg");
        if (!s || !VIZ[k]) return;
        if (e.isIntersecting) {
          if (!b._tl) { b._tl = VIZ[k].anim(s, G); b._tl.play(0); } else b._tl.play();
        } else if (b._tl) {
          b._tl.pause();
        }
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.2 });
    for (i = 0; i < banners2.length; i++) vio.observe(banners2[i]);
  }

  // Idle the always-on emblem loops while the pipeline is off-screen.
  var pipeline = document.getElementById("pipeline");
  if (pipeline && "IntersectionObserver" in window) {
    new IntersectionObserver(
      function (entries) {
        pipeline.classList.toggle("viz-paused", !entries[0].isIntersecting);
      },
      { threshold: 0 }
    ).observe(pipeline);
  }
})();
