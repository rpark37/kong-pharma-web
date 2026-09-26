import type { Part } from './anatomy';
import { PLOT, assembledPosition, buildAtlasSpec, cameraPose, explodedPositions, orbitPose, partSize } from './atlas-spec';
import { createExplosionLayout } from './explosion-layout';

const parts: Part[] = [
  { id: 'a', name: 'Heart', conceptId: 'FMA1', system: 'cardiac', cx: 0, cy: 1.25, cz: 0, sx: 0.1, sy: 0.1, sz: 0.1 },
  { id: 'b', name: 'Femur', conceptId: 'FMA2', system: 'skeletal', cx: 0.1, cy: 0.6, cz: 0, sx: 0.08, sy: 0.45, sz: 0.08 },
  { id: 'c', name: 'Tiny', conceptId: 'FMA3', system: 'nervous', cx: -0.02, cy: 1.6, cz: 0.02, sx: 0.001, sy: 0.001, sz: 0.001 },
];

describe('atlas spec', () => {
  it('places parts in plot millimetres and clamps tiny sizes', () => {
    expect(assembledPosition(parts[0])).toEqual([PLOT.width / 2, 1250 + PLOT.floorY, PLOT.depth / 2]);
    expect(partSize(parts[2])).toEqual([6, 6, 6]);
  });

  it('builds a spec with one datum per part and RGB colour fields', () => {
    const spec = buildAtlasSpec({ parts }) as { data: Array<{ values: Array<Record<string, number>> }>; marks: unknown[] };
    expect(spec.data[0].values.length).toBe(3);
    expect(spec.data[0].values[0]['r']).toBeGreaterThan(0);
    expect(spec.marks.length).toBe(1);
  });

  it('explode: t=0 keeps assembled positions, t=1 lands on the packed layout', () => {
    const rest = explodedPositions(parts, 0, 1.6).positions;
    expect(Array.from(rest.slice(0, 3))).toEqual(assembledPosition(parts[0]));
    const full = explodedPositions(parts, 1, 1.6);
    const layout = createExplosionLayout(parts, 1.6);
    const cell = layout.cells.get('a')!;
    expect(full.positions[0]).toBeCloseTo(cell.x * 1000 + PLOT.width / 2, 3);
    expect(full.positions[2]).toBeCloseTo(PLOT.depth / 2, 3);
    expect(full.layoutWidth).toBeGreaterThan(0);
  });

  it('camera presets look at the body and force the front view when exploded', () => {
    const front = cameraPose('front', 0, 1.6);
    expect(front.worldPosition[2]).toBeGreaterThan(front.worldTarget[2]);
    const side = cameraPose('side', 0, 1.6);
    expect(side.worldPosition[0]).toBeGreaterThan(side.worldTarget[0]);
    const exploded = cameraPose('side', 1, 1.6, { width: 4, height: 3 });
    expect(Math.abs(exploded.worldPosition[0] - exploded.worldTarget[0])).toBeLessThan(1);
  });

  it('orbitPose walks round the target: a half-turn yaw is the side, a full one the back, zoom halves the distance', () => {
    const front = cameraPose('front', 0, 1.6);
    const [tx, ty, tz] = front.worldTarget;
    const d = Math.hypot(front.worldPosition[0] - tx, front.worldPosition[2] - tz);
    const side = orbitPose(front, 0.5, 0);
    expect(side.worldPosition[0] - tx).toBeCloseTo(d, 0);
    expect(Math.abs(side.worldPosition[2] - tz)).toBeLessThan(1);
    const back = orbitPose(front, 1, 0);
    expect(back.worldPosition[2] - tz).toBeCloseTo(-d, 0);
    const near = orbitPose(front, 0, 0, 2);
    expect(near.worldPosition[2] - tz).toBeCloseTo(d / 2, 0);
    expect(near.worldPosition[1]).toBeCloseTo(front.worldPosition[1] / 2 + ty / 2, 0);
    expect(orbitPose(front, 0, 0.1).worldPosition[1]).toBeGreaterThan(front.worldPosition[1]);
  });
});
