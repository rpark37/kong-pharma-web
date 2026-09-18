/**
 * The gallery specs fetch their data from five different hosts — vega-datasets, SandDance,
 * charticulator — and their own `data/…` paths from the MorphCharts site. All of it is vendored
 * into `public/data` so the page works with no network, which also removes five third-party hosts
 * from the page's runtime dependencies.
 *
 * The relative paths need no help: they resolve against our own base once the files are there.
 * Only the absolute URLs are rewritten, and only when we actually hold the file — so a spec that
 * grows a new remote dataset keeps working, it just needs the network until someone vendors it.
 *
 * The rewrite happens on the way in, leaving the spec files byte-identical to upstream so a
 * re-download diffs cleanly. Same reasoning as `shared/vega/data-uri.ts`.
 */
const VENDORED = new Set([
  'flare.json', // flaretreemap1, flarecirclepack1, flaresunburst1
  'miserables.json', // lesmis1
  'population.json', // populationpyramid1
  'demovote.tsv', // electiontreemap1
  'polio_incidence_rates_us.csv', // uspolio1
]);

export function useVendoredData(specText: string): string {
  return specText.replace(/"https?:\/\/[^"]+\/([^"/]+)"/g, (whole, name: string) =>
    VENDORED.has(name) ? `"data/${name}"` : whole);
}
