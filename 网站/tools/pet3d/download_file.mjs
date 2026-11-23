import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

const [url, output, concurrencyArg] = process.argv.slice(2);
if (!url || !output) {
  console.error('Usage: node tools/pet3d/download_file.mjs URL OUTPUT [CONCURRENCY]');
  process.exit(2);
}

const concurrency = Math.max(1, Math.min(32, Number(concurrencyArg) || 6));
const head = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(30_000) });
if (!head.ok) throw new Error(`HEAD failed: HTTP ${head.status}`);

const total = Number(head.headers.get('content-length') || 0);
if (!total) throw new Error('Server did not return content-length');
if (head.headers.get('accept-ranges') !== 'bytes') {
  throw new Error('Server does not support range requests');
}

const chunkSize = 16 * 1024 * 1024;
const chunkCount = Math.ceil(total / chunkSize);
const partPath = `${output}.part`;
await fs.mkdir(path.dirname(output), { recursive: true });

let existing = false;
try {
  const stat = await fs.stat(partPath);
  existing = stat.size === total;
} catch {
  existing = false;
}

const file = await fs.open(partPath, existing ? 'r+' : 'w');
if (!existing) await file.truncate(total);

async function chunkHasData(index) {
  if (!existing) return false;
  const start = index * chunkSize;
  const sampleSize = Math.min(32, total - start);
  const sample = Buffer.alloc(sampleSize);
  await file.read(sample, 0, sample.length, start);
  return sample.some((value) => value !== 0);
}

const pendingChunks = [];
for (let index = 0; index < chunkCount; index += 1) {
  if (!(await chunkHasData(index))) pendingChunks.push(index);
}

let nextChunk = 0;
let downloaded = 0;
let lastReported = performance.now();
let lastBytes = 0;

async function downloadChunk(index) {
  const start = index * chunkSize;
  const end = Math.min(total - 1, start + chunkSize - 1);

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Range: `bytes=${start}-${end}` },
        signal: AbortSignal.timeout(180_000),
      });
      if (response.status !== 206) {
        throw new Error(`Range request returned HTTP ${response.status}`);
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length !== end - start + 1) {
        throw new Error(`Short range: expected ${end - start + 1}, got ${bytes.length}`);
      }
      await file.write(bytes, 0, bytes.length, start);
      downloaded += bytes.length;
      return;
    } catch (error) {
      if (attempt === 5) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
}

async function worker() {
  while (true) {
    const index = pendingChunks[nextChunk];
    nextChunk += 1;
    if (index === undefined) return;
    await downloadChunk(index);
  }
}

const reporter = setInterval(() => {
  const now = performance.now();
  const mb = downloaded / 1024 / 1024;
  const speed = ((downloaded - lastBytes) / 1024 / 1024) / ((now - lastReported) / 1000);
  const percent = ((downloaded / total) * 100).toFixed(1);
  console.log(`${percent}% ${mb.toFixed(1)}/${(total / 1024 / 1024).toFixed(1)} MB ${speed.toFixed(2)} MB/s`);
  lastReported = now;
  lastBytes = downloaded;
}, 3000);

try {
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  clearInterval(reporter);
  await file.close();
  await fs.rename(partPath, output);
  console.log(`DOWNLOADED ${output} ${total} bytes`);
} catch (error) {
  clearInterval(reporter);
  await file.close();
  throw error;
}
