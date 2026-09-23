// Membrane field: a living, faint contour map behind the dark sections.
// Domain-warped noise drawn as isolines (the same language as the shape
// readouts) with a soft caustic light drifting through, teal on slate. One
// small WebGL2 context per section, half resolution, 30 fps, and it only
// runs while its section is on screen. No motion preference = no field: the
// graph paper stays as the static fallback.
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const SECTIONS = { science: 1.0, partnership: 7.3, contact: 13.9 };

const VERT = `#version 300 es
in vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision mediump float;
uniform vec2 u_res; uniform float u_time; uniform float u_seed; uniform vec3 u_color;
out vec4 o;
vec2 hash(vec2 p){ p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return -1.0 + 2.0 * fract(sin(p) * 43758.5453123); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(dot(hash(i), f), dot(hash(i + vec2(1, 0)), f - vec2(1, 0)), u.x),
             mix(dot(hash(i + vec2(0, 1)), f - vec2(0, 1)), dot(hash(i + vec2(1, 1)), f - vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p){ float v = 0.0, a = 0.5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6); for (int i = 0; i < 4; i++) { v += a * noise(p); p = m * p; a *= 0.5; } return v; }
void main(){
  vec2 uv = gl_FragCoord.xy / 640.0; // fixed feature size (~1300 css px), whatever the section is
  float t = u_time * 0.035;
  vec2 p = uv * 1.5 + u_seed;
  vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t * 0.7));
  float v = fbm(p + 1.8 * q + vec2(t * 0.5, -t * 0.3));
  // contour lines, anti-aliased by screen-space derivative
  float lv = v * 7.0;
  float d = abs(fract(lv) - 0.5);
  float line = 1.0 - smoothstep(0.0, fwidth(lv) * 1.4 + 0.015, d);
  // caustic light: broad, slow, soft
  float c = fbm(p * 1.7 - t * 1.4 + q * 0.6) + 0.22;
  c = pow(smoothstep(0.05, 0.75, c), 2.0);
  float a = line * 0.11 + c * 0.075;
  // fade at the section's top and bottom so edges stay clean
  float ny = gl_FragCoord.y / u_res.y;
  a *= smoothstep(0.0, 0.14, ny) * smoothstep(1.0, 0.86, ny);
  o = vec4(u_color * a, a);
}`;

function cssColor(el, name) {
  // Resolve a CSS colour (oklch, color-mix...) to 0..1 rgb via the 2D canvas
  const c = document.createElement("canvas").getContext("2d");
  c.fillStyle = "#000";
  c.fillStyle = getComputedStyle(el).getPropertyValue(name).trim() || "#5eebd6";
  c.fillRect(0, 0, 1, 1);
  const [r, g, b] = c.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255];
}

function mount(section, seed) {
  const canvas = document.createElement("canvas");
  canvas.className = "field";
  canvas.setAttribute("aria-hidden", "true");
  section.prepend(canvas);
  const gl = canvas.getContext("webgl2", { alpha: true, antialias: false, powerPreference: "low-power" });
  if (!gl) { canvas.remove(); return; }

  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn("field shader", gl.getProgramInfoLog(prog)); canvas.remove(); return; }
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const U = (n) => gl.getUniformLocation(prog, n);
  gl.uniform1f(U("u_seed"), seed);
  gl.uniform3fv(U("u_color"), cssColor(section, "--teal"));
  const uRes = U("u_res"), uTime = U("u_time");

  // ponytail: half resolution, dpr 1. It is a soft field; the upscale is invisible.
  const size = () => {
    const w = Math.ceil(section.clientWidth / 2), h = Math.ceil(section.clientHeight / 2);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); gl.uniform2f(uRes, w, h); }
  };
  new ResizeObserver(size).observe(section);
  size();

  let running = false, last = 0;
  const t0 = performance.now() + seed * 1000;
  const frame = (now) => {
    if (!running) return;
    requestAnimationFrame(frame);
    if (now - last < 1000 / 30) return; // 30 fps is plenty for a slow field
    last = now;
    gl.uniform1f(uTime, (now - t0) / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  new IntersectionObserver((entries) => {
    const on = entries.some((e) => e.isIntersecting);
    if (on && !running) { running = true; requestAnimationFrame(frame); }
    if (!on) running = false;
  }, { rootMargin: "120px 0px" }).observe(section);
}

if (!reduce) {
  for (const [id, seed] of Object.entries(SECTIONS)) {
    const section = document.getElementById(id);
    if (section) try { mount(section, seed); } catch (err) { console.warn("membrane field skipped", err); }
  }
}
