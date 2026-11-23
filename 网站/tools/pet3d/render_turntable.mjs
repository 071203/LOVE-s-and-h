import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const [modelArg, labelArg, outputArg] = process.argv.slice(2);
if (!modelArg || !outputArg) {
  console.error('Usage: node tools/pet3d/render_turntable.mjs MODEL LABEL OUTPUT');
  process.exit(2);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const port = 3131;
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.png': 'image/png',
};

const server = http.createServer((req, res) => {
  let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (pathname.startsWith('/vendor/')) {
    pathname = `public${pathname}`;
  }
  const target = path.resolve(root, pathname.replace(/^\/+/, ''));
  if (!target.startsWith(root + path.sep) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
    console.error(`404 ${pathname} -> ${target}`);
    res.writeHead(404);
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream' });
  fs.createReadStream(target).pipe(res);
});

await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
});
const browserErrors = [];

try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('favicon')) {
      browserErrors.push(message.text());
    }
  });
  page.on('pageerror', (error) => browserErrors.push(error.stack || error.message));
  const modelUrl = `/work/pet3d/output/${path.basename(modelArg)}`;
  await page.goto(
    `http://127.0.0.1:${port}/work/pet3d/preview.html?${new URLSearchParams({
      model: modelUrl,
      label: labelArg || path.basename(modelArg, '.glb').toUpperCase(),
    })}`,
    { waitUntil: 'networkidle' }
  );
  await page.waitForFunction(() => window.__previewReady === true, null, { timeout: 30_000 });
  if (browserErrors.length) throw new Error(browserErrors.join('\n'));
  await page.screenshot({ path: outputArg, fullPage: false });
  console.log(`TURNTABLE_SAVED ${outputArg}`);
} catch (error) {
  console.error(`TURNTABLE_FAILED ${error.message}`);
  if (browserErrors.length) console.error(browserErrors.join('\n'));
  throw error;
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
