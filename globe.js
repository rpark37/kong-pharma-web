// Contact-section globe: a dotted-continent Earth in the site's teal-on-ink
// style, slowly turning, draggable with the mouse / touch. Ballistic arcs
// launch from Lowell, MA to partner sites; a screen-space label tracks Lowell.
import * as THREE from "three";

const host = document.querySelector("[data-globe]");
const canvas = host && host.querySelector("canvas");
if (host && canvas) init();

function init() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const TEAL = 0x44e0cc;
  const MINT = 0xe6fff8;
  const AMBER = 0xe0559f; // fluorophore magenta: the site's secondary accent
  const INK = 0x121c24;
  const R = 1;

  // Sites: [name, lat, lon]. First entry is the origin of every arc.
  const ORIGIN = ["Lowell, MA", 42.6334, -71.3162];
  const SITES = [
    ["Boston, MA · XtalPi demo lab", 42.3601, -71.0589],
    ["Lahey Hospital & Medical Center · Burlington, MA", 42.5048, -71.1956],
    ["UMass Chan Medical School · Worcester, MA", 42.2762, -71.7612],
    ["Shanghai", 31.2304, 121.4737],
    ["Shenzhen · XtalPi", 22.5431, 114.0579],
    ["Hong Kong", 22.3193, 114.1694],
    ["Brisbane", -27.4698, 153.0251],
    ["Novotech · Sydney", -33.8688, 151.2093],
  ];

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  // Camera sits back far enough that the highest trajectories (≈1.5 R) stay in frame
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
  camera.position.set(0, 0, 4.4);

  // tilt (drag up/down) > globe (spin about its own axis)
  const tilt = new THREE.Group();
  tilt.rotation.set(0.28, 0, 0.12);
  scene.add(tilt);
  const globe = new THREE.Group();
  tilt.add(globe);

  // lon 0 faces the camera; rotate so the origin site starts front and centre
  const spin = { y: THREE.MathUtils.degToRad(-ORIGIN[2]), x: 0, vy: 0, vx: 0 };

  const toVec = (lat, lon, r = R) => {
    const la = THREE.MathUtils.degToRad(lat);
    const lo = THREE.MathUtils.degToRad(lon);
    return new THREE.Vector3(r * Math.cos(la) * Math.sin(lo), r * Math.sin(la), r * Math.cos(la) * Math.cos(lo));
  };

  // ---- Easing helpers ----
  const easeInOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
  const smooth = (x) => x * x * (3 - 2 * x);

  // ---- Body: dark sphere occludes the far side of the dot field ----
  globe.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(R * 0.995, 64, 48),
      new THREE.MeshBasicMaterial({ color: 0x0f181f }) // ocean: the site's ink
    )
  );

  // ---- Fresnel rim glow: bright at the limb, clear at the centre ----
  globe.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.002, 64, 48),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uColor: { value: new THREE.Color(TEAL) } },
        vertexShader: `
          varying float vRim;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vec3 n = normalize(normalMatrix * normal);
            vRim = 1.0 - abs(dot(n, normalize(-mv.xyz)));
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          uniform vec3 uColor;
          varying float vRim;
          void main() { gl_FragColor = vec4(uColor, pow(vRim, 3.2) * 0.55); }`,
      })
    )
  );

  // ---- Graticule: faint 30° grid ----
  {
    const pts = [];
    const STEP = 30, SEG = 90;
    for (let lat = -60; lat <= 60; lat += STEP)
      for (let i = 0; i < SEG; i++) {
        pts.push(toVec(lat, (i / SEG) * 360, R * 1.001), toVec(lat, ((i + 1) / SEG) * 360, R * 1.001));
      }
    for (let lon = 0; lon < 360; lon += STEP)
      for (let i = 0; i < SEG; i++) {
        pts.push(toVec(-90 + (i / SEG) * 180, lon, R * 1.001), toVec(-90 + ((i + 1) / SEG) * 180, lon, R * 1.001));
      }
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    globe.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: TEAL, transparent: true, opacity: 0.07 })));
  }

  // ---- Continents as a dot field, sampled from an equirectangular land mask ----
  const img = new Image();
  img.src = "assets/land-mask.png";
  img.onload = () => {
    const W = img.naturalWidth, H = img.naturalHeight;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, W, H).data;
    const isLand = (lat, lon) => {
      const x = Math.min(W - 1, Math.max(0, Math.floor(((lon + 180) / 360) * W)));
      const y = Math.min(H - 1, Math.max(0, Math.floor(((90 - lat) / 180) * H)));
      return data[(y * W + x) * 4] > 127;
    };
    // Fibonacci sphere: evenly spaced sample points
    const N = 22000;
    const pos = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const lat = THREE.MathUtils.radToDeg(Math.asin(y));
      const lon = THREE.MathUtils.radToDeg((golden * i) % (Math.PI * 2)) - 180;
      if (isLand(lat, lon)) {
        const v = toVec(lat, lon, R * 1.004);
        pos.push(v.x, v.y, v.z);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    globe.add(
      new THREE.Points(
        g,
        new THREE.PointsMaterial({ color: 0x8cf3e3, size: 0.014, transparent: true, opacity: 1, sizeAttenuation: true })
      )
    );
    render();
  };

  // ---- Soft radial sprite used for comet heads and particles ----
  const glowSprite = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.35, "rgba(230,255,248,0.6)");
    grad.addColorStop(1, "rgba(68,224,204,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();

  // ---- Site markers: dot + gently breathing ring flat against the surface ----
  const rings = [];
  const surfaceRing = (p, inner, outer, color, opacity) => {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(inner, outer, 40),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false })
    );
    ring.position.copy(p);
    ring.lookAt(p.clone().multiplyScalar(2));
    return ring;
  };
  const addMarker = (lat, lon, isOrigin) => {
    const p = toVec(lat, lon, R * 1.006);
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(isOrigin ? 0.02 : 0.011, 12, 12),
      new THREE.MeshBasicMaterial({ color: isOrigin ? MINT : TEAL })
    );
    dot.position.copy(p);
    globe.add(dot);
    const ring = surfaceRing(p, isOrigin ? 0.024 : 0.016, isOrigin ? 0.032 : 0.022, isOrigin ? MINT : TEAL, 0.6);
    ring.userData.phase = Math.random() * Math.PI * 2;
    globe.add(ring);
    rings.push(ring);
    return p;
  };
  const originP = addMarker(ORIGIN[1], ORIGIN[2], true);
  SITES.forEach(([, lat, lon]) => addMarker(lat, lon, false));

  // ---- Screen-space labels that follow their markers around the globe ----
  const makeLabel = (lat, lon, text, sub) => {
    const el = document.createElement("div");
    el.className = "globe-label";
    el.innerHTML = `<span class="globe-label__dot"></span><span class="globe-label__text">${text}</span><span class="globe-label__sub">${sub}</span>`;
    host.appendChild(el);
    return { el, anchor: toVec(lat, lon, R * 1.02) };
  };
  const labels = [
    makeLabel(ORIGIN[1], ORIGIN[2], "Lowell, MA", "Kong’s Pharmaceutical · HQ"),
    makeLabel(-33.8688, 151.2093, "Sydney, Australia", "Novotech · clinical research partner"),
  ];
  // one extra chip for whichever site was clicked (permanent ones stay put)
  const focusLabel = makeLabel(0, 0, "", "");
  focusLabel.hidden = true;
  labels.push(focusLabel);
  const tmpV = new THREE.Vector3();
  const tmpN = new THREE.Vector3();
  const camDir = new THREE.Vector3();
  const placeLabel = () => {
    labels.forEach(({ el, anchor, hidden }) => {
      if (hidden) { el.style.opacity = "0"; return; }
      tmpV.copy(anchor);
      globe.localToWorld(tmpV);
      tmpN.copy(tmpV).normalize();
      camDir.copy(camera.position).sub(tmpV).normalize();
      const facing = tmpN.dot(camDir); // > 0: on the near side of the globe
      tmpV.project(camera);
      const x = (tmpV.x * 0.5 + 0.5) * host.clientWidth;
      const y = (-tmpV.y * 0.5 + 0.5) * host.clientHeight;
      // keep the chip inside the box on both sides: prefer sitting to the
      // right of the marker, otherwise slide it left, never past either edge
      const w = el.offsetWidth, pad = 8;
      let left = x + 10;
      if (left + w > host.clientWidth - pad) left = Math.max(pad, x - 10 - w);
      left = Math.min(Math.max(left, pad), Math.max(pad, host.clientWidth - w - pad));
      el.style.transform = `translate(${left.toFixed(1)}px, ${y.toFixed(1)}px)`;
      el.style.opacity = facing > 0.08 ? String(Math.min(1, (facing - 0.08) * 4)) : "0";
    });
  };

  // ---- Clickable site chips: tween the globe to centre a site, show its label ----
  const focus = { active: false, t0: 0, dur: 1.4, fromY: 0, fromX: 0, toY: 0, toX: 0 };
  let idleUntil = 0; // auto-rotation resumes after this timestamp (seconds)
  const TWO_PI = Math.PI * 2;
  const siteButtons = [...document.querySelectorAll(".globe-site")];
  const focusOn = (btn) => {
    const lat = parseFloat(btn.dataset.lat), lon = parseFloat(btn.dataset.lon);
    // face the longitude: same convention as the initial spin (lon 0 faces the camera)
    let toY = THREE.MathUtils.degToRad(-lon);
    const cur = spin.y;
    toY = cur + ((((toY - cur) % TWO_PI) + TWO_PI * 1.5) % TWO_PI) - Math.PI; // shortest way round
    const toX = THREE.MathUtils.clamp(THREE.MathUtils.degToRad(lat) - 0.28, -0.9, 0.9);
    Object.assign(focus, { active: true, t0: performance.now(), fromY: spin.y, fromX: spin.x, toY, toX });
    spin.vy = spin.vx = 0;
    idleUntil = performance.now() / 1000 + 9;
    siteButtons.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
    if (typeof window.gtag === "function") window.gtag("event", "site_focus", { site: btn.textContent.trim() });
    // permanent labels already cover Lowell and Sydney; anything else gets the focus chip
    const permanent = labels.slice(0, 2).some(({ anchor }) => anchor.angleTo(toVec(lat, lon, R * 1.02)) < 0.01);
    if (permanent) { focusLabel.hidden = true; return; }
    focusLabel.el.querySelector(".globe-label__text").textContent = btn.textContent.trim();
    focusLabel.el.querySelector(".globe-label__sub").textContent = btn.dataset.sub || "";
    focusLabel.anchor.copy(toVec(lat, lon, R * 1.02));
    focusLabel.hidden = false;
  };
  siteButtons.forEach((b) => b.addEventListener("click", () => focusOn(b)));

  // ---- Ballistic arcs: one high apex mid-flight; head + tapering plume ----
  const SAMPLES = 200;
  const TRAIL = 60;
  const FLIGHT = 0.64; // fraction of each cycle spent in flight
  const comets = [];
  const origin = toVec(ORIGIN[1], ORIGIN[2]);
  SITES.forEach(([, lat, lon], i) => {
    const dest = toVec(lat, lon);
    const angle = origin.angleTo(dest);
    // Quadratic path: the apex sits at R + lift/2, so a trans-Pacific shot
    // peaks near 1.5 R and even the short New England hops loft visibly.
    const lift = 0.2 + 0.9 * Math.pow(angle / Math.PI, 0.9);
    const mid = new THREE.Vector3().copy(origin).lerp(dest, 0.5).normalize().multiplyScalar(R + lift);
    const curve = new THREE.QuadraticBezierCurve3(origin.clone(), mid, dest.clone());
    const pts = curve.getPoints(SAMPLES);

    // faint static trajectory
    globe.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: TEAL, transparent: true, opacity: 0.12 })
      )
    );

    // plume: TRAIL vertices re-filled each frame; colour fades head -> tail
    const tailPos = new Float32Array(TRAIL * 3);
    const tailCol = new Float32Array(TRAIL * 3);
    const stops = [new THREE.Color(0xffffff), new THREE.Color(MINT), new THREE.Color(TEAL), new THREE.Color(INK)];
    for (let k = 0; k < TRAIL; k++) {
      const f = Math.pow(k / (TRAIL - 1), 0.8) * (stops.length - 1);
      const s = Math.min(stops.length - 2, Math.floor(f));
      const col = stops[s].clone().lerp(stops[s + 1], f - s);
      tailCol.set([col.r, col.g, col.b], k * 3);
    }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute("position", new THREE.BufferAttribute(tailPos, 3));
    tg.setAttribute("color", new THREE.BufferAttribute(tailCol, 3));
    const tailLine = new THREE.Line(
      tg,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending })
    );
    tailLine.visible = false;
    globe.add(tailLine);

    const head = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glowSprite, color: MINT, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    head.scale.setScalar(0.1);
    head.visible = false;
    globe.add(head);

    // ripples: launch at the pad, arrival at the target
    const launchRipple = surfaceRing(originP.clone().multiplyScalar(1.002), 0.024, 0.03, MINT, 0);
    const landRipple = surfaceRing(dest.clone().multiplyScalar(1.008), 0.018, 0.024, AMBER, 0);
    globe.add(launchRipple, landRipple);

    comets.push({
      pts, tailPos, tg, tailLine, head, launchRipple, landRipple,
      // unhurried cadence, staggered per site so launches never bunch up
      period: 5.5 + angle * 1.3,
      offset: i * 1.7,
    });
  });

  // ---- Particle traffic: small glowing points streaming along low arcs
  //      between every pair of sites, in both directions ----
  const ALL = [ORIGIN, ...SITES].map(([, la, lo]) => toVec(la, lo));
  const PAIR_SAMPLES = 120;
  const pairArcs = [];
  for (let a = 0; a < ALL.length; a++) {
    for (let b = a + 1; b < ALL.length; b++) {
      const angle = ALL[a].angleTo(ALL[b]);
      if (angle < 0.015) continue; // neighbouring New England sites: too short to read
      const lift = 0.04 + 0.3 * Math.pow(angle / Math.PI, 0.85);
      const slerp = (t) => new THREE.Vector3().copy(ALL[a]).lerp(ALL[b], t).normalize();
      const curve = new THREE.CubicBezierCurve3(
        ALL[a].clone(), slerp(0.25).multiplyScalar(R + lift), slerp(0.75).multiplyScalar(R + lift), ALL[b].clone()
      );
      const pts = curve.getPoints(PAIR_SAMPLES);
      pairArcs.push(pts);
      globe.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({ color: TEAL, transparent: true, opacity: 0.05 })
        )
      );
    }
  }
  const PER_ARC = (window.innerWidth || 1280) < 600 ? 0 : 3; // no particle traffic on phones
  const particles = [];
  const pPos = new Float32Array(pairArcs.length * PER_ARC * 3);
  pairArcs.forEach((pts, arc) => {
    for (let k = 0; k < PER_ARC; k++) {
      particles.push({ arc, t: Math.random(), speed: 0.04 + Math.random() * 0.06, dir: Math.random() < 0.5 ? 1 : -1 });
    }
  });
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  const traffic = new THREE.Points(
    pGeo,
    new THREE.PointsMaterial({
      map: glowSprite, color: TEAL, size: 0.026, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    })
  );
  globe.add(traffic);
  const stepTraffic = (dt) => {
    particles.forEach((p, i) => {
      p.t += p.speed * p.dir * dt;
      if (p.t > 1) p.t -= 1; else if (p.t < 0) p.t += 1;
      const q = pairArcs[p.arc][Math.round(p.t * PAIR_SAMPLES)];
      pPos[i * 3] = q.x; pPos[i * 3 + 1] = q.y; pPos[i * 3 + 2] = q.z;
    });
    pGeo.attributes.position.needsUpdate = true;
  };
  stepTraffic(0);

  // ---- Interaction: drag to spin/tilt with inertia; auto-rotate when idle ----
  let dragging = false, lastX = 0, lastY = 0;
  const onDown = (e) => {
    dragging = true; lastX = e.clientX; lastY = e.clientY; spin.vy = spin.vx = 0;
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
  };
  const onMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    spin.vy = dx * 0.006; spin.vx = dy * 0.004;
    spin.y += spin.vy; spin.x = THREE.MathUtils.clamp(spin.x + spin.vx, -0.9, 0.9);
  };
  const onUp = () => { dragging = false; };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("pointerleave", onUp);

  // ---- Sizing (square box from CSS; the preview pane can report 0) ----
  const resize = () => {
    const w = host.clientWidth || 480, h = host.clientHeight || w;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  if (typeof ResizeObserver === "function") new ResizeObserver(resize).observe(host);
  else window.addEventListener("resize", resize);

  // ---- Loop: only while on screen ----
  let visible = true, raf = 0, last = performance.now();
  if (typeof IntersectionObserver === "function") {
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
    }, { threshold: 0.05 }).observe(host);
  }

  function render() { renderer.render(scene, camera); placeLabel(); }

  function tick(now) {
    raf = 0;
    if (!visible) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;

    if (dragging) {
      focus.active = false;
      idleUntil = 0;
    } else if (focus.active) {
      // glide to the chosen site
      const k = Math.min(1, (now - focus.t0) / (focus.dur * 1000));
      const e = easeInOutCubic(k);
      spin.y = focus.fromY + (focus.toY - focus.fromY) * e;
      spin.x = focus.fromX + (focus.toX - focus.fromX) * e;
      if (k >= 1) focus.active = false;
    } else {
      // inertia, then ease back into the slow idle rotation (paused while a site is in focus)
      spin.vy *= 0.94; spin.vx *= 0.9;
      spin.y += spin.vy; spin.x += spin.vx;
      if (!reduce && t > idleUntil) {
        spin.y += 0.11 * dt; // ~57 s per revolution
        spin.x *= 0.995; // drift the tilt back toward level
      }
    }
    globe.rotation.y = spin.y;
    tilt.rotation.x = 0.28 + spin.x;

    rings.forEach((r) => {
      const k = 0.5 + 0.5 * Math.sin(t * 1.1 + r.userData.phase); // slow, gentle breath
      r.scale.setScalar(1 + 0.12 * k);
      r.material.opacity = 0.6 - 0.2 * k;
    });

    if (!reduce) {
      stepTraffic(dt);
      comets.forEach((c) => {
        const cycle = (t + c.offset) % c.period;
        const u = cycle / c.period;
        const flight = u / FLIGHT; // 0..1 while in flight

        // launch ripple: a ring that spreads from the pad over the first 0.8 s
        if (cycle < 0.8) {
          const k = cycle / 0.8;
          c.launchRipple.scale.setScalar(1 + 4 * easeOutCubic(k));
          c.launchRipple.material.opacity = 0.7 * (1 - k);
        } else c.launchRipple.material.opacity = 0;

        if (flight <= 1) {
          // ballistic pacing: boost off the pad, coast through the apex, ease into the target
          const p = easeInOutCubic(flight);
          const headIdx = p * SAMPLES;
          // plume length breathes with speed: longest through the middle of the flight
          const stretch = 0.5 + 0.7 * Math.sin(flight * Math.PI);
          for (let k = 0; k < TRAIL; k++) {
            const idx = THREE.MathUtils.clamp(Math.round(headIdx - k * stretch), 0, SAMPLES);
            const q = c.pts[idx];
            c.tailPos.set([q.x, q.y, q.z], k * 3);
          }
          c.tg.attributes.position.needsUpdate = true;
          c.tailLine.visible = true;
          // fade the plume in at launch and out on approach
          c.tailLine.material.opacity = 0.9 * smooth(Math.min(1, flight * 6)) * smooth(Math.min(1, (1 - flight) * 4 + 0.15));
          c.head.position.copy(c.pts[Math.round(headIdx)]);
          c.head.visible = true;
          c.head.scale.setScalar(0.08 + 0.05 * Math.sin(flight * Math.PI)); // brightest at apex
          c.landRipple.material.opacity = 0;
        } else {
          c.tailLine.visible = c.head.visible = false;
          // arrival ripple in the first second after touchdown
          const since = cycle - FLIGHT * c.period;
          if (since < 1.1) {
            const k = since / 1.1;
            c.landRipple.scale.setScalar(1 + 5 * easeOutCubic(k));
            c.landRipple.material.opacity = 0.8 * (1 - k);
          } else c.landRipple.material.opacity = 0;
        }
      });
    }

    render();
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);
}
