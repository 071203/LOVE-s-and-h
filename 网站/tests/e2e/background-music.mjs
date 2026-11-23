import assert from 'node:assert/strict';
import { chromium } from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:3015';
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];

page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error' && !message.text().includes('favicon')) {
    errors.push(message.text());
  }
});

try {
  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  const dock = page.locator('[data-site-music]');
  await dock.waitFor({ state: 'visible', timeout: 5_000 });

  assert.match(await dock.textContent(), /特别的人/);
  assert.match(await dock.textContent(), /方大同/);
  assert.equal(await dock.getAttribute('data-music-source'), 'netease');
  assert.equal(await dock.getAttribute('data-music-autoplay'), 'attempted');

  const frame = dock.locator('.site-music-frame');
  const src = await frame.getAttribute('src');
  assert.ok(src, 'missing NetEase background player');
  const playerUrl = new URL(src);
  assert.equal(playerUrl.hostname, 'music.163.com');
  assert.equal(playerUrl.searchParams.get('id'), '28403111');
  assert.equal(playerUrl.searchParams.get('auto'), '1');
  assert.equal(await frame.getAttribute('allow'), 'autoplay');

  await dock.locator('.site-music-toggle').click();
  assert.equal(await dock.locator('.site-music-toggle').getAttribute('aria-expanded'), 'true');
  assert.equal(await dock.evaluate((node) => node.classList.contains('is-open')), true);
  if (process.env.MUSIC_SCREENSHOT) {
    await page.screenshot({ path: process.env.MUSIC_SCREENSHOT, fullPage: false });
  }

  await page.goto(`${baseUrl}/pets`, { waitUntil: 'networkidle' });
  await page.locator('[data-site-music]').waitFor({ state: 'visible', timeout: 5_000 });
  assert.match(await page.locator('[data-site-music]').textContent(), /特别的人/);

  const relevantErrors = errors.filter(
    (message) =>
      !/music\.163\.com|ERR_BLOCKED_BY_RESPONSE|frame|Permissions policy violation/i.test(
        message
      )
  );
  assert.deepEqual(relevantErrors, []);
  console.log('SITE_MUSIC_E2E_PASS');
} finally {
  await browser.close();
}
