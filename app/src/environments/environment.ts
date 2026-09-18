export const environment = {
  production: false,
  /** Base URL of the FastAPI + DuckDB service. `/api` is proxied to :8000 by `ng serve`. */
  apiBase: '/api',
  /** When the API is unreachable, load the JSON snapshots under public/data/snapshot. */
  snapshotFallback: true,
  /** Where the BodyParts3D geometry chunks (body-N.bin.gz) are fetched from, tried in order. */
  atlasModelsBases: [
    'https://cdn.jsdelivr.net/gh/ashemag/human-atlas@1c38bf35c254a891200d3cedecfd57abebe83d8d/public/models',
    'https://raw.githubusercontent.com/ashemag/human-atlas/1c38bf35c254a891200d3cedecfd57abebe83d8d/public/models',
  ],
};
