import assert from 'node:assert/strict';
import test from 'node:test';

import { homePage } from '../src/views.js';


test('home page includes complete crawling and social preview metadata', () => {
  const html = homePage({
    settings: {
      site_title: '我们的小时光',
      site_subtitle: '一起记录每一天',
      couple_names: 'TOM & PIPI',
      anniversary_date: '2025-01-01',
    },
    countdowns: [],
    bg: { type: 'color', color: '#F7F4EF' },
  });

  assert.match(html, /<title>/);
  assert.match(html, /<meta name="description"/);
  assert.match(html, /<meta name="keywords"/);
  assert.match(html, /<meta property="og:image" content="http:\/\/localhost:3000\/og-cover\.png">/);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
  assert.match(html, /<meta name="twitter:title"/);
  assert.match(html, /<meta name="twitter:description"/);
  assert.match(html, /<meta name="twitter:image"/);
  assert.match(html, /"@type":"WebSite"/);
});
