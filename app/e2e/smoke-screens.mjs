// Screenshot smoke test: node e2e/smoke-screens.mjs [baseUrl] [outDir]
import { chromium } from '@playwright/test';
const base = process.argv[2] ?? 'http://localhost:4173';
const out = process.argv[3] ?? 'test-results';
const exe = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: exe, args: ['--enable-unsafe-webgpu', '--use-angle=swiftshader', '--enable-features=Vulkan', '--ignore-certificate-errors'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => console.log('pageerror:', e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('CERT')) console.log('console.error:', m.text()); });
const routes = ['/app/', '/app/morphcharts?plot=bar2', '/app/ares', '/app/merchandise', '/app/atlas', '/app/bayes', '/app/vega-charts', '/app/google', '/app/hud', '/app/site-map', '/app/controls', '/app/gev', '/app/osiris'];
for (const path of routes) {
  await page.goto(base + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const gpu = await page.evaluate(() => 'gpu' in navigator && !!navigator.gpu);
  console.log(path, '| title:', await page.title(), '| webgpu:', gpu);
  if (path.includes('morphcharts')) {
    const start = page.getByRole('button', { name: 'Start' });
    await start.waitFor({ state: 'visible', timeout: 5000 }).catch(() => null);
    for (let i = 0; i < 40 && (await start.count()) && !(await start.isEnabled()); i++) await page.waitForTimeout(500);
    if ((await start.count()) && (await start.isEnabled())) {
      await start.click();
      await page.waitForTimeout(5000);
      console.log('  editor chars:', (await page.locator('app-spec-editor textarea').inputValue()).length, '| stop button:', await page.getByRole('button', { name: 'Stop' }).count());
      const err = await page.locator('.error').textContent().catch(() => null);
      if (err) console.log('  error strip:', err);
      const pixel = await page.evaluate(() => { const c = document.querySelector('canvas'); if (!c) return null; const cv = document.createElement('canvas'); cv.width = 8; cv.height = 8; const ctx = cv.getContext('2d'); ctx.drawImage(c, 0, 0, 8, 8); const d = ctx.getImageData(0, 0, 8, 8).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2]; return s; });
      console.log('  canvas brightness sum:', pixel);
    } else {
      console.log('  start disabled or missing; fallback shown:', await page.locator('app-webgpu-fallback').count());
    }
  }
  await page.screenshot({ path: `${out}/shot${path.replace(/[^a-z]/g, '_')}.png` });
}
await browser.close();
