/**
 * The branch structure that links the console windows.
 *
 * Topology comes from recursive bisection: from a node, split the remaining windows into two
 * spatially coherent groups, run a branch toward each group, recurse until a branch owns one
 * window. That gives a real trunk-and-fork tree rather than a fan of spokes from one origin.
 *
 * Every run is axis-aligned. Nothing here is a diagonal or a curve — the result reads as routed
 * conduit rather than as anything grown, which is the intent. Terminal branches finish on a
 * vertical so they always enter a window through the bottom edge.
 */
import * as T from 'three';

export interface Segment {
  points: T.Vector3[];
  depth: number;
  /** Index into the target list when this segment terminates at a window. */
  target: number | null;
  /** Where this segment forks, if it has children — used to pop a junction dot. */
  fork: T.Vector3 | null;
}

const SAMPLES = 40;
const RISE = 0.55;

/** Resample a polyline at even arc-length spacing so growth advances at a constant rate. */
function resample(corners: T.Vector3[], count: number): T.Vector3[] {
  const lengths: number[] = [];
  let total = 0;
  for (let i = 1; i < corners.length; i++) {
    const d = corners[i].distanceTo(corners[i - 1]);
    lengths.push(d);
    total += d;
  }
  if (total === 0) return new Array(count).fill(corners[0].clone());

  const out: T.Vector3[] = [];
  for (let s = 0; s < count; s++) {
    let want = (s / (count - 1)) * total;
    let seg = 0;
    while (seg < lengths.length - 1 && want > lengths[seg]) {
      want -= lengths[seg];
      seg++;
    }
    const f = lengths[seg] === 0 ? 0 : want / lengths[seg];
    out.push(corners[seg].clone().lerp(corners[seg + 1], Math.min(1, f)));
  }
  return out;
}

/** Rise, then across, then in: the shape used between internal nodes. */
function routeUpFirst(a: T.Vector3, b: T.Vector3): T.Vector3[] {
  return resample([
    a.clone(),
    new T.Vector3(a.x, b.y, a.z),
    new T.Vector3(b.x, b.y, a.z),
    new T.Vector3(b.x, b.y, b.z),
  ], SAMPLES);
}

/** In, then across, then rise: terminals end vertical so they meet a window's bottom edge. */
function routeUpLast(a: T.Vector3, b: T.Vector3): T.Vector3[] {
  return resample([
    a.clone(),
    new T.Vector3(a.x, a.y, b.z),
    new T.Vector3(b.x, a.y, b.z),
    new T.Vector3(b.x, b.y, b.z),
  ], SAMPLES);
}

function bisect(targets: Array<{ pos: T.Vector3; index: number }>): Array<Array<{ pos: T.Vector3; index: number }>> {
  const xs = targets.map((t) => t.pos.x);
  const ys = targets.map((t) => t.pos.y);
  const spreadX = Math.max(...xs) - Math.min(...xs);
  const spreadY = Math.max(...ys) - Math.min(...ys);
  const key = spreadX >= spreadY ? (t: { pos: T.Vector3 }) => t.pos.x : (t: { pos: T.Vector3 }) => t.pos.y;
  const sorted = [...targets].sort((a, b) => key(a) - key(b));
  const half = Math.ceil(sorted.length / 2);
  return [sorted.slice(0, half), sorted.slice(half)];
}

function centroid(targets: Array<{ pos: T.Vector3 }>): T.Vector3 {
  const c = new T.Vector3();
  for (const t of targets) c.add(t.pos);
  return c.divideScalar(targets.length);
}

/** `targets` are the attach points — a window's bottom edge, not its centre. */
export function buildTree(root: T.Vector3, targets: T.Vector3[]): Segment[] {
  const segments: Segment[] = [];

  const grow = (from: T.Vector3, group: Array<{ pos: T.Vector3; index: number }>, depth: number): void => {
    if (group.length === 1) {
      segments.push({ points: routeUpLast(from, group[0].pos), depth, target: group[0].index, fork: null });
      return;
    }
    for (const half of bisect(group)) {
      if (!half.length) continue;
      const c = centroid(half);
      // Each level gains a fixed height, so lateral moves happen on shared planes and the whole
      // structure lines up instead of every branch picking its own elevation.
      const node = new T.Vector3(c.x, Math.min(from.y + RISE, c.y - 0.2), c.z);
      segments.push({ points: routeUpFirst(from, node), depth, target: null, fork: node.clone() });
      grow(node, half, depth + 1);
    }
  };

  grow(root, targets.map((pos, index) => ({ pos, index })), 0);
  return segments;
}

/**
 * How far a segment has grown at time `t`. Parents finish before children start, so growth
 * propagates outward instead of every limb extending at once.
 */
export function growthAt(seg: Segment, t: number, start: number, perDepth: number, duration: number): number {
  const begin = start + seg.depth * perDepth;
  return Math.min(1, Math.max(0, (t - begin) / duration));
}

export const SEGMENT_SAMPLES = SAMPLES;
