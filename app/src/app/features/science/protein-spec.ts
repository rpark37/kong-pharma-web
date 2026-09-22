/**
 * A protein as beads on a string: every residue's alpha-carbon as a sphere, coloured by
 * AlphaFold's confidence in its position (pLDDT), path-traced by MorphCharts. The trace comes
 * from `app/scripts/fetch-structures.py`, which reduces the AlphaFold model to Cα atoms.
 */
import { currentTheme, sceneSurface } from '../../shared/theme/surface';
import type { StructureSnapshot } from './science.model';

/** Cα atoms sit 3.8 Å apart along the chain; beads this size touch, so the chain reads as one. */
const BEAD = 3.8;

/** AlphaFold's four confidence bands, in the app's ink: very high, confident, low, very low. */
export const PLDDT_BANDS = [
  { min: 90, label: 'Very high', light: '#00705D', dark: '#4CC2A6' },
  { min: 70, label: 'Confident', light: '#5DB8A0', dark: '#8CD9C4' },
  { min: 50, label: 'Low', light: '#996600', dark: '#E2B44A' },
  { min: 0, label: 'Very low', light: '#B3261E', dark: '#F07A72' },
] as const;

export function plddtBand(plddt: number): (typeof PLDDT_BANDS)[number] {
  return PLDDT_BANDS.find((b) => plddt >= b.min) ?? PLDDT_BANDS[PLDDT_BANDS.length - 1];
}

export function bandColor(plddt: number): string {
  const band = plddtBand(plddt);
  return currentTheme() === 'dark' ? band.dark : band.light;
}

/** Share of residues AlphaFold is confident about (pLDDT ≥ 70). */
export function confidentShare(s: StructureSnapshot): number {
  return s.residues.filter((r) => r[3] >= 70).length / Math.max(1, s.residues.length);
}

export function proteinSpec(s: StructureSnapshot): Record<string, unknown> {
  const paper = sceneSurface();
  const xs = s.residues.map((r) => r[0]), ys = s.residues.map((r) => r[1]), zs = s.residues.map((r) => r[2]);
  const extent = Math.max(...xs.map(Math.abs), ...ys.map(Math.abs), ...zs.map(Math.abs)) + BEAD;
  const size = extent * 2;
  const values = s.residues.map((r, i) => {
    const [x, y, z, plddt] = r;
    const hex = bandColor(plddt);
    const n = parseInt(hex.slice(1), 16);
    return { i: i + 1, xc: x + extent, yc: y + extent, zc: z + extent, plddt, r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  });
  return {
    title: s.symbol,
    width: size, height: size, depth: size,
    background: paper.background,
    // Ambient does the work; one broad area light gives the beads their roundness.
    lights: [{ type: 'rect', position: [size * 0.2, size * 1.6, size * 1.5], brightness: 0.8, size: size, color: '#f4f7f6' }],
    // Close enough that the fold fills the box; the camera panel dollies from here.
    camera: { worldPosition: [size / 2, size / 2, size / 2 + size * 1.2], worldTarget: [size / 2, size / 2, size / 2], fov: 40 },
    data: [{ name: 'residues', values }],
    marks: [{
      name: 'residues', type: 'rect', geometry: 'sphere', material: 'diffuse',
      from: { data: 'residues' },
      encode: { enter: {
        xc: { field: 'xc' }, yc: { field: 'yc' }, zc: { field: 'zc' },
        width: { value: BEAD }, height: { value: BEAD }, depth: { value: BEAD },
        fill: { color: { r: { field: 'r' }, g: { field: 'g' }, b: { field: 'b' } } },
        fuzz: { value: 0.2 },
      } },
    }],
  };
}
