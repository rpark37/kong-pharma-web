# Light Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the labs app's single dark theme with a single light theme, including inverting three three.js canvas scenes that currently rely on additive blending.

**Architecture:** Token values change in place — no token is renamed, because `--ink*` (base surface) and `--on-ink*` (foreground) is already a theme-agnostic convention. The canvases switch from `AdditiveBlending` to `NormalBlending`; since they already run `alpha: true` over a transparent clear, dark ink composites correctly against the CSS background with no opaque destination needed. A new TypeScript palette module becomes the single source for colour values, which `_tokens.scss` mirrors and `vega/theme.ts` imports.

**Tech Stack:** Angular 22, SCSS custom properties, three.js 0.186, vega-embed, Vitest via `@angular/build:unit-test`.

**Spec:** `docs/superpowers/specs/2026-09-18-light-theme-design.md`

## Global Constraints

- Scope is `app/` only. The root marketing site (`/styles.css`, `/main.js`, `/index.html`) is explicitly out of scope and keeps its dark theme.
- No token is renamed. `--ink*` stays the base surface scale; `--on-ink*` stays the foreground scale. Values change only.
- Single theme. No toggle, no `prefers-color-scheme`, no dark retention.
- Text on surface must reach 4.5:1 contrast. Non-text indicators and UI strokes must reach 3:1.
- Reference surface for all contrast assertions is `#F5F5F3`.
- Primary accent is `--teal` `#00705D`. Secondary is `--orange` `#D4740C`, permitted for large text and UI strokes only.
- Run `npm test` from `app/` before every commit. All 22 existing tests must continue to pass.
- Node 24 required (`.nvmrc`). Use `nvm use` before npm commands.

---

## File Structure

**Created:**
- `app/src/app/shared/theme/palette.ts` — canonical colour values plus `contrastRatio()`. Single source that `_tokens.scss` mirrors and `vega/theme.ts` imports.
- `app/src/app/shared/theme/palette.spec.ts` — contrast assertions encoding the spec's Section 1 decisions.

**Modified:**
- `app/src/styles/_tokens.scss` — token values
- `app/src/styles.scss` — `.glass`, shadows
- `app/src/index.html` — Google Fonts link
- `app/src/app/shared/vega/theme.ts` — light config, re-derived categorical palette
- `app/src/app/shared/fui/fui-panels.ts` — PALETTE inversion
- `app/src/app/features/hud/hud-scene.ts` — 1 blending site
- `app/src/app/features/map/map-scene.ts` — 4 blending sites, `paintMap()` fill
- `app/src/app/features/athena/athena-scene.ts` — 4 blending sites, `paintMap()` fill
- `app/src/app/features/{hud,map,athena}/​*-page.component.ts` — `.stage` background
- `app/src/app/features/bayes/bayes-page.component.ts` — `.morphcharts-container` background
- `app/src/app/features/{bayes/bayes-scene,google/google-specs,merchandise/merchandise-specs,atlas/atlas-spec,atlas/atlas-fallback-spec}.ts` — MorphCharts colour values
- `app/src/app/features/atlas/anatomy-viewer.ts` — investigation, may need exposure changes

**Merge boundary:** Tasks 5–8 must land together. Task 5 inverts the shared PALETTE, which leaves `/site-map` and `/controls` rendering dark ink on dark canvas until Tasks 7–8 invert their scenes. Do not merge a partial range.

---

### Task 1: Palette module and contrast test

**Files:**
- Create: `app/src/app/shared/theme/palette.ts`
- Create: `app/src/app/shared/theme/palette.spec.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `PALETTE_LIGHT` (object with the keys listed below, all string hex values), `contrastRatio(a: string, b: string): number`

- [ ] **Step 1: Write the failing test**

Create `app/src/app/shared/theme/palette.spec.ts`:

```typescript
import { PALETTE_LIGHT, contrastRatio } from './palette';

const SURFACE = PALETTE_LIGHT.panel;

