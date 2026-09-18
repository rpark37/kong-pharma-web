export const environment = {
  production: true,
  /** Set this to the deployed FastAPI host, e.g. https://kong-labs-api.fly.dev/api */
  apiBase: 'https://kong-labs-api.example.com/api',
  snapshotFallback: true,
  /**
   * Where the BodyParts3D geometry chunks (body-N.bin.gz) are fetched from, tried in order. Our own
   * copy comes first so the page needs no network; the upstream mirrors stay as a fallback, and are
   * what a browser without DecompressionStream reaches for — it asks for the uncompressed
   * `body-N.bin`, which we do not hold.
   */
  atlasModelsBases: [
    new URL('data/atlas/models', document.baseURI).href,
    'https://cdn.jsdelivr.net/gh/ashemag/human-atlas@1c38bf35c254a891200d3cedecfd57abebe83d8d/public/models',
    'https://raw.githubusercontent.com/ashemag/human-atlas/1c38bf35c254a891200d3cedecfd57abebe83d8d/public/models',
  ],
};
