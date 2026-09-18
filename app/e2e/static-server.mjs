// Minimal static server for e2e: serves dist/app/browser under /app/ with SPA fallback.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? 'dist/app/browser');
const port = Number(process.argv[3] ?? 4173);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.csv': 'text/csv', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  let path = decodeURIComponent(url.pathname);
  if (!path.startsWith('/app')) { res.writeHead(302, { location: '/app/' }); res.end(); return; }
  path = path.replace(/^\/app\/?/, '');
  let file = join(root, path);
  try {
    const s = await stat(file);
    if (s.isDirectory()) file = join(file, 'index.html');
  } catch {
    file = join(root, 'index.html');
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('not found');
  }
}).listen(port, () => console.log(`static server on http://localhost:${port}/app/ (${root})`));
