export const environment = {
  production: true,
  /** Set this to the deployed FastAPI host, e.g. https://kong-labs-api.fly.dev/api */
  apiBase: 'https://kong-labs-api.example.com/api',
  snapshotFallback: true,
  /** Where the BodyParts3D geometry chunks (body-N.bin.gz) are fetched from, tried in order. */
  atlasModelsBases: [
    'https://cdn.jsdelivr.net/gh/ashemag/human-atlas@1c38bf35c254a891200d3cedecfd57abebe83d8d/public/models',
    'https://raw.githubusercontent.com/ashemag/human-atlas/1c38bf35c254a891200d3cedecfd57abebe83d8d/public/models',
  ],
};
