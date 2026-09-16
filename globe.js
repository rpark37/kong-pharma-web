// Contact-section globe: a dotted-continent Earth in the site's teal-on-ink
// style, slowly turning, draggable with the mouse / touch, with comet-like
// arcs launching from Lowell, MA to partner sites.
import * as THREE from "three";

const host = document.querySelector("[data-globe]");
const canvas = host && host.querySelector("canvas");
if (host && canvas) init();

function init() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const TEAL = 0x44e0cc;
  const MINT = 0xe6fff8;
  const INK = 0x121c24;
  const R = 1;

  // Sites: [name, lat, lon]. First entry is the origin of every arc.
  const ORIGIN = ["Lowell, MA", 42.6334, -71.3162];
  const SITES = [
    ["Boston, MA · XtalPi demo lab", 42.3601, -71.0589],
    ["Lahey Hospital & Medical Center · Burlington, MA", 42.5048, -71.1956],
    ["UMass Chan Medical School · Worcester, MA", 42.2762, -71.7612],
    ["Green Campsites · Exeter", 42.9814, -70.9478],
    ["Shanghai", 31.2304, 121.4737],
    ["Shenzhen · XtalPi", 22.5431, 114.0579],
    ["Hong Kong", 22.3193, 114.1694],
    ["Brisbane", -27.4698, 153.0251],
  ];

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 50);
  camera.position.set(0, 0, 3.4);

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

  // ---- Body: dark sphere occludes the far side of the dot field ----
  globe.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(R * 0.995, 64, 48),
      new THREE.MeshBasicMaterial({ color: 0x15222c })
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
        new THREE.PointsMaterial({ color: TEAL, size: 0.0115, transparent: true, opacity: 0.9, sizeAttenuation: true })
      )
    );
    render();
  };

  // ---- Site markers: dot + pulsing ring flat against the surface ----
  const rings = [];
  const addMarker = (lat, lon, isOrigin) => {
    const p = toVec(lat, lon, R * 1.006);
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(isOrigin ? 0.02 : 0.011, 12, 12),
      new THREE.MeshBasicMaterial({ color: isOrigin ? MINT : TEAL })
    );
    dot.position.copy(p);
    globe.add(dot);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(isOrigin ? 0.024 : 0.016, isOrigin ? 0.032 : 0.022, 32),
      new THREE.MeshBasicMaterial({ color: isOrigin ? MINT : TEAL, transparent: true, opacity: 0.7, side: THREE.DoubleSide })
    );
    ring.position.copy(p);
    ring.lookAt(p.clone().multiplyScalar(2));
    ring.userData.phase = Math.random() * Math.PI * 2;
    globe.add(ring);
    rings.push(ring);
  };
  addMarker(ORIGIN[1], ORIGIN[2], true);
  SITES.forEach(([, lat, lon]) => addMarker(lat, lon, false));

  // ---- Arcs: great-circle bezier lifted off the surface; comet head + fading tail ----
  const SAMPLES = 160;
  const TRAIL = 46;
  const comets = [];
  const origin = toVec(ORIGIN[1], ORIGIN[2]);
  SITES.forEach(([, lat, lon], i) => {
    const dest = toVec(lat, lon);
    const angle = origin.angleTo(dest);
    const lift = 0.06 + 0.5 * Math.pow(angle / Math.PI, 0.85);
    const slerp = (t) => new THREE.Vector3().copy(origin).lerp(dest, t).normalize();
    const c1 = slerp(0.25).multiplyScalar(R + lift);
    const c2 = slerp(0.75).multiplyScalar(R + lift);
    const curve = new THREE.CubicBezierCurve3(origin.clone(), c1, c2, dest.clone());
    const pts = curve.getPoints(SAMPLES);

    // faint static path
    globe.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: TEAL, transparent: true, opacity: 0.16 })
      )
    );

    // comet tail: TRAIL vertices re-filled each frame; colour fades head -> tail
    const tailPos = new Float32Array(TRAIL * 3);
    const tailCol = new Float32Array(TRAIL * 3);
    const head = new THREE.Color(MINT), tail = new THREE.Color(INK);
    for (let k = 0; k < TRAIL; k++) {
      const f = k / (TRAIL - 1);
      const col = head.clone().lerp(tail, Math.pow(f, 0.7));
      tailCol.set([col.r, col.g, col.b], k * 3);
    }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute("position", new THREE.BufferAttribute(tailPos, 3));
    tg.setAttribute("color", new THREE.BufferAttribute(tailCol, 3));
    const tailLine = new THREE.Line(
      tg,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending })
    );
    tailLine.visible = false;
    globe.add(tailLine);

    const headMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.016, 10, 10),
      new THREE.MeshBasicMaterial({ color: MINT })
    );
    headMesh.visible = false;
    globe.add(headMesh);

    comets.push({
      pts, tailPos, tg, tailLine, headMesh,
      // staggered launches; each cycle includes a rest before relaunch
      period: 7.5 + angle * 2.2,
      offset: i * 1.9,
    });
  });

  // ---- Particle traffic: small glowing points streaming along low arcs
  //      between every pair of sites, in both directions ----
  const glowSprite = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 32;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.4, "rgba(180,255,240,0.55)");
    grad.addColorStop(1, "rgba(68,224,204,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(c);
  })();
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
  const PER_ARC = 3;
  const particles = [];
  const pPos = new Float32Array(pairArcs.length * PER_ARC * 3);
  pairArcs.forEach((pts, arc) => {
    for (let k = 0; k < PER_ARC; k++) {
      particles.push({ arc, t: Math.random(), speed: 0.025 + Math.random() * 0.045, dir: Math.random() < 0.5 ? 1 : -1 });
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

  function render() { renderer.render(scene, camera); }

  function tick(now) {
    raf = 0;
    if (!visible) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;

    if (!dragging) {
      // inertia, then ease back into the slow idle rotation
      spin.vy *= 0.94; spin.vx *= 0.9;
      spin.y += spin.vy; spin.x += spin.vx;
      if (!reduce) spin.y += 0.11 * dt; // ~57 s per revolution
      spin.x *= 0.995; // drift the tilt back toward level
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
        const u = ((t + c.offset) % c.period) / c.period; // 0..1 over the cycle
        const travel = u / 0.72; // move for 72% of the cycle, rest for the remainder
        if (travel > 1 + TRAIL / SAMPLES) { c.tailLine.visible = c.headMesh.visible = false; return; }
        const headIdx = travel * SAMPLES;
        for (let k = 0; k < TRAIL; k++) {
          const idx = THREE.MathUtils.clamp(Math.round(headIdx - k), 0, SAMPLES);
          const p = c.pts[idx];
          c.tailPos.set([p.x, p.y, p.z], k * 3);
        }
        c.tg.attributes.position.needsUpdate = true;
        c.tailLine.visible = true;
        const hp = c.pts[THREE.MathUtils.clamp(Math.round(headIdx), 0, SAMPLES)];
        c.headMesh.position.copy(hp);
        c.headMesh.visible = headIdx <= SAMPLES;
      });
    }

    render();
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);
}
