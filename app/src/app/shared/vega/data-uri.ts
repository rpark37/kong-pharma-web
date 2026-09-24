/**
 * Where the gallery specs' datasets actually live.
 *
 * The vendored specs reference their data by relative path, and those paths follow two different
 * conventions that neither resolve against Vega's host as written. Rewriting happens here rather
 * than in the vendored JSON so those files stay byte-identical to what upstream published — an
 * edit there would be silently clobbered the next time the specs are re-vendored.
 *
 * Shared by `VegaChartComponent` and the /transition page, which build their own Vega loaders.
 */
import type { Loader } from 'vega';

/**
 * Relative dataset URLs resolve against our own copy of Vega's data folder — the 37 files the 107
 * gallery specs between them ask for, 18 MB, vendored so the gallery needs no network.
 *
 * Absolute because it is handed to a Vega loader as its `baseURL`, which does not accept a relative
 * one, and because `document.baseURI` is what makes it work under the app's `./` base href on Pages.
 */
export const VEGA_DATA_BASE = new URL('data/vega/', document.baseURI).href;

/**
 * Files the mirror above does not cover, keyed by the name the spec asks for. The two SandDance
 * datasets are absent from Vega's host entirely, and the specs that use them disagree about how to
 * ask — scatter3D says `../../sample-data/`, titanic says `assets/data/` — so the match is on
 * filename rather than prefix. The sprite sheet is an absolute link to an image host, and the only
 * asset in the gallery that is fetched from outside Vega's own data folder.
 *
 * The values resolve absolute because a relative path would be resolved against the loader's
 * `baseURL`, which points at our Vega data folder rather than at the app root.
 */
const VENDORED: Record<string, string> = {
  'demovote.tsv': 'data/demovote.tsv',
  'titanicmaster.tsv': 'data/titanicmaster.tsv',
  'Screen-Shot-2020-12-13-at-3-36-09-PM.png': 'data/vega/data/platformer-sprites.png',
};

export function resolveDataUri(uri: string): string {
  const file = uri.slice(uri.lastIndexOf('/') + 1);
  const vendored = VENDORED[file];
  if (vendored) return new URL(vendored, document.baseURI).href;
  // Specs from the Vega Editor say `assets/data/<file>`; on vega.github.io it is `data/<file>`.
  if (uri.startsWith('assets/data/')) return uri.slice('assets/'.length);
  return uri;
}

/** Wraps a Vega loader so it applies {@link resolveDataUri} before resolving against the baseURL. */
export function patchLoader(loader: Loader): Loader {
  const sanitize = loader.sanitize.bind(loader);
  loader.sanitize = (uri, options) => sanitize(resolveDataUri(String(uri)), options);
  return loader;
}
