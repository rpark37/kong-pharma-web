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

  // Microscopy-style distance scale bar (bottom-right). It tracks the camera
  // dolly + responsive zoom and snaps its label to a round value.
  const NM_PER_UNIT = 1; // scene local unit → nanometres (schematic scale)
  let scaleEl = null, scaleBarEl = null, scaleLabelEl = null;
  if (hero) {
    scaleEl = document.createElement("div");
    scaleEl.className = "hero__scale";
    scaleEl.setAttribute("aria-hidden", "true");
    scaleEl.innerHTML =
      '<span class="hero__scale-label"></span><span class="hero__scale-bar"></span>';
    hero.appendChild(scaleEl);
    scaleBarEl = scaleEl.querySelector(".hero__scale-bar");
    scaleLabelEl = scaleEl.querySelector(".hero__scale-label");
  }
  // Round a raw distance to a "nice" 1 / 2 / 5 × 10ⁿ value for the bar label.
  function niceDistance(x) {
    if (!(x > 0)) return 1;
    const exp = Math.floor(Math.log10(x));
    const f = x / Math.pow(10, exp);
    const nf = f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10;
    return nf * Math.pow(10, exp);
  }

  const scene = new THREE.Scene();
  // Depth fog: distant nodes dissolve into the hero's teal for real depth.
  // Far plane is generous so the cluster survives being scaled up on wide screens.
  scene.fog = new THREE.Fog(0xf4f9f9, 6.5, 16); // matches the light hero background (--paper)
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  const group = new THREE.Group();
  scene.add(group); // position/scale are driven responsively by computeLayout()

  // Node palette: the original mint / bright teal, taken one step darker so
  // the network holds its own on the light hero; bonds stay dark for contrast
  const BRIGHT = 0x66dcc8;
  const MINT = 0xc4efe4;
  const DEEP = 0x0c6055;

  // ---- Nodes (atoms / neurons / cells), a few as pills (drugs) ----
  // Denser network on wider screens; capped so mobile stays light.
  const COUNT = Math.round(
    Math.min(96, Math.max(46, (window.innerWidth || 1280) / 24))
  );
  const RADIUS = 2.95; // cluster radius (slightly larger for more presence)
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
    const r = RADIUS * Math.cbrt(Math.random());
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
      color: 0x0a6a5f, // deep teal bonds, strong enough to read on the light hero
      transparent: true,
      opacity: 0.7,
    })
  );
  group.add(lines);

  // ---- Data pulses travelling the bonds (AI / neural signals) ----
  const signals = [];
  if (edges.length) {
    const sigGeo = new THREE.SphereGeometry(0.05, 8, 8);
    // Dark pulses with normal blending: additive white vanishes on a light background
    const sigMat = new THREE.MeshBasicMaterial({
      color: 0x063a34,
      transparent: true,
      opacity: 0.9,
    });
    const sigCount = Math.round(COUNT * 0.38); // pulses scale with the network
    for (let i = 0; i < sigCount; i++) {
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

  // ---- DNA double helix centerpiece (drug development / biotech) ----
  const helix = new THREE.Group();
  helix.rotation.z = 0.18;
  const beadGeo = new THREE.SphereGeometry(0.075, 10, 10);
  const strandAMat = new THREE.MeshBasicMaterial({ color: MINT });
  const strandBMat = new THREE.MeshBasicMaterial({ color: BRIGHT });
  const TURNS = 3;
  const BEADS = 30;
  const RAD = 0.55;
  const HEIGHT = 4.3;
  const aPts = [];
  const bPts = [];
  for (let i = 0; i < BEADS; i++) {
    const f = i / (BEADS - 1);
    const ang = f * TURNS * Math.PI * 2;
    const y = -HEIGHT / 2 + f * HEIGHT;
    const a = new THREE.Vector3(Math.cos(ang) * RAD, y, Math.sin(ang) * RAD);
    const b = new THREE.Vector3(
      Math.cos(ang + Math.PI) * RAD,
      y,
      Math.sin(ang + Math.PI) * RAD
    );
    aPts.push(a);
    bPts.push(b);
    const ma = new THREE.Mesh(beadGeo, strandAMat);
    ma.position.copy(a);
    helix.add(ma);
    const mb = new THREE.Mesh(beadGeo, strandBMat);
    mb.position.copy(b);
    helix.add(mb);
  }
  // Backbone curves + base-pair rungs as one set of dark strands.
  const helixLinePos = [];
  for (let i = 0; i < BEADS - 1; i++) {
    helixLinePos.push(aPts[i].x, aPts[i].y, aPts[i].z, aPts[i + 1].x, aPts[i + 1].y, aPts[i + 1].z);
    helixLinePos.push(bPts[i].x, bPts[i].y, bPts[i].z, bPts[i + 1].x, bPts[i + 1].y, bPts[i + 1].z);
  }
  for (let i = 0; i < BEADS; i += 2) {
    helixLinePos.push(aPts[i].x, aPts[i].y, aPts[i].z, bPts[i].x, bPts[i].y, bPts[i].z);
  }
  const helixLineGeo = new THREE.BufferGeometry();
  helixLineGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(helixLinePos, 3)
  );
  helix.add(
    new THREE.LineSegments(
      helixLineGeo,
      new THREE.LineBasicMaterial({ color: 0x0a6a5f, transparent: true, opacity: 0.75 })
    )
  );
  group.add(helix);

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let raf = null;
  let t0 = 0;
  let scrollP = 0; // 0 at top of hero → 1 when scrolled a full viewport
  let cssH = 1; // canvas height in CSS px (for the scale-bar projection math)

  function onScroll() {
    const vh = window.innerHeight || 1;
    scrollP = Math.min(1, Math.max(0, window.scrollY / vh));
  }

  // Responsive framing: the network grows, shifts right, and the camera dollies
  // in as the viewport widens — so it fills the frame and feels alive on resize.
  // `layout` holds the target; `view` lerps toward it each frame for smoothness.
  const layout = { scale: 1, biasX: 1.3, camZ: 9 };
  const view = { scale: 1, biasX: 1.3, camZ: 9 };
  function computeLayout() {
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    const aspect = w / h;
    // 0 on a tall/portrait phone → 1 on a wide desktop.
    const wide = Math.min(1, Math.max(0, (aspect - 0.8) / 1.4));
    // Centered behind the copy on mobile, pushed far right on desktop.
    layout.biasX = -0.2 + wide * 2.4;
    // Base growth with width + an extra nudge on very large monitors,
    // then boosted 1.62× for a larger overall visualization.
    layout.scale =
      (0.85 + wide * 0.5 + Math.min(0.3, Math.max(0, (w - 1280) / 3600))) * 1.62;
    // Pull back when portrait (fit it in), move in and enlarge when wide.
    layout.camZ = 10.6 - wide * 2.1;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    // Guard against a degenerate rect (0 during early layout) so we never hand
    // Three a zero-size buffer, which renders nothing.
    const w = rect.width || window.innerWidth || 1;
    const h = rect.height || window.innerHeight || 1;
    cssH = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h || 1;
    camera.updateProjectionMatrix();
    computeLayout();
  }

  function tick(seconds) {
    pointer.x += (pointer.tx - pointer.x) * 0.04;
    pointer.y += (pointer.ty - pointer.y) * 0.04;
    // Ease the responsive framing toward its target so a window resize glides.
    view.scale += (layout.scale - view.scale) * 0.08;
    view.biasX += (layout.biasX - view.biasX) * 0.08;
    view.camZ += (layout.camZ - view.camZ) * 0.08;
    group.position.x = view.biasX;
    // Scroll-coupling: dolly the camera into the cluster and fade out as the
    // hero leaves — the scroll-driven feel of immersive sites.
    camera.position.z = view.camZ - scrollP * 3.5;
    canvas.style.opacity = String(1 - scrollP * 0.85);
    group.rotation.y = seconds * 0.12 + pointer.x * 0.5 + scrollP * 0.6;
    group.rotation.x = Math.sin(seconds * 0.15) * 0.1 + pointer.y * 0.3;
    // Responsive base scale × subtle heartbeat pulse.
    group.scale.setScalar(view.scale * (1 + Math.sin(seconds * 1.6) * 0.02));
    helix.rotation.y = seconds * 0.5; // helix spins on its own axis
    for (const s of signals) {
      s.t += s.speed * 0.006;
      if (s.t > 1) {
        s.t = 0;
        s.edge = (Math.random() * edges.length) | 0;
      }
      const [a, b] = edges[s.edge];
      s.mesh.position.lerpVectors(nodes[a], nodes[b], s.t);
    }
    // Update the distance scale bar for the current camera zoom.
    if (scaleBarEl) {
      const fov = (camera.fov * Math.PI) / 180;
      const worldPerPx = (2 * Math.tan(fov / 2) * camera.position.z) / cssH;
      const localPerPx = worldPerPx / (view.scale || 1);
      const nice = niceDistance(84 * localPerPx * NM_PER_UNIT);
      scaleBarEl.style.width = (nice / NM_PER_UNIT / localPerPx).toFixed(1) + "px";
      scaleLabelEl.textContent = +nice.toFixed(2) + " nm";
      // Fade out well before the hero leaves so it never sits over later sections.
      scaleEl.style.opacity = String(Math.max(0, 1 - scrollP * 1.6) * 0.72);
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
  // Snap the smoothed view to the target so the first frame is framed correctly.
  view.scale = layout.scale;
  view.biasX = layout.biasX;
  view.camZ = layout.camZ;
  onScroll();
  tick(2.5); // one composed frame (also the reduced-motion still)
  start();

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => {
    resize();
    if (reduce) {
      // No animation loop to ease it in — snap to the new framing and redraw.
      view.scale = layout.scale;
      view.biasX = layout.biasX;
      view.camZ = layout.camZ;
      tick(2.5);
    }
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
