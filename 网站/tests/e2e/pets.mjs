import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'file:///C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const baseUrl = process.env.PETS_BASE_URL || 'http://127.0.0.1:3010';
const outputDir = path.resolve(process.env.PETS_OUTPUT_DIR || 'work/pet3d/output');
const petsPassword = process.env.PETS_PASSWORD || 'love2024';
fs.mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
const modelResponses = [];
page.on('console', (message) => {
  const text = message.text();
  if (
    message.type() === 'error' &&
    !text.includes('favicon') &&
    !/music\.163\.com|Permissions policy violation|Blocked a frame/i.test(text)
  ) {
    errors.push(text);
  }
});
page.on('pageerror', (error) => {
  const text = error.stack || error.message;
  if (!/music\.163\.com|Blocked a frame/i.test(text)) errors.push(text);
});
page.on('response', (response) => {
  if (/\/pets\/models\/.+\.glb/.test(response.url())) {
    modelResponses.push({ url: response.url(), status: response.status() });
  }
});

try {
  await page.goto(`${baseUrl}/pets`, { waitUntil: 'networkidle' });
  await page.locator('#petsPassword').waitFor({ state: 'visible' });
  await page.fill('#petsPassword', petsPassword);
  await page.locator('#petsUnlockForm button[type="submit"]').click();
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(
    () => document.querySelector('[data-pet-room]')?.dataset.petReady === 'true',
    null,
    { timeout: 45_000 }
  );

  assert.equal(await page.locator('[data-pet-name]').textContent(), 'TOM');
  assert.equal(await page.locator('[data-pet-select="tom"]').getAttribute('aria-selected'), 'true');
  assert.equal(modelResponses.filter((entry) => entry.status === 200).length, 2);
  assert.equal(
    await page.locator('[data-pet-room]').getAttribute('data-fur-material'),
    'textured'
  );
  assert.equal(
    await page.locator('[data-pet-room]').getAttribute('data-facial-shadow'),
    'disabled'
  );
  assert.equal(
    await page.locator('[data-pet-room]').getAttribute('data-room-features'),
    'sofa,bathtub,tree,bed,bowls,basket'
  );
  assert.equal(
    await page.locator('[data-pet-loading]').evaluate((node) => getComputedStyle(node).display),
    'none'
  );
  assert.ok((await page.locator('#petCanvas').boundingBox())?.height > 300);

  const viewToggle = page.locator('[data-pet-view-toggle]');
  assert.equal(await viewToggle.count(), 1);
  assert.equal(await viewToggle.getAttribute('aria-pressed'), 'false');
  await viewToggle.click();
  await page.waitForFunction(
    () => document.querySelector('[data-pet-room]')?.dataset.cameraMode === 'focus',
    null,
    { timeout: 3_000 }
  );
  assert.equal(await viewToggle.getAttribute('aria-pressed'), 'true');
  await page.waitForTimeout(850);
  await page
    .locator('[data-pet-stage]')
    .screenshot({ path: path.join(outputDir, 'pets-focus.png') });
  await viewToggle.click();
  await page.waitForFunction(
    () => document.querySelector('[data-pet-room]')?.dataset.cameraMode === 'room',
    null,
    { timeout: 3_000 }
  );
  assert.equal(await viewToggle.getAttribute('aria-pressed'), 'false');

  await page.waitForTimeout(850);
  await page.screenshot({ path: path.join(outputDir, 'pets-desktop.png'), fullPage: false });

  await page.locator('[data-pet-select="tom"]').click();
  await page.waitForFunction(
    () => document.querySelector('[data-pet-room]')?.dataset.lastAction === 'affection',
    null,
    { timeout: 3_000 }
  );

  await page.locator('[data-pet-action="feed"]').click();
  await page.waitForFunction(
    () => document.querySelector('[data-pet-events]')?.textContent.includes('吃得心满意足'),
    null,
    { timeout: 10_000 }
  );
  await page.screenshot({ path: path.join(outputDir, 'pets-action-feed.png'), fullPage: false });

  await page.locator('[data-pet-select="pipi"]').click();
  assert.equal(await page.locator('[data-pet-action="teaser"]').isHidden(), true);
  assert.equal(await page.locator('[data-pet-name]').textContent(), '皮皮');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(350);
  const mobile = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    inner: window.innerWidth,
    roomTop: document.querySelector('[data-pet-room]')?.getBoundingClientRect().top,
  }));
  assert.ok(mobile.width <= mobile.inner + 1, `horizontal overflow: ${mobile.width} > ${mobile.inner}`);
  await page.locator('[data-pet-room]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1_000);
  await page.screenshot({ path: path.join(outputDir, 'pets-mobile.png'), fullPage: false });

  await viewToggle.click();
  await page.waitForFunction(
    () => document.querySelector('[data-pet-room]')?.dataset.cameraMode === 'focus',
    null,
    { timeout: 3_000 }
  );
  await page.waitForTimeout(850);
  const focusedMobile = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    inner: window.innerWidth,
  }));
  assert.ok(
    focusedMobile.width <= focusedMobile.inner + 1,
    `focused mobile horizontal overflow: ${focusedMobile.width} > ${focusedMobile.inner}`
  );
  await page
    .locator('[data-pet-stage]')
    .screenshot({ path: path.join(outputDir, 'pets-mobile-focus.png') });

  assert.deepEqual(errors, []);
  console.log('PETS_E2E_PASS');
} catch (error) {
  console.error('PETS_E2E_ERROR', error.stack || error.message);
  console.error('PETS_E2E_CONSOLE', JSON.stringify(errors, null, 2));
  console.error('PETS_E2E_MODELS', JSON.stringify(modelResponses, null, 2));
  await page.screenshot({
    path: path.join(outputDir, 'pets-e2e-failure.png'),
    fullPage: false,
  });
  throw error;
} finally {
  await browser.close();
}