describe('light palette contrast', () => {
  it('computes known contrast ratios correctly', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 1);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 2);
  });

  it('is order independent', () => {
    expect(contrastRatio('#F5F5F3', '#2D2D2D')).toBeCloseTo(contrastRatio('#2D2D2D', '#F5F5F3'), 5);
  });

  it('gives body text at least AA contrast on panel', () => {
    for (const key of ['ink', 'inkDim'] as const) {
      expect(contrastRatio(PALETTE_LIGHT[key], SURFACE), key).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('gives the primary accent AA contrast for body text', () => {
    expect(contrastRatio(PALETTE_LIGHT.teal, SURFACE)).toBeGreaterThanOrEqual(4.5);
  });

  it('gives secondary accent and muted text at least 3:1 for large text and strokes', () => {
    for (const key of ['orange', 'inkMuted'] as const) {
      expect(contrastRatio(PALETTE_LIGHT[key], SURFACE), key).toBeGreaterThanOrEqual(3);
    }
  });

  it('gives semantic states AA contrast', () => {
    for (const key of ['warning', 'error', 'success'] as const) {
      expect(contrastRatio(PALETTE_LIGHT[key], SURFACE), key).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps fill-only colours out of text use by documenting them below 4.5', () => {
    expect(contrastRatio(PALETTE_LIGHT.tealBright, SURFACE)).toBeLessThan(4.5);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd app && nvm use && npm test
```

Expected: FAIL — `Cannot find module './palette'`.

- [ ] **Step 3: Write the palette module**

Create `app/src/app/shared/theme/palette.ts`:

```typescript
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

  // Foreground, darkest to lightest.
  ink: '#2D2D2D',
  inkDim: '#5A5A5A',
  inkMuted: '#8A8A8A',
  inkLight: '#ABABAB',

  // Accents. teal leads; orange is secondary and large-text-only.
  teal: '#00705D',
  tealBright: '#00A88A',
  tealDeep: '#004C3F',
  orange: '#D4740C',
  orangeLight: '#E8923B',

  // Semantic states.
  warning: '#9A6700',
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
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd app && nvm use && npm test
```

Expected: PASS, 29 tests total (22 existing + 7 new).

If a semantic state fails its 4.5 threshold, darken it until it passes and record the new value — do not lower the threshold.

- [ ] **Step 5: Commit**

```bash
git add app/src/app/shared/theme/palette.ts app/src/app/shared/theme/palette.spec.ts
git commit -m "feat(labs): add light palette module with contrast assertions"
```

---

### Task 2: Token values

**Files:**
- Modify: `app/src/styles/_tokens.scss`

**Interfaces:**
- Consumes: `PALETTE_LIGHT` values from Task 1 (copied by hand; SCSS cannot import TS)
- Produces: the CSS custom properties every component already references

- [ ] **Step 1: Replace the colour tokens**

In `app/src/styles/_tokens.scss`, replace the colour block inside `:root` (the lines from `--teal:` through `--glow:`) with:

```scss
  // Mirrors app/src/app/shared/theme/palette.ts — keep the two in step.
  --teal: #00705D;
  --teal-bright: #00A88A;
  --teal-deep: #004C3F;
  --teal-ink: #004C3F;
  --orange: #D4740C;
  --orange-light: #E8923B;
  --violet: #5B4BC4;
  --green: #1E6B3A;
  --amber: #9A6700;
  --rose: #B3261E;
  --ink: #FAF9F7;
  --ink-2: #F5F5F3;
  --ink-3: #E8E8E6;
  --on-ink: #2D2D2D;
  --on-ink-dim: #5A5A5A;
  --on-ink-faint: #8A8A8A;
  --on-ink-light: #ABABAB;
  --hairline: #D4D4D2;
  --panel: #F5F5F3;
  --panel-solid: #F5F5F3;
  --glow: rgba(0, 112, 93, 0.14);
  --shadow-sm: 0 1px 2px rgba(45, 45, 45, 0.06), 0 1px 3px rgba(45, 45, 45, 0.10);
  --shadow-md: 0 2px 8px rgba(45, 45, 45, 0.08);
```

Also update the file's header comment, which currently reads "Dark surfaces only":

```scss
// Design tokens for the labs app light theme. Values mirror
// app/src/app/shared/theme/palette.ts, which carries the contrast tests.
// --ink* is the base surface scale; --on-ink* is the foreground on it.
```

- [ ] **Step 2: Verify the app builds and renders**

```bash
cd app && nvm use && npm start
```

Open `http://localhost:4200/`. Expected: light page background, dark text, teal accents. Cards will look flat — Task 3 adds shadows. Canvas pages will look wrong — Tasks 5–8 fix those.

- [ ] **Step 3: Run tests**

```bash
cd app && nvm use && npm test
```

Expected: PASS, 29 tests.

- [ ] **Step 4: Commit**

```bash
git add app/src/styles/_tokens.scss
git commit -m "feat(labs): flip design tokens to the light palette"
```

---

### Task 3: Global styles — panels and elevation

**Files:**
- Modify: `app/src/styles.scss:33-39` (`.glass`)
- Modify: `app/src/styles.scss:53` (`.btn.active`)
- Modify: `app/src/app/app.scss:36` (nav `.active`)

**Interfaces:**
- Consumes: `--panel`, `--hairline`, `--shadow-sm`, `--teal`, `--ink` from Task 2
- Produces: `.glass` as a solid light panel; legible active states

- [ ] **Step 1: Replace the `.glass` rule**

In `app/src/styles.scss`, replace:

```scss
.glass {
  background: var(--panel);
  border: 1px solid var(--hairline);
  border-radius: var(--radius);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}
```

with:

```scss
// Was a dark translucent pane. On paper that concept does not survive: it is now a solid
// panel with a hairline and a shadow, because a light theme signals elevation with shadow
// rather than by making a surface lighter than its background. backdrop-filter is dropped
// rather than ported — it buys almost nothing on light and costs compositing.
.glass {
  background: var(--panel);
  border: 1px solid var(--hairline);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
}
```

- [ ] **Step 2: Fix the two active states that would become invisible**

Both rules put `--teal-deep` text on a `--teal` background. In the dark theme that was
`#063a34` on `#44e0cc` — dark on bright, legible. After Task 2 it becomes `#004C3F` on
`#00705D`, which is dark on dark and effectively invisible. The fix is paper text on the dark
teal chip.

In `app/src/styles.scss` line 53, change:

```scss
  &.active, &[aria-pressed="true"] { background: var(--teal); color: var(--teal-deep); border-color: var(--teal); }
```

to:

```scss
  &.active, &[aria-pressed="true"] { background: var(--teal); color: var(--ink); border-color: var(--teal); }
```

In `app/src/app/app.scss` line 36, change:

```scss
    &.active { color: var(--teal-deep); background: var(--teal); }
```

to:

```scss
    &.active { color: var(--ink); background: var(--teal); }
```

`--ink` is `#FAF9F7` after Task 2, giving roughly 5.1:1 against `#00705D`.

- [ ] **Step 3: Verify visually**

With `npm start` running, open `http://localhost:4200/`. Expected: cards read as raised panels
with a soft shadow, not flat rectangles. Open the Examples nav menu and confirm the active route
chip shows paper-coloured text on a dark teal background, not a solid unreadable block.

- [ ] **Step 4: Run tests**

```bash
cd app && nvm use && npm test
```

Expected: PASS, 29 tests.

- [ ] **Step 5: Commit**

```bash
git add app/src/styles.scss app/src/app/app.scss
git commit -m "feat(labs): solid panels, shadow elevation, legible active states"
```

---

### Task 4: Fonts

**Files:**
- Modify: `app/src/index.html:13`
- Modify: `app/src/styles/_tokens.scss` (the three font tokens)

**Interfaces:**
- Consumes: nothing
- Produces: `--font-display`, `--font-body`, `--font-mono` pointing at the new families

- [ ] **Step 1: Replace the Google Fonts link**

In `app/src/index.html`, replace line 13 with:

```html
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&family=Rajdhani:wght@500;600;700&display=swap" rel="stylesheet">
```

- [ ] **Step 2: Repoint the font tokens**

In `app/src/styles/_tokens.scss`, replace the three font declarations with:

```scss
  --font-display: "Rajdhani", "Space Grotesk", system-ui, sans-serif;
  --font-body: "IBM Plex Sans", system-ui, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
```

- [ ] **Step 3: Update the Vega font references**

In `app/src/app/shared/vega/theme.ts`, change the two font strings in `VEGA_DARK_CONFIG`:

```typescript
  font: 'IBM Plex Sans, system-ui, sans-serif',
```

and in the `title` block:

```typescript
  title: { color: VEGA_COLORS.onInk, fontSize: 13, fontWeight: 600, anchor: 'start', font: 'Rajdhani, IBM Plex Sans, sans-serif' },
```

- [ ] **Step 4: Verify display sizing**

With `npm start` running, check `http://localhost:4200/bayes` and `http://localhost:4200/`. Rajdhani runs narrower and taller than Space Grotesk. Headings using `clamp()` may now look undersized. If any heading reads noticeably smaller, raise its `clamp()` middle value by roughly 10% rather than leaving it.

- [ ] **Step 5: Run tests and commit**

```bash
cd app && nvm use && npm test
git add app/src/index.html app/src/styles/_tokens.scss app/src/app/shared/vega/theme.ts
git commit -m "feat(labs): switch to Rajdhani, IBM Plex Sans and IBM Plex Mono"
```

---

### Task 5: Vega config

**Files:**
- Modify: `app/src/app/shared/vega/theme.ts`
- Modify: `app/src/app/shared/vega/vega-chart.component.ts` (import rename)
- Modify: `app/src/app/features/bayes/bayes-page.component.ts`, `app/src/app/features/vega-charts/vega-charts-specs.ts` (any `VEGA_DARK_CONFIG` or `VEGA_COLORS` references)

**Interfaces:**
- Consumes: `PALETTE_LIGHT` from Task 1
- Produces: `VEGA_CONFIG` (renamed from `VEGA_DARK_CONFIG`), `VEGA_COLORS`, `CATEGORY_RANGE`

- [ ] **Step 1: Find every reference before renaming**

```bash
cd app && grep -rn "VEGA_DARK_CONFIG\|VEGA_COLORS\|CATEGORY_RANGE" src/
```

Record the list. Every hit must be updated in Step 2 or the build breaks.

- [ ] **Step 2: Rewrite the theme module**

Replace the contents of `app/src/app/shared/vega/theme.ts` with:

```typescript
import { PALETTE_LIGHT } from '../theme/palette';

/** Vega config for the labs app light theme. Colours come from shared/theme/palette.ts. */
export const VEGA_COLORS = {
  teal: PALETTE_LIGHT.teal,
  violet: '#5B4BC4',
  green: PALETTE_LIGHT.success,
  amber: PALETTE_LIGHT.warning,
  rose: PALETTE_LIGHT.error,
  sky: '#1F6FB2',
  sand: '#8A6A3D',
  onInk: PALETTE_LIGHT.ink,
  dim: PALETTE_LIGHT.inkDim,
  faint: PALETTE_LIGHT.inkMuted,
  grid: 'rgba(45, 45, 45, 0.10)',
};

/**
 * Re-derived for paper rather than darkened from the dark set. Two constraints fight here:
 * every hue must clear 3:1 on #F5F5F3 and stay distinguishable from its neighbours. Naive
 * darkening collapses the greens and blues toward each other, which is why these are picked
 * rather than computed.
 */
export const CATEGORY_RANGE = [
  VEGA_COLORS.teal,
  VEGA_COLORS.violet,
  VEGA_COLORS.green,
  VEGA_COLORS.amber,
  VEGA_COLORS.rose,
  VEGA_COLORS.sky,
  VEGA_COLORS.sand,
  '#4A5A5F',
];

export const VEGA_CONFIG: Record<string, unknown> = {
  background: 'transparent',
  padding: 8,
  font: 'IBM Plex Sans, system-ui, sans-serif',
  axis: {
    domainColor: VEGA_COLORS.faint,
    gridColor: VEGA_COLORS.grid,
    tickColor: VEGA_COLORS.faint,
    labelColor: VEGA_COLORS.dim,
    titleColor: VEGA_COLORS.dim,
    labelFontSize: 11,
    titleFontSize: 11,
    titleFontWeight: 'normal',
    titlePadding: 8,
  },
  legend: { labelColor: VEGA_COLORS.dim, titleColor: VEGA_COLORS.dim, labelFontSize: 11, titleFontSize: 11, symbolSize: 80 },
  title: { color: VEGA_COLORS.onInk, fontSize: 13, fontWeight: 600, anchor: 'start', font: 'Rajdhani, IBM Plex Sans, sans-serif' },
  view: { stroke: null },
  range: { category: CATEGORY_RANGE, ordinal: { scheme: 'teals' }, ramp: { scheme: 'teals' } },
  mark: { color: VEGA_COLORS.teal },
  bar: { color: VEGA_COLORS.teal, cornerRadiusEnd: 2 },
  line: { color: VEGA_COLORS.teal, strokeWidth: 2 },
  area: { color: VEGA_COLORS.teal, opacity: 0.25 },
  point: { color: VEGA_COLORS.teal, filled: true },
  arc: { stroke: '#F5F5F3', strokeWidth: 1 },
  text: { color: VEGA_COLORS.onInk },
  rect: { color: VEGA_COLORS.teal },
};
```

- [ ] **Step 3: Update every reference found in Step 1**

Rename `VEGA_DARK_CONFIG` to `VEGA_CONFIG` at each site. In `vega-chart.component.ts` this is both the import and the `config:` property in the `vegaEmbed` options object.

- [ ] **Step 4: Extend the contrast test to cover the categorical palette**

Append to `app/src/app/shared/theme/palette.spec.ts`:

```typescript
import { CATEGORY_RANGE } from '../vega/theme';

describe('categorical chart palette', () => {
  it('clears 3:1 on panel for every hue', () => {
    for (const hue of CATEGORY_RANGE) {
      expect(contrastRatio(hue, PALETTE_LIGHT.panel), hue).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps every hue distinguishable from its neighbours', () => {
    for (let i = 0; i < CATEGORY_RANGE.length; i++) {
      for (let j = i + 1; j < CATEGORY_RANGE.length; j++) {
        expect(contrastRatio(CATEGORY_RANGE[i], CATEGORY_RANGE[j]), `${CATEGORY_RANGE[i]} vs ${CATEGORY_RANGE[j]}`)
          .not.toBeCloseTo(1, 1);
      }
    }
  });
});
```

- [ ] **Step 5: Run tests**

```bash
cd app && nvm use && npm test
```

Expected: PASS, 31 tests. If a categorical hue fails 3:1, darken that hue and re-run. If two hues are indistinguishable, replace one rather than nudging both.

- [ ] **Step 6: Verify visually**

Open `http://localhost:4200/vega-charts` and `http://localhost:4200/merchandise`. Expected: charts legible on light, axis labels readable, categorical series distinguishable.

- [ ] **Step 7: Commit**

```bash
git add app/src/app/shared/vega/theme.ts app/src/app/shared/vega/vega-chart.component.ts app/src/app/shared/theme/palette.spec.ts app/src/app/features/
git commit -m "feat(labs): light Vega config with a re-derived categorical palette"
```

---

### Task 6: FUI palette inversion

**Files:**
- Modify: `app/src/app/shared/fui/fui-panels.ts` (the `PALETTE` export)

**Interfaces:**
- Consumes: `PALETTE_LIGHT` from Task 1
- Produces: `PALETTE` with the same key names and inverted values. Key names must not change — `hud-scene.ts`, `map-scene.ts` and `athena-scene.ts` reference them as `P.PALETTE.teal` and so on.

**Note:** This task leaves `/site-map` and `/controls` rendering dark ink on a dark canvas until Tasks 8–9. That is expected. Tasks 6–9 land together.

- [ ] **Step 1: Replace the PALETTE export**

In `app/src/app/shared/fui/fui-panels.ts`, replace the `PALETTE` object with:

```typescript
export const PALETTE = {
  // Surface fills, used as panel and well backgrounds inside the canvas artwork.
  ink: '#FAF9F7',
  ink2: '#F5F5F3',
  ink3: '#E8E8E6',
  // Accent. Alpha variants are for decorative strokes, not text.
  teal: '#00705D',
  tealDim: 'rgba(0, 112, 93, 0.55)',
  tealFaint: 'rgba(0, 112, 93, 0.22)',
  tealDeep: '#004C3F',
  // Foreground scale.
  text: '#2D2D2D',
  dim: 'rgba(45, 45, 45, 0.70)',
  faint: 'rgba(45, 45, 45, 0.45)',
  micro: 'rgba(45, 45, 45, 0.22)',
  amber: '#9A6700',
  rose: '#B3261E',
} as const;
```

The alpha values are deliberately higher than the dark theme's. Low-alpha dark ink on paper washes out faster than low-alpha light ink on near-black, so `0.62` becomes `0.70` and `0.30` becomes `0.45`.

- [ ] **Step 2: Run tests**

```bash
cd app && nvm use && npm test
```

Expected: PASS, 31 tests. No test covers PALETTE directly; this confirms nothing else broke.

- [ ] **Step 3: Commit**

```bash
git add app/src/app/shared/fui/fui-panels.ts
git commit -m "feat(labs): invert the shared FUI palette to dark ink on paper"
```

---

### Task 7: Readout canvas — the validation gate

**Files:**
- Modify: `app/src/app/features/hud/hud-scene.ts:189`
- Modify: `app/src/app/features/hud/hud-page.component.ts:47`

**Interfaces:**
- Consumes: `PALETTE` from Task 6
- Produces: a validated answer to whether normal blending on a transparent canvas composites correctly over a light CSS background

**This is the stop-and-inspect gate.** Do not start Task 8 until a human has looked at `/hud`.

- [ ] **Step 1: Change the blend mode**

In `app/src/app/features/hud/hud-scene.ts` line 189, change:

```typescript
      const mat = new T.MeshBasicMaterial({ map: tex, transparent: true, blending: T.AdditiveBlending, depthWrite: false });
```

to:

```typescript
      // Normal, not additive: the canvas runs alpha:true over a transparent clear, so dark ink
      // composites correctly against the light CSS background with no opaque destination needed.
      const mat = new T.MeshBasicMaterial({ map: tex, transparent: true, blending: T.NormalBlending, depthWrite: false });
```

- [ ] **Step 2: Change the stage background**

In `app/src/app/features/hud/hud-page.component.ts` line 47, change `background: #0b1318;` to `background: var(--ink-2);`.

- [ ] **Step 3: Update the scene's header comment**

The file comment says the blur is baked "rather than run through a bokeh pass" — still true. Add a line recording the blend decision:

```typescript
 * Blending is normal rather than additive: on paper, ink darkens the surface instead of adding
 * light to it. The baked blur is colour-agnostic and unaffected.
```

- [ ] **Step 4: Verify visually — the gate**

```bash
cd app && nvm use && npm start
```

Open `http://localhost:4200/hud` and check all four:

1. The page background is paper, with no dark rectangle anywhere
2. Text and linework read as dark ink, legible against the surface
3. The three depth layers are still distinguishable — near sharp, far blurred
4. The status bar still reads as the steady anchor amid the jittering periphery

If item 1 or 2 fails, the normal-blending approach is wrong and the fallback applies: give the renderer an opaque light clear colour and use `T.MultiplyBlending`. Record which path was taken before continuing.

- [ ] **Step 5: Run tests and commit**

```bash
cd app && nvm use && npm test
git add app/src/app/features/hud/
git commit -m "feat(labs): invert the readout canvas to ink on paper"
```

- [ ] **Step 6: STOP — get human sign-off on `/hud` before Task 8**

---

### Task 8: Site map canvas

**Files:**
- Modify: `app/src/app/features/map/map-scene.ts:35-36, 128, 147, 154, 169`
- Modify: `app/src/app/features/map/map-page.component.ts:46`

**Interfaces:**
- Consumes: `PALETTE` from Task 6; the blending decision validated in Task 7
- Produces: nothing consumed downstream

- [ ] **Step 1: Make the map texture transparent**

In `paintMap()` at `app/src/app/features/map/map-scene.ts` lines 35–36, delete these two lines:

```typescript
  ctx.fillStyle = '#0b1318';
  ctx.fillRect(0, 0, MW, MH);
```

The canvas stays transparent and the CSS paper shows through. Leaving them is what made the earlier spike render a dark rectangle on a light page.

- [ ] **Step 2: Recolour the generated world**

In the same function, change the landmass fills from teal-on-black to ink-on-paper:

```typescript
  ctx.fillStyle = 'rgba(0, 112, 93, 0.07)';
  ctx.fillRect(0, 0, MW, MH);
  ctx.fillStyle = 'rgba(0, 112, 93, 0.13)';
```

and the graticule strokes:

```typescript
    ctx.strokeStyle = lon % 60 === 0 ? 'rgba(0, 112, 93, 0.26)' : 'rgba(0, 112, 93, 0.10)';
```

```typescript
    ctx.strokeStyle = lat === 0 ? 'rgba(0, 112, 93, 0.30)' : 'rgba(0, 112, 93, 0.10)';
```

and the longitude labels:

```typescript
  ctx.fillStyle = 'rgba(45, 45, 45, 0.34)';
```

- [ ] **Step 3: Change all four blend modes**

At lines 128, 147, 154 and 169, change each `blending: T.AdditiveBlending` to `blending: T.NormalBlending`. Also change the origin beam colour at line 128 from `0xe6f6f3` to `0x2D2D2D`, and the three `0x44e0cc` values at lines 128, 147 and 154 to `0x00705D`.

- [ ] **Step 4: Raise the line opacities**

Additive lines got their presence from accumulating light. Normal-blended dark lines need explicit weight. At line 147 change `opacity: 0.28` to `opacity: 0.45`, and at line 154 change `opacity: 0.4` to `opacity: 0.55`.

- [ ] **Step 5: Invert the depth cue**

In `step()`, unlocked beams currently fade to `0.12` opacity to read as distant. On paper that still reads correctly — lower opacity means lighter means further. Verify visually in Step 7 rather than changing it.

- [ ] **Step 6: Change the stage background**

In `app/src/app/features/map/map-page.component.ts` line 46, change `background: #0b1318;` to `background: var(--ink-2);`.

- [ ] **Step 7: Verify visually**

Open `http://localhost:4200/site-map`. Expected: paper background, graticule visible but subtle, site beams as dark marks, callouts legible, scan ring visible as it expands, locked and unlocked sites still distinguishable.

- [ ] **Step 8: Run tests and commit**

```bash
cd app && nvm use && npm test
git add app/src/app/features/map/
git commit -m "feat(labs): invert the site map canvas to ink on paper"
```

---

### Task 9: Console canvas

**Files:**
- Modify: `app/src/app/features/athena/athena-scene.ts:60-61, 141, 158, 164, 178`
- Modify: `app/src/app/features/athena/athena-page.component.ts:47`

**Interfaces:**
- Consumes: `PALETTE` from Task 6; the same changes applied in Task 8
- Produces: nothing consumed downstream

`athena-scene.ts` is the merged map-plus-readout scene and its `paintMap()` is a near-copy of the map's. Apply the same changes at the athena line numbers.

- [ ] **Step 1: Make the map texture transparent**

At `app/src/app/features/athena/athena-scene.ts` lines 60–61, delete:

```typescript
  ctx.fillStyle = '#0b1318';
  ctx.fillRect(0, 0, MW, MH);
```

- [ ] **Step 2: Recolour the generated world**

Apply the same fills, graticule strokes and label colour as Task 8 Step 2, at the corresponding lines in this file.

- [ ] **Step 3: Change all four blend modes and colours**

At lines 141, 158, 164 and 178, change `blending: T.AdditiveBlending` to `blending: T.NormalBlending`. Change `0xe6f6f3` to `0x2D2D2D` at line 141, and `0x44e0cc` to `0x00705D` at lines 141, 158 and 164.

- [ ] **Step 4: Raise the line opacities**

At line 158 change `opacity: 0.28` to `opacity: 0.45`; at line 164 change `opacity: 0.4` to `opacity: 0.55`.

- [ ] **Step 5: Change the stage background**

In `app/src/app/features/athena/athena-page.component.ts` line 47, change `background: #0b1318;` to `background: var(--ink-2);`.

- [ ] **Step 6: Verify visually**

Open `http://localhost:4200/controls`. Expected: the hero numeral, anchor bar, slab plates, evaluation table and instrument rail all legible as dark ink; tracking callouts still follow their beam heads; the scan ring still locks sites as it expands.

- [ ] **Step 7: Run tests and commit**

```bash
cd app && nvm use && npm test
git add app/src/app/features/athena/
git commit -m "feat(labs): invert the console canvas to ink on paper"
```

---

### Task 10: MorphCharts spec colours

**Files:**
- Modify: `app/src/app/features/bayes/bayes-scene.ts:279, 284, 294`
- Modify: `app/src/app/features/bayes/bayes-page.component.ts:146`
- Modify: `app/src/app/features/google/google-specs.ts:16, 51` and every other `#e6f6f3` / `#24343f` / `#192630` in the file
- Modify: `app/src/app/features/merchandise/merchandise-specs.ts:119, 131-138`
- Modify: `app/src/app/features/atlas/atlas-spec.ts:124, 129`
- Modify: `app/src/app/features/atlas/atlas-fallback-spec.ts`

**Interfaces:**
- Consumes: the palette values from Task 1
- Produces: nothing consumed downstream

MorphCharts renders its own path-traced 3D. Its gallery samples render on white studio floors, so light suits the renderer; these are value changes only.

- [ ] **Step 1: Find every occurrence**

```bash
cd app && grep -rn "'#121c24'\|'#e6f6f3'\|'#24343f'\|'#192630'" src/app/features/
```

- [ ] **Step 2: Apply the substitutions**

At every hit:

| From | To | Meaning |
| --- | --- | --- |
| `'#121c24'` | `'#F5F5F3'` | scene background |
| `'#192630'` | `'#E8E8E6'` | ground plane / secondary fill |
| `'#24343f'` | `'#D4D4D2'` | grid lines |
| `'#e6f6f3'` | `'#2D2D2D'` | label and title text |

Leave `color:` values inside `lights:` arrays as `'#e6f6f3'` — those are light source colours, not surface colours, and changing them to dark grey would dim the render. In `bayes-scene.ts:284` and `atlas-spec.ts:129` the `#e6f6f3` is a light colour: **do not change it**.

- [ ] **Step 3: Change the Bayes container background**

In `app/src/app/features/bayes/bayes-page.component.ts` line 146, change `background: #121c24;` to `background: var(--ink-2);`.

- [ ] **Step 4: Verify visually**

Open `http://localhost:4200/bayes`, `/google`, `/merchandise` and `/atlas`. Expected: path-traced scenes render on a light ground with dark labels, and are not blown out. If a scene looks washed out, reduce the light `brightness` values by roughly 30% rather than darkening the background.

- [ ] **Step 5: Run tests and commit**

```bash
cd app && nvm use && npm test
git add app/src/app/features/
git commit -m "feat(labs): light MorphCharts scene and label colours"
```

---

### Task 11: Atlas anatomy viewer

**Files:**
- Modify: `app/src/app/features/atlas/anatomy-viewer.ts`

**Interfaces:**
- Consumes: the palette values from Task 1
- Produces: nothing consumed downstream

Unlike the FUI scenes, this renders real PBR meshes under a `RoomEnvironment` image-based light. Background changes alter perceived material brightness, so this is an investigation, not a substitution.

- [ ] **Step 1: Find the background and environment setup**

```bash
cd app && grep -n "setClearColor\|background\|RoomEnvironment\|toneMapping\|toneMappingExposure\|#0b1318\|#121c24" src/app/features/atlas/anatomy-viewer.ts
```

- [ ] **Step 2: Change the scene background to paper**

Set the clear colour or `scene.background` to `0xF5F5F3`. Keep `RoomEnvironment` as the environment map — it lights the meshes and is not the background.

- [ ] **Step 3: Verify and adjust exposure**

Open `http://localhost:4200/atlas`. Expected: anatomy meshes readable against a light background, with selection and isolation still visible.

Against a light background the meshes will likely read as too dark or too flat. If so, adjust `renderer.toneMappingExposure` — start at `1.2` and move in `0.1` steps — rather than changing the mesh materials. If exposure alone cannot separate the meshes from the background, add a subtle outline or darken the mesh base colour, and record which was needed.

- [ ] **Step 4: Run tests and commit**

```bash
cd app && nvm use && npm test
git add app/src/app/features/atlas/anatomy-viewer.ts
git commit -m "feat(labs): light background for the anatomy viewer"
```

---

### Task 12: Full-route verification

**Files:**
- Modify: none, unless a regression is found

**Interfaces:**
- Consumes: all previous tasks
- Produces: a verified light theme across every route

- [ ] **Step 1: Run the full test suite**

```bash
cd app && nvm use && npm test
```

Expected: PASS, 31 tests.

- [ ] **Step 2: Check every route for console errors**

With `npm start` running, visit each of `/`, `/morphcharts`, `/ares`, `/merchandise`, `/atlas`, `/bayes`, `/vega-charts`, `/google`, `/hud`, `/site-map`, `/controls`. For each, confirm no console errors and no residual dark surface.

- [ ] **Step 3: Confirm the active states fixed in Task 3 still hold**

Open a dropdown from the Examples menu and confirm the active route chip is legible. Press a
`.btn` into its `aria-pressed` state on `/morphcharts` and confirm the same. Both were repaired
in Task 3; this verifies nothing later reintroduced `--teal-deep` on `--teal`.

- [ ] **Step 4: Commit any fixes**

```bash
cd /Users/richardpark/Desktop/kong_pharma/code/kong-atlas
git add -A app/
git commit -m "fix(labs): light theme regressions found in full-route verification"
```
