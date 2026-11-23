import assert from 'node:assert/strict';
import test from 'node:test';

import {
  musicEmbedUrl,
  selectBackgroundMusic,
} from '../public/js/site-music.js';


test('selects 方大同 特别的人 as the site background track', () => {
  const tracks = [
    { id: 1, title: '其他歌曲', artist: '其他歌手', source: 'local', url: '/other.mp3' },
    {
      id: 9,
      title: '特别的人',
      artist: '方大同',
      source: 'netease',
      embed_url: 'https://music.163.com/outchain/player?type=2&id=28403111&auto=0&height=66',
    },
  ];

  assert.equal(selectBackgroundMusic(tracks)?.id, 9);
});


test('keeps NetEase background player autoplay enabled', () => {
  const url = musicEmbedUrl({
    source: 'netease',
    id: 9,
    embed_url: 'https://music.163.com/outchain/player?type=2&id=28403111&auto=0&height=66',
  });
  const parsed = new URL(url);

  assert.equal(parsed.hostname, 'music.163.com');
  assert.equal(parsed.searchParams.get('id'), '28403111');
  assert.equal(parsed.searchParams.get('auto'), '1');
});


test('uses a local audio URL before falling back to an embed', () => {
  const track = {
    source: 'local',
    url: '/uploads/tracks/te-bie-de-ren.mp3',
    embed_url: 'https://example.com/embed',
  };

  assert.equal(musicEmbedUrl(track), '/uploads/tracks/te-bie-de-ren.mp3');
});
