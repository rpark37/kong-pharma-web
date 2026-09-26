/**
 * The insight files vendored under `public/data/sanddance/insights/`, which are the set the
 * SandDance specs test page offers. Listed here rather than discovered at runtime because a static
 * deploy has no directory listing to read.
 *
 * Each is a SandDance Insight — column-to-encoding mappings, chart type, 2d/3d and a colour scheme
 * — not a Vega spec. Every one is written against demovote.tsv.
 */
export const INSIGHT_DIR = 'data/sanddance/insights';

export interface InsightEntry {
  /** File name under {@link INSIGHT_DIR}. */
  file: string;
  label: string;
}

export const INSIGHTS: InsightEntry[] = [
  { file: 'column-categoric.json', label: 'Column categoric' },
  { file: 'column-facet-cross.json', label: 'Column facet cross' },
  { file: 'column-facet-wrap.json', label: 'Column facet wrap' },
  { file: 'column-sum-strip-pct.json', label: 'Column sum strip percent' },
  { file: 'column-sum-strip.json', label: 'Column sum strip' },
  { file: 'column-sum-treemap.json', label: 'Column sum treemap' },
  { file: 'column.json', label: 'Column' },
  { file: 'density-facet-cross.json', label: 'Density facet cross' },
  { file: 'density-facet-wrap.json', label: 'Density facet wrap' },
  { file: 'density-treemap.json', label: 'Density treemap' },
  { file: 'density.json', label: 'Density' },
  { file: 'scatter-facet-cross.json', label: 'Scatter facet cross' },
  { file: 'scatter-facet-wrap-with-image.json', label: 'Scatter facet wrap with image' },
  { file: 'scatter-facet-wrap.json', label: 'Scatter facet wrap' },
  { file: 'scatter-with-image.json', label: 'Scatter with image' },
  { file: 'scatter.json', label: 'Scatter' },
  { file: 'stacks-facet-cross.json', label: 'Stacks facet cross' },
  { file: 'stacks-facet-wrap-with-image.json', label: 'Stacks facet wrap with image' },
  { file: 'stacks-facet-wrap.json', label: 'Stacks facet wrap' },
  { file: 'stacks-with-image.json', label: 'Stacks with image' },
  { file: 'stacks.json', label: 'Stacks' },
];
