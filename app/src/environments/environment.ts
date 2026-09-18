export const environment = {
  production: false,
  /** Base URL of the FastAPI + DuckDB service. `/api` is proxied to :8000 by `ng serve`. */
  apiBase: '/api',
  /** When the API is unreachable, load the JSON snapshots under public/data/snapshot. */
  snapshotFallback: true,
};
