import assert from 'node:assert/strict';
import test from 'node:test';

import { petsPage } from '../src/views.js';

const base = {
  settings: { couple_names: '我 & 你', site_subtitle: '点滴' },
  bg: { type: 'color', color: '#F7F4EF' },
  copy: {},
};

test('locked pet page contains the shared password form', () => {
  const html = petsPage({ ...base, unlocked: false, pets: [], events: [] });
  assert.match(html, /id="petsUnlockForm"/);
  assert.match(html, /共同的小家/);
  assert.doesNotMatch(html, /data-pet-room/);
});

test('unlocked pet page exposes both pets, actions and events', () => {
  const pets = [
    {
      slug: 'tom',
      display_name: 'TOM',
      satiety: 20,
      cleanliness: 80,
      energy: 80,
      affection: 60,
      current_pose: 'idle',
      growth: { key: 'new', label: '来到身边', sizeScale: 1 },
    },
    {
      slug: 'pipi',
      display_name: '皮皮',
      satiety: 80,
      cleanliness: 25,
      energy: 80,
      affection: 60,
      current_pose: 'idle',
      growth: { key: 'new', label: '来到身边', sizeScale: 1 },
    },
  ];
  const html = petsPage({
    ...base,
    unlocked: true,
    pets,
    events: [
      {
        id: 1,
        pet_slug: 'tom',
        action: 'feed',
        summary: 'TOM 吃饱了',
        created_at: '2026-11-15T00:00:00.000Z',
      },
    ],
  });
  assert.match(html, /data-pet-room/);
  assert.match(html, /TOM/);
  assert.match(html, /皮皮/);
  assert.match(html, /data-pet-action="feed"/);
  assert.match(html, /data-pet-action="teaser"/);
  assert.match(html, /TOM 吃饱了/);
  assert.match(
    html,
    /data-pet-summary="tom"[^>]*>有点饿了 · 亲密 60</
  );
  assert.match(
    html,
    /data-pet-summary="pipi"[^>]*>想洗个澡 · 亲密 60</
  );
});
