/**
 * The gallery specs reference their inputs by relative path. Rather than vendor all 9.5 MB of them,
 * the datasets are pointed back at upstream, which serves every file with
 * `access-control-allow-origin: *`.
 *
 * Images are the exception and must stay local. MorphCharts decodes a texture into a 2D canvas and
 * reads it back with `getImageData`; a cross-origin image taints that canvas, and the SecurityError
 * takes down the whole scene rather than just the texture — a blank canvas with no error in the UI.
 * `crossOrigin` would fix it but is set inside the vendored renderer, so the two textures the
 * gallery needs (2.1 MB) are vendored into public/data instead.
 *
 * The rewrite is keyed on the `gallery/` folder rather than on a list of filenames: the 34 samples
 * in `specs/` reference `data/` too, and theirs are vendored and must stay local. Same reasoning as
 * `shared/vega/data-uri.ts` — rewrite on the way in, leave the spec files byte-identical to
 * upstream so a re-download diffs cleanly.
 */
export const GALLERY_DATA_BASE = 'https://microsoft.github.io/morphcharts/';

/** Read back with getImageData, so they have to come from our own origin. */
const TEXTURE = /\.(png|jpe?g|webp)$/i;

/** `file` is the plot path as it appears in index.json, e.g. `gallery/ustornados1.json`. */
export function resolveGalleryData(file: string, specText: string): string {
  if (!file.startsWith('gallery/')) return specText;
  return specText.replace(/"data\/([^"]+)"/g, (whole, name: string) =>
    TEXTURE.test(name) ? whole : `"${GALLERY_DATA_BASE}data/${name}"`);
}
