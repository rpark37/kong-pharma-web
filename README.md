# Kong's Pharmaceutical Co. — website

Static marketing site, served by GitHub Pages from the `master` branch (no build step).

- `index.html`, `privacy.html`, `404.html` — the pages
- `styles.css` — all styling (later blocks override earlier ones)
- `main.js` — navigation, reveals, reading cursor, video and globe loading
- `i18n.js` — seven-language dictionary and the language switcher (`?lang=de` etc.)
- `hero3d.js`, `globe.js`, `field.js` — Three.js hero, contact globe, membrane field
- `pipeline-viz.js` — the three schematic figures in the drug pipeline
- `analytics.js` — Google Analytics 4 with consent, inert until a Measurement ID is set
- `assets/` — images, team photos, video, social cover

Preview locally with any static server, for example `python3 -m http.server 8761`.
