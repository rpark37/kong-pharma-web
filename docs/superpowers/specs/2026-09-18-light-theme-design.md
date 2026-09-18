# Light theme for the labs app

**Date:** 2026-09-18
**Status:** Approved design, not yet implemented
**Scope:** `app/` (the Angular labs app) only

## Context

The labs app has only ever had one theme: teal-on-near-black, defined as single values
in `app/src/styles/_tokens.scss`. There is no `prefers-color-scheme` rule, no
`data-theme` attribute and no `color-scheme` declaration anywhere in the app — every
surface resolves to one dark value.

We are replacing that with a single light theme. Dark is not retained and there is no
toggle: building a switch nobody flips is cost without benefit, and the tokens remain
the natural seam if dark is ever wanted back.

The palette and type are taken from `claude_test/02_lexcorp-os`. Note that the
reference is *not* a light app — its `body` is `#1C1C1C`, and the light values appear
only in its window, taskbar and file-browser components. It is a dark desktop carrying
light windows. We are taking its palette and typography, not its structure.

### Why this is not a value swap

A spike on 2026-09-18 changed only the CSS background of the Controls stage to
`#f4f7f8`. The scene did not lighten. The map plane is an opaque texture that fills
`#0b1318`, so it stayed dark and read as a dark rectangle pasted onto a light page,
while the additive overlay above it washed out to near-invisible.

Each three.js scene carries **four independent layers of darkness**, and they must all
flip together or the result looks broken:

1. The CSS stage background
2. Opaque geometry fills (`paintMap()`, MorphCharts spec `background`)
3. The blend mode
4. The `fui-panels.ts` PALETTE, which paints light ink on transparent

## Non-goals

- The root marketing site keeps its current theme. This was a deliberate decision, and
  it does mean a visitor crossing from the marketing site into `/app/` meets a hard
  theme boundary.
- No theme toggle, no `prefers-color-scheme` support, no dark retention.
- No redesign of layout, composition or motion. Colour, type and blend mode only.

## 1. Tokens and type

Replaces the values in `app/src/styles/_tokens.scss`.

### Surfaces and ink

**No token is renamed.** The existing convention is already theme-agnostic: `--ink*`
is the base surface and `--on-ink*` is the foreground drawn on it. That survives a
light theme untouched — only the values change.

This matters more than it sounds. `var(--on-ink*)` appears 104 times across the app
and `var(--ink*)` 6 times. Renaming would have meant 110 edits for no gain, and
repurposing `--ink` as a text colour would have silently broken
`body { background: var(--ink) }`.

| Token | From | To | Role |
| --- | --- | --- | --- |
| `--ink` | `#121c24` | `#FAF9F7` | page background |
| `--ink-2` | `#192630` | `#F5F5F3` | cards, panels |
| `--ink-3` | `#24343f` | `#E8E8E6` | insets, secondary surfaces |
| `--hairline` | `rgba(230,246,243,0.12)` | `#D4D4D2` | hairlines, dividers |
| `--on-ink` | `#e6f6f3` | `#2D2D2D` | primary text |
| `--on-ink-dim` | `rgba(230,246,243,0.62)` | `#5A5A5A` | secondary text |
| `--on-ink-faint` | `rgba(230,246,243,0.38)` | `#8A8A8A` | tertiary text |
| `--panel` | `rgba(25,38,48,0.78)` | `#F5F5F3` | `.glass` surface |
| `--panel-solid` | `#192630` | `#F5F5F3` | opaque panel |

`--ink-light` `#ABABAB` is added for the faintest tier, which the dark theme expressed
as low-alpha white and which does not translate to a single light value.

Contrast pairs in the tables below use `--ink-2` `#F5F5F3` as the reference surface.

### Accents

Contrast measured against `#F5F5F3`:

| Token | Value | Contrast | Permitted use |
| --- | --- | --- | --- |
| `--teal` | `#00705D` | 5.06:1 | primary accent, body text, strokes |
| `--teal-bright` | `#00A88A` | 2.6:1 | large graphics and fills only, never text |
| `--teal-deep` | `#004C3F` | 8.2:1 | hover, pressed, emphasis |
| `--orange` | `#D4740C` | 3.1:1 | secondary accent; large text and UI strokes only |
| `--orange-light` | `#E8923B` | 2.2:1 | fills only, never text |

