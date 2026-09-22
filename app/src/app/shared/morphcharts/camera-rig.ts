import { signal } from '@angular/core';
import { gsap } from 'gsap';
import { EASE, MOTION } from '../animation/motion';
import type { MorphChartsHost, RenderMode } from './morphcharts-host';

export type CameraView = 'front' | 'quarter' | 'top' | 'low';

/**
 * Yaw and pitch for each view preset as fractions of the canvas height: the camera's `rotate()`
 * maps one canvas height of drag to π radians, so these are resolution-independent.
 */
export const VIEW_DELTAS: Record<CameraView, [number, number]> = {
  front: [0, 0],
  quarter: [0.13, 0.07],
  top: [0, 0.3],
  low: [0.07, -0.09],
};

/** Turns per second while orbiting — one full turn in about 35 s. */
const ORBIT_RATE = 0.03;

export interface CameraRigOptions {
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
  readonly view = signal<CameraView>('front');
  readonly zoom = signal(1);
  readonly orbiting = signal(false);
  readonly renderMode = signal<RenderMode>('raytrace');

  private readonly pose = { yaw: 0, pitch: 0, orbit: 0 };
  private tween: gsap.core.Tween | null = null;
  private orbitTick: ((time: number, deltaTime: number) => void) | null = null;

  constructor(readonly host: MorphChartsHost, private readonly options: CameraRigOptions = {}) {
    this.renderMode.set(host.renderer.renderMode as RenderMode);
  }

  /** Re-pose the camera from the spec's reset pose. */
  apply(): void {
    const host = this.host;
    const cam = host.camera;
    const h = cam.height;
    host.resetCamera();
    cam.rotate((this.pose.yaw + this.pose.orbit) * h, this.pose.pitch * h);
    const zoom = this.zoom();
    if (zoom !== 1) cam.zoom(1 - 1 / zoom, cam.width / 2, h / 2);
    host.renderer.frameCount = 0;
    if (!host.running() && host.hasMarks()) host.start();
  }

  /** Re-assert the chosen render mode after something else (a spec reload) set its own. */
  applyRenderMode(): void {
    if (this.orbitTick) return;
    this.host.renderer.renderMode = this.renderMode();
    this.host.renderer.frameCount = 0;
  }

  setView(preset: CameraView): void {
    this.view.set(preset);
    const [yaw, pitch] = VIEW_DELTAS[preset];
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

  /** Front view at 1x, orbit off. */
  reset(): void {
    this.setOrbit(false);
    this.zoom.set(1);
    this.pose.orbit = 0;
    this.setView('front');
  }

  dispose(): void {
    this.setOrbit(false);
    this.tween?.kill();
  }
}
