// Hero 3D backdrop — Three.js molecular / neural network.
// Themes: a network of connected nodes reads at once as a molecule (drug
// development), a neural net (AI), and a care network (medicine). A few nodes
// are pill capsules; data pulses travel the bonds; the whole cluster pulses
// like a heartbeat.
import * as THREE from "three";

const placeholder = document.querySelector(".hero__canvas");
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (placeholder) {
  try {
    initThree(placeholder);
  } catch (err) {
    console.warn("Three.js hero backdrop failed; falling back.", err);
    fallback2D(placeholder);
  }
}

function initThree(placeholderCanvas) {
  // Let Three create and own its own canvas (avoids context conflicts on a
  // shared element), then drop it into the hero in the placeholder's spot.
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const canvas = renderer.domElement;
  canvas.className = "hero__canvas";
  canvas.setAttribute("aria-hidden", "true");
  placeholderCanvas.replaceWith(canvas);
  const hero = canvas.closest(".hero");

  const scene = new THREE.Scene();
  // Depth fog: distant nodes dissolve into the hero's teal for real depth.
  scene.fog = new THREE.Fog(0x44e0cc, 6.5, 13.5);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  const group = new THREE.Group();
  group.position.x = 1.3; // bias right so the headline stays clear
  scene.add(group);

  const BRIGHT = 0x8ff5e6;
  const MINT = 0xe6fff8;
  const DEEP = 0x0c6055;

  // ---- Nodes (atoms / neurons / cells), a few as pills (drugs) ----
  const COUNT = 72;
  const nodeGeo = new THREE.IcosahedronGeometry(0.11, 1);
  const pillGeo = new THREE.CapsuleGeometry(0.09, 0.26, 4, 10);
  const nodeMat = new THREE.MeshBasicMaterial({
    color: BRIGHT,
    transparent: true,
    opacity: 0.92,
  });
  const pillMat = new THREE.MeshBasicMaterial({ color: MINT });

  const nodes = [];
  for (let i = 0; i < COUNT; i++) {
    const r = 2.7 * Math.cbrt(Math.random());
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    const v = new THREE.Vector3(
      r * Math.sin(ph) * Math.cos(th),
      r * Math.sin(ph) * Math.sin(th) * 0.82,
      r * Math.cos(ph)
    );
    const isPill = i % 9 === 0;
    const mesh = new THREE.Mesh(
      isPill ? pillGeo : nodeGeo,
      isPill ? pillMat : nodeMat
    );
    mesh.position.copy(v);
    if (isPill) mesh.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    group.add(mesh);
    nodes.push(v);
  }

  // ---- Bonds / synapses ----
  const edges = [];
  const linePos = [];
  for (let i = 0; i < COUNT; i++) {
    for (let j = i + 1; j < COUNT; j++) {
      if (nodes[i].distanceTo(nodes[j]) < 1.2) {
        edges.push([i, j]);
        linePos.push(
          nodes[i].x, nodes[i].y, nodes[i].z,
          nodes[j].x, nodes[j].y, nodes[j].z
        );
      }
    }
  }
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(linePos, 3)
  );
  const lines = new THREE.LineSegments(
    lineGeo,
    new THREE.LineBasicMaterial({
      color: 0x053b34,
      transparent: true,
      opacity: 0.55,
    })
  );
  group.add(lines);

  // ---- Data pulses travelling the bonds (AI / neural signals) ----
  const signals = [];
  if (edges.length) {
    const sigGeo = new THREE.SphereGeometry(0.05, 8, 8);
    const sigMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });
    for (let i = 0; i < 16; i++) {
      const mesh = new THREE.Mesh(sigGeo, sigMat);
      group.add(mesh);
      signals.push({
        mesh,
        edge: (Math.random() * edges.length) | 0,
        t: Math.random(),
        speed: 0.4 + Math.random() * 0.8,
      });
    }
  }

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let raf = null;
  let t0 = 0;
  let scrollP = 0; // 0 at top of hero → 1 when scrolled a full viewport

  function onScroll() {
    const vh = window.innerHeight || 1;
    scrollP = Math.min(1, Math.max(0, window.scrollY / vh));
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height || 1;
    camera.updateProjectionMatrix();
  }

  function tick(seconds) {
    pointer.x += (pointer.tx - pointer.x) * 0.04;
    pointer.y += (pointer.ty - pointer.y) * 0.04;
    // Scroll-coupling: dolly the camera into the cluster and fade out as the
    // hero leaves — the scroll-driven feel of immersive sites.
    camera.position.z = 9 - scrollP * 3.5;
    canvas.style.opacity = String(1 - scrollP * 0.85);
    group.rotation.y = seconds * 0.12 + pointer.x * 0.5 + scrollP * 0.6;
    group.rotation.x = Math.sin(seconds * 0.15) * 0.1 + pointer.y * 0.3;
    group.scale.setScalar(1 + Math.sin(seconds * 1.6) * 0.02); // heartbeat
    for (const s of signals) {
      s.t += s.speed * 0.006;
      if (s.t > 1) {
        s.t = 0;
        s.edge = (Math.random() * edges.length) | 0;
      }
      const [a, b] = edges[s.edge];
      s.mesh.position.lerpVectors(nodes[a], nodes[b], s.t);
    }
    renderer.render(scene, camera);
  }

  function frame(now) {
    if (!t0) t0 = now;
    tick((now - t0) / 1000);
    raf = requestAnimationFrame(frame);
  }
  function start() {
    if (raf || reduce) return;
    t0 = 0;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
  }

  resize();
  onScroll();
  tick(2.5); // one composed frame (also the reduced-motion still)
  start();

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => {
    resize();
    if (reduce) tick(2.5);
  });
  if (hero) {
    hero.addEventListener("pointermove", (e) => {
      const rect = hero.getBoundingClientRect();
      pointer.tx = (e.clientX - rect.left) / rect.width - 0.5;
      pointer.ty = (e.clientY - rect.top) / rect.height - 0.5;
    });
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else start();
  });
}

// Minimal static fallback if WebGL/Three is unavailable.
function fallback2D(canvas) {
  const ctx = canvas.getContext && canvas.getContext("2d");
  if (!ctx) return; // leave the solid teal background
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  for (let i = 0; i < 10; i++) {
    const x = Math.random() * rect.width;
    const y = Math.random() * rect.height;
    const r = 120 + Math.random() * 180;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(8,74,66,0.18)");
    g.addColorStop(1, "rgba(8,74,66,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}