The reference assigns green to dark surfaces and orange to light. We invert that
assignment: teal leads and orange is secondary. The reason is brand continuity — teal
is the product's identity across both codebases, and `#00705D` is recognisably the
same hue as the current `#44e0cc`, darkened enough to survive on paper. Leading with
orange would read as a different product. The reference could put its green on dark
because its windows float on a dark desktop; a light app has no such surface.

Neither reference accent can carry body text on light: `#00D4AA` measures 1.75:1 and
`#D4740C` measures 3.1:1, against the 4.5:1 that AA requires. `#00705D` is derived
specifically to clear that bar.

### Semantic states

Starting values, each to be verified against `#F5F5F3` before use. Text states must
reach 4.5:1; non-text indicators 3:1.

| Token | Proposed | Target |
| --- | --- | --- |
| `--warning` | `#9A6700` | 4.5:1 |
| `--error` | `#B3261E` | 4.5:1 |
| `--success` | `#1E6B3A` | 4.5:1 |

### Elevation

Dark themes signal elevation by making a surface lighter than its background. A light
theme cannot, so it needs shadow. There are no shadow tokens today; without them every
card reads dead flat. Add:

- `--shadow-sm: 0 1px 2px rgba(45, 45, 45, 0.06), 0 1px 3px rgba(45, 45, 45, 0.10)`
- `--shadow-md: 0 2px 8px rgba(45, 45, 45, 0.08)`

### Type

A 1:1 swap of the three existing roles.

| Token | From | To |
| --- | --- | --- |
| `--font-display` | Space Grotesk | Rajdhani |
| `--font-body` | Inter | IBM Plex Sans |
| `--font-mono` | JetBrains Mono | IBM Plex Mono |

`app/src/index.html` replaces its Google Fonts link with:

```
https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&family=Rajdhani:wght@500;600;700&display=swap
```

Rajdhani runs narrow and tall relative to Space Grotesk; display sizes will need a
visual pass after the swap rather than assuming the existing `clamp()` values hold.

## 2. Canvas inversion

Affects `features/hud/hud-scene.ts` (1 blending site), `features/map/map-scene.ts` (4)
and `features/athena/athena-scene.ts` (4).

### Normal blending, not multiply

Multiply was considered and rejected. The canvases already run `alpha: true` with a
transparent clear, so the CSS background shows through. With `NormalBlending` and dark
ink on a transparent canvas the compositing is simply correct — the CSS paper *is* the
destination. This avoids multiply's requirement for an opaque destination entirely.

Multiply only earns its keep when overlapping strokes should accumulate density. For
canvas-textured quads carrying their own artwork, normal is correct and simpler.

All nine `AdditiveBlending` sites become `NormalBlending`. Line geometry (route arcs,
site beams, the scan ring) uses `--teal` at explicit opacity; overlapping lines no
longer accumulate brightness, which is the desired behaviour on paper.

### Opaque geometry

`paintMap()` currently fills `#0b1318` across the whole map texture. It should fill
nothing — leave the canvas transparent and draw only the graticule and landmass
strokes, letting the CSS paper show through.

### PALETTE inversion

One file, `shared/fui/fui-panels.ts`, consumed by all three features:

| Current | Becomes |
| --- | --- |
| `text: #e6f6f3` | `#2D2D2D` |
| `dim`, `faint`, `micro` | the `#5A5A5A` → `#ABABAB` ink scale |
| `teal: #44e0cc` | `#00705D` |
| `tealDim`, `tealFaint` | alpha variants of `#00705D` |
| `ink`, `ink2`, `ink3` (used as panel fills) | `paper`, `panel`, `chrome` |
| `amber`, `rose` | the semantic state values above |

### The depth cue inverts

These scenes convey distance by dimming — fog, falling opacity, fading beams. On paper,
distant things must get *lighter*, not darker. Anywhere depth is expressed as opacity
the behaviour survives unchanged; anywhere it is expressed as a darker colour it
inverts. Audit these specifically rather than assuming:

