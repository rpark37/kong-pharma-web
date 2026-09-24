# SandDance insight files

Downloaded verbatim from
https://microsoft.github.io/SandDance/tests/sanddance-specs/v1/specs/
(the file list comes from that page's "Insight file" dropdown).

These are **SandDance Insight objects, not Vega specs.** An Insight is the
high-level description — which column maps to x, y, z, colour and size, the
chart type, 2d or 3d, and a colour scheme. The `sanddance-specs` library
compiles an Insight plus a dataset into a Vega spec; nothing here renders on
its own.

```json
{ "columns": { "x": "Longitude", "y": "Latitude", "color": "Income", "z": "Income" },
  "scheme": "redyellowgreen", "size": { "height": 600, "width": 800 },
  "chart": "scatterplot", "view": "2d" }
```

21 files: 7 `barchartV`, 5 `scatterplot`, 5 `stacks`, 4 `density`; 19 are `3d`.

Every one is written against **demovote.tsv** — they reference `Longitude`,
`Latitude`, `Income`, `Education`, `Obama`, `MedAge`, `State` and `TotalPop`.
That is the same dataset `features/vega-charts` already loads for the
`Scatter 3D` spec, resolved from
`https://microsoft.github.io/SandDance/sample-data/demovote.tsv` by
`VegaChartComponent.resolveDataUri()`.

Vendored as published — treat as read-only and re-download rather than editing.
