# Kong's Pharmaceutical — site and Labs app

Two things live in this repository:

| Path | What | Stack |
| --- | --- | --- |
| `/` (root) | The marketing site, served as static files by GitHub Pages | HTML, CSS, GSAP, three.js from CDN |
| `app/` | **Kong's Labs**, published at `/app/` | Angular 22 (standalone, signals, zoneless), GreenSock, Vega / Vega-Lite, MorphCharts (WebGPU) |
| `api/` | The data service behind the Labs pages | FastAPI + DuckDB over Parquet |

## Labs pages

- `/app/morphcharts` — a recreation of the [MorphCharts client](https://microsoft.github.io/morphcharts/client.html): write a Vega-style spec, path-trace it on WebGPU, capture it at up to 8K.
- `/app/ares` — [OHDSI Ares](https://github.com/OHDSI/Ares)-style data characterization reports (person, observation period, density, concepts, data quality) as Vega-Lite specs over a synthetic OMOP-like dataset.
- `/app/merchandise` — Google Merchandise Store analytics from the public GA4 sample (or a schema-faithful synthetic sample when no BigQuery credentials are available), including a MorphCharts 3D revenue cube.
- `/app/atlas` — a hybrid of [human-atlas](https://github.com/ashemag/human-atlas): **Anatomy** mode streams the real BodyParts3D meshes (2,234 structures, 2.3 M triangles, ~33 MB gzipped from jsDelivr with a GitHub fallback) into three.js; **Data** mode renders the same catalogue as a spec-driven MorphCharts scene. Both share the system toggles, search, isolate, camera presets and the GSAP-tweened explode slider.
- `/app/bayes` — the therapeutic-tests Bayes' theorem visualization (source in `docs/bayes-source/`) rebuilt on the current MorphCharts: a synthetic population of blocks that morphs between four views (everyone, disease vs healthy, the 2×2 outcome grid, positive tests only) with GSAP-staggered transitions, plus Vega-Lite companions sharing the same inputs.
- `/app/gev` — a God's Eye View spatial-intelligence console: a three.js vector globe under a painted 1600×900 overlay, replaying a committed snapshot of aircraft, satellites and earthquakes. The console fills the viewport as the largest 16:9 frame that fits (letterboxed, since the overlay stretches to the stage), with a Fullscreen button for edge to edge; the sensor modes are SVG colour-table filters.

Every visualization is a Vega-style specification: Vega-Lite / Vega for 2D (rendered by Vega's D3-based SVG renderer), MorphCharts' Vega-derived grammar for 3D. The one exception is the atlas's Anatomy mode, which is a mesh viewer (three.js) rather than a chart; its Data mode is the spec-driven equivalent. All motion uses GreenSock Quad eases with shared delays and staggers (`app/src/app/shared/animation/motion.ts`).

## Run the app

Requires Node 24 (see `.nvmrc`).

```sh
cd app
npm ci            # also compiles the vendored MorphCharts packages
npm start         # http://localhost:4200/app/ with /api proxied to :8000
npm test          # Vitest unit tests
npm run build     # production build in app/dist/app/browser
npm run e2e       # headless smoke screenshots into app/test-results
```

MorphCharts is vendored from a pinned upstream commit into `app/vendor/morphcharts` (MIT). To update, change the commit in `app/scripts/vendor-morphcharts.sh`, run it, review the diff, and rebuild.

## Run the API

Requires Python 3.11 and [uv](https://docs.astral.sh/uv/).

```sh
cd api
make install      # uv sync --extra dev
make data         # GA4 (BigQuery if GOOGLE_APPLICATION_CREDENTIALS is set, else synthetic), OMOP synthetic, atlas catalogue
make serve        # http://localhost:8000/api/health
make test         # pytest
make snapshot     # writes app/public/data/snapshot/*.json so the static site works without the API
```

The API is not hosted by GitHub Pages. Build `api/Dockerfile` and run it anywhere (Fly, Render, Cloud Run, a VM), set `API_CORS_ORIGINS` to the Pages origin, and put the URL in `app/src/environments/environment.production.ts`. Until then the deployed app reads the committed JSON snapshots and shows an "API offline" badge.

## Deploy

`.github/workflows/pages.yml` builds `app/`, copies the root static files plus `app/dist` into `_site/app/`, and deploys with `actions/deploy-pages`. In the repository settings, set **Pages → Source** to **GitHub Actions**. Deep links such as `/app/atlas` are handled by the redirect in `404.html`.

## Credits

MorphCharts © Microsoft (MIT). Anatomy data: BodyParts3D © The Database Center for Life Science, CC BY 4.0, packaged by ashemag/human-atlas (MIT). GA4 sample: Google Merchandise Store public dataset. Report design inspired by OHDSI Ares (Apache-2.0).
