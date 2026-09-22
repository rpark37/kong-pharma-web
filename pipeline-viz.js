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
  var BVB = "0 0 640 240"; // banner viewBox
  var EVB = "0 0 100 100"; // emblem viewBox

  // =======================================================================
  // CR-067 — combination therapy: two molecules converge into one; a vessel
  // opens with a flowing pulse.
  // =======================================================================
  function cr067Banner() {
    var arrow =
      path("M330 120 L392 120", "viz-base", true) +
      '<path class="viz-base draw" pathLength="1" d="M392 120 l-12 -7 M392 120 l-12 7"/>';
    var body =
      // two input molecules + plus
      path(hex(120, 120, 34), "viz-base", true) +
      path(hex(250, 120, 34), "viz-teal", true) +
      '<path class="viz-base draw" pathLength="1" d="M185 106 v28 M171 120 h28"/>' +
      arrow +
      // combined molecule (overlapping hexagons)
      '<g class="merge">' +
      path(hex(430, 120, 32), "viz-base", true) +
      path(hex(460, 120, 32), "viz-teal", true) +
      "</g>" +
      // vessel + dilation + flow dot
      path("M96 196 H544", "viz-deep", true) +
      '<ellipse class="viz-deep dilate" cx="445" cy="196" rx="34" ry="10"/>' +
      circle(96, 196, 5, "viz-fill-teal flow");
    return svg(BVB, body);
  }
  function cr067Anim(s, g) {
    var tl = g.timeline();
    tl.from(s.querySelectorAll(".draw"), {
      strokeDashoffset: 1,
      duration: 0.3,
      stagger: 0.06,
      ease: "expo.out",
    })
      .from(s.querySelector(".merge"), { scale: 0, opacity: 0, transformOrigin: "50% 50%", ease: "expo.out", duration: 0.3 }, "-=0.2")
      .fromTo(s.querySelector(".dilate"), { scaleY: 0.2, transformOrigin: "50% 50%" }, { scaleY: 1, yoyo: true, repeat: -1, duration: 1.1, ease: "sine.inOut" }, ">-0.1")
      .fromTo(s.querySelector(".flow"), { attr: { cx: 96 } }, { attr: { cx: 544 }, repeat: -1, duration: 2.2, ease: "none" }, "<");
    return tl;
  }
  function cr067Emblem() {
    var body =
      path("M16 74 H84", "viz-deep") +
      path(hex(40, 44, 16), "viz-teal emb-cr-l") +
      path(hex(60, 44, 16), "viz-base emb-cr-r") +
      circle(16, 74, 3.5, "viz-fill-teal emb-cr-dot");
    return svg(EVB, body);
  }

  // =======================================================================
  // K-119 — coated capsule releases particles; a Rac1 switch flips OFF; a
  // tumor cluster shrinks.
  // =======================================================================
  function k119Banner() {
    var particles = "";
    for (var i = 0; i < 4; i++) {
      particles += circle(150, 108, 4.5, "viz-fill-teal particle kp" + i);
    }
    var cell = "";
    var cc = [[470, 110], [500, 96], [514, 124], [488, 134], [460, 140]];
    for (var j = 0; j < cc.length; j++) cell += circle(cc[j][0], cc[j][1], 16, "viz-base");
    var body =
      // capsule + dashed coat
      '<g transform="rotate(-22 118 108)">' +
      '<rect class="viz-base draw" pathLength="1" x="66" y="90" width="104" height="36" rx="18"/>' +
      '<line class="viz-base draw" pathLength="1" x1="118" y1="90" x2="118" y2="126"/>' +
      '<rect class="viz-teal coat" x="58" y="82" width="120" height="52" rx="26" stroke-dasharray="4 5"/>' +
      "</g>" +
      particles +
      // Rac1 switch
      '<rect class="viz-deep draw" pathLength="1" x="266" y="150" width="96" height="34" rx="17"/>' +
      circle(283, 167, 11, "viz-fill-teal knob") +
      '<text class="viz-label on-lab" x="300" y="140">RAC1</text>' +
      // tumor cluster
      '<g class="cell">' + cell + "</g>";
    return svg(BVB, body);
  }
  function k119Anim(s, g) {
    var tl = g.timeline();
    tl.from(s.querySelectorAll(".draw"), { strokeDashoffset: 1, duration: 0.3, stagger: 0.05, ease: "expo.out" })
      .from(s.querySelector(".coat"), { opacity: 0, duration: 0.3 }, "-=0.3")
      .to(s.querySelector(".knob"), { attr: { cx: 345 }, duration: 0.3, ease: "power3.inOut" }, ">")
      .to(s.querySelector(".on-lab"), { opacity: 0.4, duration: 0.3 }, "<")
      .to(s.querySelector(".cell"), { scale: 0.62, opacity: 0.75, transformOrigin: "50% 50%", duration: 0.3, ease: "power3.inOut" }, "<")
      .to(s.querySelectorAll(".particle"), { x: 300, opacity: 0, stagger: 0.14, repeat: -1, repeatDelay: 0.2, duration: 1.6, ease: "power1.in" }, ">-0.2")
      .to(s.querySelector(".cell"), { scale: 0.55, transformOrigin: "50% 50%", yoyo: true, repeat: -1, duration: 1.4, ease: "sine.inOut" }, "<");
    return tl;
  }
  function k119Emblem() {
    var body =
      '<g transform="rotate(-22 41 40)">' +
      '<rect class="viz-base" x="26" y="32" width="34" height="16" rx="8"/>' +
      '<rect class="viz-teal" x="22" y="28" width="42" height="24" rx="12" stroke-dasharray="3 3"/>' +
      "</g>" +
      circle(60, 40, 3, "viz-fill-teal emb-k-dot1") +
      circle(60, 40, 3, "viz-fill-teal emb-k-dot2") +
      path("M30 80 H70", "viz-deep") +
      circle(34, 80, 4, "viz-fill-teal emb-k-knob") +
      '<g class="emb-k-cell">' + circle(74, 30, 6, "viz-base") + circle(84, 36, 6, "viz-base") + circle(76, 42, 6, "viz-base") + "</g>";
    return svg(EVB, body);
  }

  // =======================================================================
  // XTL-152 — AI scan sweeps a matrix of candidate molecules, selects one,
  // wires a neural net to a Rac1 / brain target.
  // =======================================================================
  function xtlBanner() {
    var nodes = "";
    var cols = 6, rows = 5, x0 = 70, y0 = 60, dx = 42, dy = 34;
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var sel = r === 2 && c === 4;
        nodes += circle(x0 + c * dx, y0 + r * dy, sel ? 8 : 5, (sel ? "viz-fill-teal sel" : "viz-base node") );
      }
    }
    var selX = x0 + 4 * dx, selY = y0 + 2 * dy;
    var brain =
      '<path class="viz-deep draw brain" pathLength="1" d="M556 96 c-22 -26 -60 -18 -60 14 c0 30 34 40 58 24 c18 18 52 6 50 -22 c14 -22 -18 -50 -48 -16 Z"/>' +
      '<path class="viz-deep draw brain" pathLength="1" d="M540 92 c-8 12 -8 34 4 46"/>';
    var net =
      path("M" + selX + " " + selY + " C 470 90, 500 110, 536 118", "viz-teal", true) +
      path("M" + selX + " " + selY + " C 470 150, 505 150, 532 136", "viz-teal", true);
    var body =
      nodes +
      '<line class="viz-bright scan" x1="60" y1="44" x2="60" y2="196"/>' +
      '<g class="netg">' + net + "</g>" +
      brain;
    return svg(BVB, body);
  }
  function xtlAnim(s, g) {
    var tl = g.timeline();
    tl.from(s.querySelectorAll(".node"), { opacity: 0, scale: 0, transformOrigin: "center", stagger: { each: 0.02, from: "start" }, duration: 0.3, ease: "expo.out" })
      .from(s.querySelector(".sel"), { opacity: 0, scale: 0, transformOrigin: "50% 50%", duration: 0.3, ease: "expo.out" }, "-=0.1")
      .from(s.querySelectorAll(".netg .draw"), { strokeDashoffset: 1, stagger: 0.1, duration: 0.3, ease: "expo.out" }, ">-0.1")
      .from(s.querySelectorAll(".brain"), { strokeDashoffset: 1, stagger: 0.1, duration: 0.3, ease: "expo.out" }, "<")
      .fromTo(s.querySelector(".scan"), { attr: { x1: 60, x2: 60 } }, { attr: { x1: 300, x2: 300 }, repeat: -1, duration: 2.4, ease: "none" }, 0)
      .to(s.querySelector(".sel"), { scale: 1.25, transformOrigin: "50% 50%", yoyo: true, repeat: -1, duration: 0.9, ease: "sine.inOut" }, ">");
    return tl;
  }
  function xtlEmblem() {
    var nodes = "";
    for (var r = 0; r < 3; r++)
      for (var c = 0; c < 3; c++) {
        var sel = r === 1 && c === 1;
        nodes += circle(28 + c * 16, 30 + r * 16, sel ? 4 : 3, sel ? "viz-teal emb-x-sel" : "viz-base");
      }
    var body =
      nodes +
      '<line class="viz-bright emb-x-scan" x1="20" y1="22" x2="20" y2="70"/>' +
      path("M44 46 H80", "viz-deep") +
      circle(80, 46, 3.5, "viz-fill-teal");
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

  var programs = document.querySelectorAll("details.program");
  for (i = 0; i < programs.length; i++) {
    (function (details) {
      var b = details.querySelector("[data-viz-banner]");
      if (!b) return;
      var k = b.getAttribute("data-viz-banner");
      var s = b.querySelector("svg");
      if (!s || !VIZ[k]) return;
      // Build lazily on first open so GSAP reads valid bounding boxes for
      // scale/rotate origins (a collapsed display:none <details> reports 0).
      var tl = null;
      details.addEventListener("toggle", function () {
        if (details.open) {
          if (!tl) tl = VIZ[k].anim(s, G);
          tl.restart();
        } else if (tl) {
          tl.pause();
        }
      });
    })(programs[i]);
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