- `hud-scene.ts` — baked blur is colour-agnostic and unaffected
- `map-scene.ts` / `athena-scene.ts` — beam opacity for locked vs unlocked sites, scan
  ring opacity falloff, route arc opacity

### MorphCharts

`bayes-scene.ts`, `google-specs.ts`, `merchandise-specs.ts`, `atlas-spec.ts` and
`atlas-fallback-spec.ts` carry `background: '#121c24'`, label colours `#e6f6f3` and
grid colours `#24343f`. These are value changes only. MorphCharts' own gallery samples
render on white studio floors, so the path tracer is if anything better suited to light
than dark.

## 3. DOM layer

### `.glass` stops being glass

`app/src/styles.scss` defines `.glass` as `rgba(25, 38, 48, 0.78)` plus a backdrop
blur — a dark translucent pane. That concept does not survive on paper. It becomes a
solid `--panel` with a `--hairline` border and `--shadow-sm`. The `backdrop-filter` is
dropped rather than ported: it buys almost nothing on light and costs compositing. The
class name is retained because every page uses it; only its definition changes.

### Categorical chart palette

`CATEGORY_RANGE` in `shared/vega/theme.ts` is seven hues tuned to sit on near-black.
They must be re-derived, not darkened: the palette has to stay mutually distinguishable
*and* clear 3:1 on paper, and naive darkening collapses the greens and blues toward
each other. Rename `VEGA_DARK_CONFIG` to `VEGA_CONFIG`, since only one config will
exist. Axis, grid, label and title colours come from the ink scale.

### Hardcoded values

Fourteen files carry hardcoded dark hex values. These follow mechanically once the
tokens land, with the exception noted below.

Page components (`.stage { background: #0b1318 }` and similar):
`athena-page.component.ts`, `bayes-page.component.ts`, `hud-page.component.ts`,
`map-page.component.ts`

Scenes: `athena-scene.ts`, `map-scene.ts`, `bayes-scene.ts`, `anatomy-viewer.ts`

Spec builders: `atlas-spec.ts`, `atlas-fallback-spec.ts`, `google-specs.ts`,
`merchandise-specs.ts`

Shared: `fui-panels.ts`, `vega/theme.ts`

### `anatomy-viewer.ts` is genuinely uncertain

Unlike the FUI scenes, the atlas viewer renders real PBR meshes under a
`RoomEnvironment` image-based light. Changing the background changes perceived material
brightness, so it may need exposure or environment adjustment rather than a colour
edit. Treat it as its own investigation rather than assuming a value swap suffices.

## Testing

The 22 existing tests do not touch colour and will not catch any of this.

Add a contrast test asserting that the key pairs from Section 1 meet their targets:
text-on-surface at 4.5:1, accents and non-text indicators at 3:1. It is cheap, it
encodes the decisions above, and it fails loudly if someone later substitutes a
prettier teal that cannot be read.

`app/e2e/smoke-screens.mjs` already screenshots every route and is the practical check
for the canvas work.

## Rollout

In dependency order. Phase 3 is a deliberate stop.

1. Tokens, global styles, fonts. The DOM layer flips atomically; there is no coherent
   half-state.
2. Vega config and the re-derived categorical palette.
3. `/hud` canvas inversion — **stop and inspect before continuing.** The first
   prediction about canvas behaviour on light was wrong; validate the approach on the
   simplest scene before committing to the other two.
4. `map-scene.ts` and `athena-scene.ts`, once phase 3 validates.
5. MorphCharts spec values, then `anatomy-viewer.ts` as its own pass.

## Risks

- **Phase 3 may invalidate the approach.** If normal blending on a transparent canvas
  does not composite as expected, the fallback is an opaque light clear colour per
  scene with multiply blending — more work, and it changes how overlapping strokes read.
- **Rajdhani's metrics differ from Space Grotesk.** Display sizing needs a visual pass.
- **The categorical palette may not satisfy both constraints.** If seven hues cannot be
  both distinguishable and 3:1 on paper, reduce the count or accept 3:1 only for the
  hues that carry meaning.
- **The marketing site boundary is now visible.** Deliberate, but worth revisiting once
  the labs app lands.
