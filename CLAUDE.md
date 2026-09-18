# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Read `README.md` first** for what each Labs page is and the full command list for
`app/` and `api/`. This file covers only what you cannot learn from one file.

## Two codebases, one repo

| Path | Build step? | Notes |
| --- | --- | --- |
| `/` (root) | **None** | Static marketing site. Edit a file, reload the browser. |
| `app/` | Angular 22 | "Kong's Labs", served at `/app/`. |
| `api/` | FastAPI + uv | Optional; the app degrades without it. |

Both ship from the same GitHub Pages deploy (`.github/workflows/pages.yml`).

---

## Root static site

No package.json, no bundler, no test runner. Serve the root with any static
server. Everything below is a convention that spans several files — breaking one
fails silently rather than loudly.

**Section colour themes.** Every `<section>` carries exactly one of
`section--teal` / `--ink` / `--paper` / `--white` (defined `styles.css:110-124`).
That class sets background + text colour *and* is read by `initNavTheme()` in
`main.js` so the transparent toolbar recolours itself against whatever section is
behind it. A new section without one of these classes gets an unreadable nav.

**Translation.** `i18n.js` is one ~112 KB inline `I18N` object covering 7
languages (en/zh/es/ko/fr/de/ja). Every user-visible string in `index.html`
needs a `data-i18n="key"` attribute plus a matching entry, or it silently stays
English when the language changes. `setLang()` GSAP-fades each element to its new
text and persists the choice to `localStorage`. Brand names, product codes
(CR-067, K-119, XTL-152) and contact details are deliberately left untranslated.
Medical copy is machine-generated — the file header flags it for review.

**Motion is gated twice.** `main.js` returns early if `prefers-reduced-motion:
reduce` **or** `window.gsap` is missing, leaving the DOM fully visible and
selectable. This is why the page still reads correctly when the CDN is blocked.
Keep new animation behind the same gate, and never hide content in CSS that only
JS restores.

**Script load order matters.** In `index.html`: GSAP (+ ScrollTrigger, SplitText,
ScrambleTextPlugin) → `main.js` → `pipeline-viz.js` → `i18n.js`.
`pipeline-viz.js` runs synchronously at parse time on purpose, so its injected
banner SVG exists in the DOM before `main.js` measures `scrollHeight` for the
accordion grow animation. Deferring it breaks the accordion height.

**`main.js` shape.** One `DOMContentLoaded` handler delegating to named `init*`
functions. Nearly all are `IntersectionObserver`-driven with a non-observer
fallback path. `globe.js` is *not* loaded by a `<script>` tag — `initLazyGlobe()`
dynamic-imports it only when the contact section approaches.

**Adding a drug program** means touching two files: a `data-viz-emblem="<key>"`
and `data-viz-banner="<key>"` in `index.html`, plus a matching entry in the `VIZ`
registry in `pipeline-viz.js` (currently `cr067`, `k119`, `xtl`).

**Hardcoded data.** CR-067 trial figures live in `initTrialCounter()` in
`main.js` (`const stats = {...}`, alongside a `SIMULATE_DRIFT` demo flag). Globe
site coordinates are the `SITES` array at the top of `globe.js`.

**Pinned CDN versions.** Three.js 0.160.0 via the importmap at the bottom of
`index.html`; GSAP 3.13.0 from jsDelivr. Do not drop below GSAP 3.13 — SplitText
is only free from that version.

---

## `app/` — Kong's Labs

Commands are in `README.md`. The traps:

- **Node 24 required** (`.nvmrc`; `engines` wants `>=22.22.3 || >=24.15.0`).
- **`npm ci` also compiles.** `postinstall` → `vendor:build` runs three `tsc`
  projects over `vendor/morphcharts/{core,spec,renderers/webgpuraytrace}`, wired
  as npm workspaces. A failure there is a TypeScript error, not a dependency one.
- **Never hand-edit `app/vendor/morphcharts/`.** It is vendored from a pinned
  upstream commit. To update, change `COMMIT` in `scripts/vendor-morphcharts.sh`,
  re-run it, review the diff, then `npm run vendor:build`.
- **Motion constants are centralised** in `src/app/shared/animation/motion.ts`
  (Quad eases, shared durations/delays/staggers). Components call `GsapService`
  rather than choosing eases ad hoc. `GsapService.reveal()` uses `autoAlpha`, so
  `[data-reveal]` elements are genuinely hidden until the tween runs — a
  screenshot taken mid-reveal looks like a blank page.
- **Page reveals are router-driven.** `RouteTransitionDirective` reveals
  `[data-reveal]` children on `NavigationEnd`. Content added outside that
  mechanism will not animate in.
- **Unit tests are Vitest** via `@angular/build:unit-test` (`npm test`).

## `api/` — data service

FastAPI + DuckDB over Parquet, driven by `api/Makefile` (`install`, `data`,
`serve`, `test`, `snapshot`). Requires Python 3.11 + `uv`.

`app/proxy.conf.json` forwards `/api` → `127.0.0.1:8000`. **Nothing serves that
unless you start the API separately**, and that is expected: pages fall back to
the committed JSON in `app/public/data/snapshot/` (regenerated by `make
snapshot`) and show an "API offline" badge. The `/app/bayes` page uses
`generateBayesData` locally and needs no API at all.

GitHub Pages does not host the API. Deploy `api/Dockerfile` anywhere, set
`API_CORS_ORIGINS`, and put the URL in
`app/src/environments/environment.production.ts`.

## Deep links on Pages

`/app/<route>` is a client-side route with no file behind it. `404.html` contains
a redirect shim that hands the path to the app as `?r=`, which the app consumes
after bootstrap. Changing the app's base href means changing that shim too.

## Historical docs — do not follow

`docs/superpowers/plans/` and `docs/superpowers/specs/` describe the original
build in a `web2/` directory. They are **superseded**: the design tokens listed
there (`--teal: #0B5563`, `--paper: #F4F1E9`) are not the current ones in
`styles.css`, and they state "no team section" when there is one. Treat them as
history, not specification. `docs/bayes-source/` is the standalone Angular
project the `/app/bayes` page was ported from — reference only.
