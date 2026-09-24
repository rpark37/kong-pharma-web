import { Component, DestroyRef, ElementRef, afterNextRender, effect, inject, input, untracked } from '@angular/core';
import type * as Three from 'three';
import { ThemeService } from '../theme/theme.service';

/**
 * A slow field of colour behind a page: domain-warped noise in the app's palette, drawn by a
 * fragment shader on a full-bleed quad. The same idea as a ShaderGradient, on the three.js the
 * atlas already ships — no React, no extra packages.
 *
 * It reads its colours from the theme tokens, so it follows the nav key; it renders once and
 * stops under reduced motion; it pauses off-screen and in a hidden tab; and it draws at half
 * resolution, because a blurred field needs no more.
 */
@Component({
  selector: 'app-shader-backdrop',
  template: `<canvas #canvas aria-hidden="true"></canvas>`,
  styles: `
    :host { position: absolute; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; }
    canvas { display: block; width: 100%; height: 100%; }
  `,
})
export class ShaderBackdropComponent {
  /** Peak opacity of the field over the page ground. */
  readonly amount = input(0.9);
  /** Drift speed multiplier. */
  readonly speed = input(1);

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly theme = inject(ThemeService);
  private readonly destroyRef = inject(DestroyRef);
  private renderer: Three.WebGLRenderer | null = null;
  private material: Three.ShaderMaterial | null = null;
  private scene: Three.Scene | null = null;
  private camera: Three.OrthographicCamera | null = null;
  private frame = 0;
  private visible = true;
  private start = performance.now();
  private observer: IntersectionObserver | null = null;
  private resize: ResizeObserver | null = null;

  constructor() {
    afterNextRender(() => void this.mount());
    effect(() => {
      this.theme.theme();
      untracked(() => { if (this.material) { this.tint(); this.draw(); } });
    });
    this.destroyRef.onDestroy(() => this.dispose());
  }

  private async mount(): Promise<void> {
    const T = await import('three');
    const canvas = this.el.nativeElement.querySelector('canvas')!;
    let renderer: Three.WebGLRenderer;
    try {
      renderer = new T.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power' });
    } catch {
      return; // no WebGL: the page keeps its flat ground
    }
    renderer.setPixelRatio(Math.min(1, window.devicePixelRatio));
    renderer.setClearColor(0x000000, 0);
    this.renderer = renderer;
    this.scene = new T.Scene();
    this.camera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.material = new T.ShaderMaterial({
      transparent: true,
      depthTest: false,
      uniforms: {
        uTime: { value: 0 },
        uRes: { value: new T.Vector2(1, 1) },
        uAmp: { value: this.amount() },
        uA: { value: new T.Color() }, uB: { value: new T.Color() }, uC: { value: new T.Color() },
      },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: FRAGMENT,
    });
    this.scene.add(new T.Mesh(new T.PlaneGeometry(2, 2), this.material));
    this.tint();
    this.fit();

    this.resize = new ResizeObserver(() => { this.fit(); this.draw(); });
    this.resize.observe(this.el.nativeElement);
    this.observer = new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; if (this.visible) this.loop(); });
    this.observer.observe(this.el.nativeElement);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.loop();
  }

  private readonly onVisibility = () => { if (!document.hidden) this.loop(); };

  /** Colours from the live tokens: the ground, the ground pulled toward teal, and a second hue held low. */
  private tint(): void {
    if (!this.material) return;
    const css = getComputedStyle(document.documentElement);
    const token = (name: string) => css.getPropertyValue(name).trim() || '#808080';
    const ground = token('--ink');
    const dark = this.theme.theme() === 'dark';
    const u = this.material.uniforms;
    u['uA'].value.set(ground);
    // Enough chroma to read as weather behind the type, not enough to compete with it.
    u['uB'].value.set(mix(ground, token('--teal'), dark ? 0.55 : 0.3));
    u['uC'].value.set(mix(ground, token('--violet'), dark ? 0.32 : 0.18));
    u['uAmp'].value = this.amount();
  }

  private fit(): void {
    if (!this.renderer || !this.material) return;
    const host = this.el.nativeElement;
    const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
    // Half resolution: the field is soft by design, and this keeps it cheap on a laptop.
    this.renderer.setSize(Math.ceil(w / 2), Math.ceil(h / 2), false);
    this.material.uniforms['uRes'].value.set(w, h);
  }

  private reduced(): boolean { return matchMedia('(prefers-reduced-motion: reduce)').matches; }

  private draw(): void {
    if (!this.renderer || !this.scene || !this.camera || !this.material) return;
    this.material.uniforms['uTime'].value = this.reduced() ? 12 : ((performance.now() - this.start) / 1000) * this.speed();
    this.renderer.render(this.scene, this.camera);
  }

  private loop(): void {
    cancelAnimationFrame(this.frame);
    this.draw();
    if (this.reduced() || !this.visible || document.hidden) return;
    this.frame = requestAnimationFrame(() => this.loop());
  }

  private dispose(): void {
    cancelAnimationFrame(this.frame);
    this.observer?.disconnect();
    this.resize?.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.material?.dispose();
    this.renderer?.dispose();
    this.renderer = null;
  }
}

/** Linear blend of two hex colours, `t` toward the second. */
function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (shift: number) => Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}

/** Value noise warped twice through itself (Quilez's fbm-of-fbm), tinted by where the warp lands. */
const FRAGMENT = `
  precision highp float;
  uniform float uTime; uniform vec2 uRes; uniform float uAmp; uniform vec3 uA, uB, uC;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
    for (int i = 0; i < 5; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
    return v;
  }
  void main() {
    vec2 uv = vUv;
    vec2 p = uv * vec2(uRes.x / max(uRes.y, 1.0), 1.0) * 1.4;
    float t = uTime * 0.045;
    vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));
    vec2 r = vec2(fbm(p + 4.0 * q + vec2(1.7, 9.2) + 0.15 * t), fbm(p + 4.0 * q + vec2(8.3, 2.8) - 0.12 * t));
    float f = fbm(p + 4.0 * r);
    vec3 col = mix(uA, uB, clamp(f * f * 2.4, 0.0, 1.0));
    col = mix(col, uC, clamp(length(q) * 0.9, 0.0, 1.0) * 0.55);
    // The field dissolves into the page ground toward its edges rather than ending at them.
    float edge = 1.0 - length((uv - 0.5) * vec2(1.25, 1.7));
    float vig = smoothstep(0.0, 0.6, edge);
    gl_FragColor = vec4(col, vig * uAmp);
  }
`;
