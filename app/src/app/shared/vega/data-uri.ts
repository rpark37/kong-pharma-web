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

/** Relative dataset URLs resolve against Vega's own host: 56 MB of data, not worth vendoring. */
export const VEGA_DATA_BASE = 'https://vega.github.io/vega/';

/**
 * Datasets that live on SandDance rather than Vega's host. The two specs that use them disagree
 * about how to ask — scatter3D says `../../sample-data/`, titanic says `assets/data/` — so they
 * are matched on filename rather than prefix.
 */
const SANDDANCE_DATA = new Set(['demovote.tsv', 'titanicmaster.tsv']);
const SANDDANCE_BASE = 'https://microsoft.github.io/SandDance/sample-data/';

export function resolveDataUri(uri: string): string {
  const file = uri.slice(uri.lastIndexOf('/') + 1);
  if (SANDDANCE_DATA.has(file)) return SANDDANCE_BASE + file;
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
