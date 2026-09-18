/**
 * Builds the MorphCharts specification for the Human Atlas: every BodyParts3D structure becomes
 * a primitive at its bounding-box centre, coloured by anatomical system. Plot units are
 * millimetres. The plot is sized to hold the exploded inventory so the camera space (which
 * MorphCharts normalises by the largest plot dimension) stays constant while parts move.
 */
import { SYSTEMS, type Part, type SystemId, type View } from './anatomy';
import { createExplosionLayout } from './explosion-layout';

export const PLOT = { width: 4400, height: 3900, depth: 400, floorY: 100 } as const;
export const BODY_CENTER_Y = 0.85; // metres, as in human-atlas
export type Geometry = 'sphere' | 'box';

export interface AtlasSpecOptions {
  parts: Part[];
  geometry?: Geometry;
  selected?: ReadonlySet<string>;
  view?: View;
  aspect?: number;
  explode?: number;
}

/** Plot-space (mm) position of a part when assembled. */
export function assembledPosition(p: Part): [number, number, number] {
  return [p.cx * 1000 + PLOT.width / 2, p.cy * 1000 + PLOT.floorY, p.cz * 1000 + PLOT.depth / 2];
}

/** Plot-space (mm) size of a part, clamped so tiny structures stay visible. */
export function partSize(p: Part): [number, number, number] {
  return [Math.max(6, p.sx * 1000), Math.max(6, p.sy * 1000), Math.max(6, p.sz * 1000)];
}

/**
 * Explosion positions for a set of visible parts at explode amount t in [0, 1]. Mirrors
 * human-atlas scene.tsx: t <= 0.45 fans systems out radially, above that parts glide to a
 * packed inventory grid.
 */
export function explodedPositions(parts: Part[], t: number, aspect: number): { positions: Float32Array; layoutWidth: number; layoutHeight: number } {
  const layout = createExplosionLayout(parts, aspect);
  const positions = new Float32Array(parts.length * 3);
  parts.forEach((p, i) => {
    const group = SYSTEMS.findIndex((s) => s.id === p.system);
    const angle = (group / SYSTEMS.length) * Math.PI * 2;
    const cell = layout.cells.get(p.id);
    const dest = cell ? { x: cell.x, y: cell.y + BODY_CENTER_Y, z: 0 } : { x: p.cx, y: p.cy, z: p.cz };
    let dx: number, dy: number, dz: number;
    if (t <= 0.45) {
      const k = t / 0.45;
      dx = Math.sin(angle) * k * 0.48;
      dy = (p.cy - BODY_CENTER_Y) * k * 0.28;
      dz = Math.cos(angle) * k * 0.48;
    } else {
      const k = (t - 0.45) / 0.55;
      dx = lerp(Math.sin(angle) * 0.48, dest.x - p.cx, k);
      dy = lerp((p.cy - BODY_CENTER_Y) * 0.28, dest.y - p.cy, k);
      dz = lerp(Math.cos(angle) * 0.48, -p.cz, k);
    }
    const base = assembledPosition(p);
    positions[i * 3] = base[0] + dx * 1000;
    positions[i * 3 + 1] = base[1] + dy * 1000;
    positions[i * 3 + 2] = base[2] + dz * 1000;
  });
  return { positions, layoutWidth: layout.width, layoutHeight: layout.height };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export interface CameraPose { worldPosition: [number, number, number]; worldTarget: [number, number, number]; }

/** Camera presets in plot millimetres, following the human-atlas `fit` logic. */
export function cameraPose(view: View, explode: number, aspect: number, layout?: { width: number; height: number }, fovDeg = 45): CameraPose {
  const fov = (fovDeg * Math.PI) / 180;
  const normalDistance = 4; // metres
  const availableAspect = Math.max(0.35, aspect);
  const atlasDistance = layout ? (Math.max(layout.height, layout.width / availableAspect) / (2 * Math.tan(fov / 2))) * 1.08 : normalDistance;
  const extent = Math.max(0, (explode - 0.3) / 0.7);
  const distance = lerp(normalDistance, Math.max(0.2, atlasDistance), extent);
  const v: View = extent > 0.8 ? 'front' : view;
  const dir = v === 'front' ? [0, 0.02, 1] : v === 'back' ? [0, 0.02, -1] : v === 'side' ? [1, 0.02, 0] : normalize([0.35, 0.06, 1]);
  const targetY = extent > 0.1 ? BODY_CENTER_Y : 0.68;
  const targetX = extent > 0.1 && layout ? -layout.width * 0.12 : 0;
  const target: [number, number, number] = [targetX * 1000 + PLOT.width / 2, targetY * 1000 + PLOT.floorY, PLOT.depth / 2];
  const position: [number, number, number] = [target[0] + dir[0] * distance * 1000, target[1] + dir[1] * distance * 1000, target[2] + dir[2] * distance * 1000];
  return { worldPosition: position, worldTarget: target };
}

/** Camera pose that frames a bounding box (used for isolate). */
export function framePose(parts: Part[], fovDeg = 45): CameraPose {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const p of parts) {
    const c = assembledPosition(p);
    const s = partSize(p);
    for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], c[i] - s[i] / 2); max[i] = Math.max(max[i], c[i] + s[i] / 2); }
  }
  const center: [number, number, number] = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  const size = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2], 60);
  const distance = Math.max(70, (size / (2 * Math.tan(((fovDeg * Math.PI) / 180) / 2))) * 1.35);
  const dir = normalize([0.2, 0.1, 1]);
  return { worldPosition: [center[0] + dir[0] * distance, center[1] + dir[1] * distance, center[2] + dir[2] * distance], worldTarget: center };
}

