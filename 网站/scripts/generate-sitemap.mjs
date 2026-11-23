import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import config, { ROOT_DIR } from '../src/config.js';

const base = String(process.env.SITE_URL || config.siteUrl || '').replace(/\/+$/, '');
if (!/^https:\/\/[^/]+/i.test(base)) {
  console.error('SITE_URL must be a public HTTPS origin, for example https://love.example.com');
  process.exit(1);
}

const pages = ['/', '/music', '/album'];
const today = new Date().toISOString().slice(0, 10);
const entries = pages
  .map(
    (page) => `  <url>
    <loc>${new URL(page, `${base}/`).href}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page === '/' ? 'daily' : 'weekly'}</changefreq>
    <priority>${page === '/' ? '1.0' : page === '/music' ? '0.8' : '0.7'}</priority>
  </url>`
  )
  .join('\n');
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;

const destination = path.join(ROOT_DIR, 'sitemap.xml');
fs.writeFileSync(destination, sitemap, 'utf8');
console.log(`SITEMAP_WRITTEN ${destination}`);
console.log(`SITEMAP_URL ${base}/sitemap.xml`);
