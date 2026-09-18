/**
 * Canonical colour values for the light theme. `styles/_tokens.scss` mirrors these by hand —
 * SCSS cannot import TypeScript — so any change here must be applied there too. The contrast
 * assertions in palette.spec.ts are what stop the two drifting into something unreadable.
 */
export const PALETTE_LIGHT = {
  // Surfaces, lightest to darkest.
  paper: '#FAF9F7',
  panel: '#F5F5F3',
  chrome: '#E8E8E6',
  border: '#D4D4D2',

  // Foreground, darkest to lightest. `inkMuted` carries 12px body copy (every page's `.note`),
  // so it is held to 4.5:1 rather than the 3:1 a large-text-only token would need.
  ink: '#2D2D2D',
  inkDim: '#5A5A5A',
  inkMuted: '#707070',

  // Accents. teal leads; orange is secondary and large-text-only.
  teal: '#00705D',
  tealBright: '#00A88A',
  tealDeep: '#004C3F',
  orange: '#D4740C',
  orangeLight: '#E8923B',

  // Semantic states.
  warning: '#996600',
  error: '#B3261E',
  success: '#1E6B3A',
} as const;

function channelToLinear(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = channelToLinear(parseInt(full.slice(0, 2), 16));
  const g = channelToLinear(parseInt(full.slice(2, 4), 16));
  const b = channelToLinear(parseInt(full.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.1 contrast ratio, 1 to 21. Order independent. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

function labF(t: number): number {
  return t > Math.pow(6 / 29, 3) ? Math.cbrt(t) : t / (3 * Math.pow(6 / 29, 2)) + 4 / 29;
}

function hexToLab(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = channelToLinear(parseInt(full.slice(0, 2), 16));
  const g = channelToLinear(parseInt(full.slice(2, 4), 16));
  const b = channelToLinear(parseInt(full.slice(4, 6), 16));
  // sRGB -> XYZ (D65), then XYZ -> CIE Lab.
  const x = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = 0.0193339 * r + 0.119192 * g + 0.9503041 * b;
  const fx = labF(x / 0.95047);
  const fy = labF(y / 1.0);
  const fz = labF(z / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIE76 colour difference (ΔE*ab) in Lab space, hue- and lightness-sensitive unlike contrastRatio. */
export function deltaE76(a: string, b: string): number {
  const [l1, a1, b1] = hexToLab(a);
  const [l2, a2, b2] = hexToLab(b);
  return Math.sqrt((l1 - l2) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2);
}