function normalize(v: number[]): number[] {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

export function buildAtlasSpec(o: AtlasSpecOptions): Record<string, unknown> {
  const geometry = o.geometry ?? 'sphere';
  const values = o.parts.map((p) => {
    const [xc, yc, zc] = assembledPosition(p);
    const [w, h, d] = partSize(p);
    const [r, g, b] = hexToRgb255(SYSTEM_BY_ID[p.system]?.color ?? '#aec3bb');
    return { id: p.id, system: p.system, xc, yc, zc, width: w, height: h, depth: d, r, g, b, selected: o.selected?.has(p.id) ? 1 : 0 };
  });
  const pose = cameraPose(o.view ?? 'three-quarter', o.explode ?? 0, o.aspect ?? 1.6);
  return {
    title: 'Human Atlas',
    width: PLOT.width,
    height: PLOT.height,
    depth: PLOT.depth,
    background: '#F5F5F3',
    ambient: '#1c2a33',
    camera: { worldPosition: pose.worldPosition, worldTarget: pose.worldTarget, fov: 45 },
    lights: [
      { type: 'directional', direction: [-0.4, -1, -0.6], brightness: 2.2, color: '#f3f7ff' },
      { type: 'rect', position: [PLOT.width / 2 - 2500, 3200, PLOT.depth / 2 + 2600], brightness: 2.5, size: 1400, color: '#e6f6f3' },
      { type: 'sphere', position: [PLOT.width / 2 + 2600, 2400, PLOT.depth / 2 - 1800], brightness: 1.2, size: 400, color: '#44e0cc' },
    ],
    data: [{ name: 'parts', values }],
    marks: [
      {
        name: 'parts',
        type: 'rect',
        geometry,
        material: 'glossy',
        from: { data: 'parts' },
        encode: {
          enter: {
            xc: { field: 'xc' }, yc: { field: 'yc' }, zc: { field: 'zc' },
            width: { field: 'width' }, height: { field: 'height' }, depth: { field: 'depth' },
            fill: { color: { r: { field: 'r' }, g: { field: 'g' }, b: { field: 'b' } } },
            fuzz: { value: 0.35 },
            segmentId: { field: 'selected' },
          },
        },
      },
      {
        type: 'rect',
        geometry: 'xzrect',
        material: 'diffuse',
        encode: { enter: { xc: { value: PLOT.width / 2 }, yc: { value: PLOT.floorY - 4 }, zc: { value: PLOT.depth / 2 }, width: { value: PLOT.width * 3 }, depth: { value: PLOT.width * 3 }, fill: { value: '#E8E8E6' } } },
      },
    ],
  };
}

function hexToRgb255(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const SYSTEM_BY_ID: Record<SystemId, (typeof SYSTEMS)[number]> = Object.fromEntries(SYSTEMS.map((s) => [s.id, s])) as Record<SystemId, (typeof SYSTEMS)[number]>;
