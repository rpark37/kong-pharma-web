import { signal } from '@angular/core';
import { gsap } from 'gsap';
import { EASE, MOTION } from '../animation/motion';
import type { MorphChartsHost, RenderMode } from './morphcharts-host';

/**
 * A view preset: yaw and pitch as fractions of a half turn (the camera's `rotate()` maps one
 * canvas height of drag to π radians, so these are resolution-independent), with the code the
 * key shows and the name its tooltip gives.
 */
export interface ViewPreset { id: string; code: string; name: string; yaw: number; pitch: number; }

/** The presets a chart wants: a front view and three ways to look at its relief. */
export const CHART_VIEWS: ViewPreset[] = [
  { id: 'front', code: 'FRONT', name: 'Front', yaw: 0, pitch: 0 },
  { id: 'quarter', code: '¾', name: 'Three-quarter', yaw: 0.13, pitch: 0.07 },
  { id: 'top', code: 'TOP', name: 'Top-down', yaw: 0, pitch: 0.3 },
  { id: 'low', code: 'LOW', name: 'Low angle', yaw: 0.07, pitch: -0.09 },
];

/** Turns per second while orbiting — one full turn in about 35 s. */
const ORBIT_RATE = 0.03;

export interface CameraRigOptions {
  /** View presets for this scene; `CHART_VIEWS` unless the subject wants its own (a body has a side and a back). */
  views?: ViewPreset[];
  /**
   * Own the pose: given yaw and pitch (half-turn fractions) and the zoom factor, place the camera.
   * Without it the rig resets to the spec camera and rotates about the plot origin, which is right
   * for a chart but not for a scene whose subject is off-centre or moves.
   */
  pose?: (yaw: number, pitch: number, zoom: number) => void;
  /** Read at use, so a page can flip it after construction. */
  reducedMotion?: () => boolean;
  /** While true the orbit holds still (a morph is writing the scene). */
  isBusy?: () => boolean;
  /** The chosen still render mode changed; a morph controller uses this to know what to settle back to. */
  onStillMode?: (mode: RenderMode) => void;
}

/**
 * The camera of a MorphCharts host as a pose over the spec's reset camera — a view preset, a
 * zoom factor and an orbit angle — re-applied from reset whenever it changes. That makes the
 * controls compose: a pointer drag in between is simply overwritten by the next control, and a
 * spec reload (which resets the camera) is undone by `apply()`.
 *
 * State is exposed as signals so a control panel can bind to it; the rig owns no DOM.
 */
export class CameraRig {
  readonly views: ViewPreset[];
  readonly view = signal<string>('front');
  readonly zoom = signal(1);
  readonly orbiting = signal(false);
  readonly renderMode = signal<RenderMode>('raytrace');

  private readonly pose = { yaw: 0, pitch: 0, orbit: 0 };
  private tween: gsap.core.Tween | null = null;
  private orbitTick: ((time: number, deltaTime: number) => void) | null = null;

  constructor(readonly host: MorphChartsHost, private readonly options: CameraRigOptions = {}) {
    this.views = options.views ?? CHART_VIEWS;
    this.view.set(this.views[0].id);
    this.renderMode.set(host.renderer.renderMode as RenderMode);
  }

  /** Re-pose the camera: the scene's own pose hook, or the spec's reset pose rotated and dollied. */
  apply(): void {
    const host = this.host;
    const zoom = this.zoom();
    if (this.options.pose) {
      this.options.pose(this.pose.yaw + this.pose.orbit, this.pose.pitch, zoom);
    } else {
      const cam = host.camera;
      const h = cam.height;
      host.resetCamera();
      cam.rotate((this.pose.yaw + this.pose.orbit) * h, this.pose.pitch * h);
      if (zoom !== 1) cam.zoom(1 - 1 / zoom, cam.width / 2, h / 2);
    }
    host.renderer.frameCount = 0;
    if (!host.running() && host.hasMarks()) host.start();
  }

  /** Re-assert the chosen render mode after something else (a spec reload) set its own. */
  applyRenderMode(): void {
    if (this.orbitTick) return;
    this.host.renderer.renderMode = this.renderMode();
    this.host.renderer.frameCount = 0;
  }

  setView(id: string): void {
    const preset = this.views.find((v) => v.id === id) ?? this.views[0];
    this.view.set(preset.id);
    const { yaw, pitch } = preset;
    this.tween?.kill();
    if (this.options.reducedMotion?.()) {
      this.pose.yaw = yaw;
      this.pose.pitch = pitch;
      this.apply();
      return;
    }
    this.tween = gsap.to(this.pose, { yaw, pitch, duration: MOTION.duration.slow, ease: EASE.inOut, overwrite: 'auto', onUpdate: () => this.apply() });
  }

  setZoom(zoom: number): void {
    this.zoom.set(zoom);
    this.apply();
  }

  /** A slow turn around the plot. Runs in flat shading, since a moving path tracer never converges. */
  setOrbit(on: boolean): void {
    if (on === !!this.orbitTick) return;
    this.orbiting.set(on);
    if (on) {
      // Whatever mode the scene is in now is what orbit hands back afterwards.
      this.renderMode.set(this.host.renderer.renderMode as RenderMode);
      this.orbitTick = (_time, deltaTime) => {
        if (this.options.isBusy?.()) return;
        this.host.renderer.renderMode = 'color';
        this.pose.orbit += ORBIT_RATE * (deltaTime / 1000);
        this.apply();
      };
      gsap.ticker.add(this.orbitTick);
    } else {
      gsap.ticker.remove(this.orbitTick!);
      this.orbitTick = null;
      this.host.renderer.renderMode = this.renderMode();
      this.host.renderer.frameCount = 0;
    }
  }

  setRenderMode(mode: RenderMode): void {
    this.renderMode.set(mode);
    this.options.onStillMode?.(mode);
    this.applyRenderMode();
  }

  /** First view at 1x, orbit off. */
  reset(): void {
    this.setOrbit(false);
    this.zoom.set(1);
    this.pose.orbit = 0;
    this.setView(this.views[0].id);
  }

  dispose(): void {
    this.setOrbit(false);
    this.tween?.kill();
  }
}
