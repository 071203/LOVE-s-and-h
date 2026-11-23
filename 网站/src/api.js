import config from './config.js';
import storage from './storage/index.js';
import * as db from './db.js';
import { COPY_DEFAULTS } from './db.js';
import {
  isAdminAuthed,
  isAlbumAuthed,
  setAdminCookie,
  setAlbumCookie,
  clearAuthCookie,
} from './auth.js';
import {
  readBody,
  readJson,
  json,
  randomId,
  extOf,
  isImage,
  isAudio,
  isAudioExt,
  sanitizeColor,
} from './util.js';
import { createPetApiHandler } from './pet-api.js';

/**
 * API 路由层：处理 /api/* 的读写操作。
 * 文件上传采用原始二进制流（非 multipart），前端 fetch 直接以 File 作为 body。
 */

function requireAdmin(req, res) {
  if (!isAdminAuthed(req)) {
    json(res, 401, { ok: false, error: '需要管理员密码' });
    return false;
  }
  return true;
}

function requireAlbum(req, res) {
  if (!isAlbumAuthed(req)) {
    json(res, 401, { ok: false, error: '需要相册密码' });
    return false;
  }
  return true;
}

function makeKey(kind, originalName, mime) {
  let ext = extOf(originalName);
  if (!ext && mime) {
    const m = /\/([a-zA-Z0-9]+)/.exec(mime);
    ext = m ? m[1] : '';
  }
  const safe = ext ? `.${ext.slice(0, 8)}` : '';
  return `${kind}/${randomId(12)}${safe}`;
}

function withUrl(rows) {
  return rows.map((r) => ({
    ...r,
    url: r.storage_key ? storage.url(r.storage_key) : r.external_url || '',
  }));
}

function parseShareUrl(raw) {
  try {
    const url = new URL(String(raw || '').trim());
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('bad protocol');
    return url;
  } catch {
    throw new Error('分享链接格式不正确');
  }
}

async function fetchWithTimeout(url, options = {}, timeout = 4500) {
  return fetch(url, {
    ...options,
    signal: AbortSignal.timeout(timeout),
  });
}

const itunesSearchCache = new Map();
const neteaseSearchCache = new Map();
const handlePetApi = createPetApiHandler({
  store: db.petStore,
  auth: isAlbumAuthed,
});

async function searchNetease(query, limit) {
  const key = `${query}|${limit}`;
  const cached = neteaseSearchCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.data;

  const searchUrl =
    'https://music.163.com/api/search/get/web?' +
    new URLSearchParams({
      s: query,
      type: '1',
      offset: '0',
      total: 'true',
      limit: String(limit),
    });
  const headers = {
    Accept: 'application/json',
    'User-Agent': 'Mozilla/5.0',
    Referer: 'https://music.163.com/',
  };
  const response = await fetchWithTimeout(searchUrl, { headers }, 9000);
  if (!response.ok) throw new Error(`网易云搜索失败：${response.status}`);
  const payload = await response.json();
  const songs = (payload.result && payload.result.songs) || [];
  if (!songs.length) throw new Error('没有找到匹配的网易云歌曲');

  let details = new Map();
  try {
    const ids = songs.map((song) => song.id);
    const detailUrl =
      'https://music.163.com/api/song/detail/?ids=' +
      encodeURIComponent(JSON.stringify(ids));
    const detailResponse = await fetchWithTimeout(detailUrl, { headers }, 9000);
    if (detailResponse.ok) {
      const detailPayload = await detailResponse.json();
      details = new Map((detailPayload.songs || []).map((song) => [song.id, song]));
    }
  } catch {
    /* 封面获取失败时仍返回搜索结果 */
  }

  const data = songs.slice(0, limit).map((song) => {
    const detail = details.get(song.id);
    const artists = (song.artists || (detail && detail.artists) || [])
      .map((artist) => artist.name)
      .filter(Boolean)
      .join(' / ');
    return {
      id: String(song.id),
      title: song.name || (detail && detail.name) || '未命名歌曲',
      artist: artists || '未知歌手',
      artwork:
        (detail && detail.album && detail.album.picUrl) ||
        (song.album && song.album.picUrl) ||
        '',
      duration: Math.round((Number(song.duration) || 0) / 1000),
      genre: '',
      album: (song.album && song.album.name) || (detail && detail.album && detail.album.name) || '',
      externalUrl: `https://music.163.com/song?id=${song.id}`,
      embedUrl: `https://music.163.com/outchain/player?type=2&id=${song.id}&auto=1&height=66`,
      streamUrl: '',
      playMode: 'embed',
      source: 'netease',
    };
  });
  neteaseSearchCache.set(key, { data, expires: Date.now() + 2 * 60 * 1000 });
  return data;
}

async function searchITunes(query, limit) {
  const key = `${query}|${limit}`;
  const cached = itunesSearchCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.data;

  // 同时查询台湾、美国和香港区，兼顾中文与全球曲库。
  const countries = ['TW', 'US', 'HK'];
  const responses = await Promise.allSettled(
    countries.map(async (country) => {
      const url =
        'https://itunes.apple.com/search?' +
        new URLSearchParams({
          term: query,
          media: 'music',
          entity: 'song',
          limit: '10',
          country,
        });
      const response = await fetchWithTimeout(
        url,
        { headers: { Accept: 'application/json', 'User-Agent': 'Hourlight/1.0' } },
        9000
      );
      if (!response.ok) throw new Error(`iTunes ${country} 搜索失败`);
      return response.json();
    })
  );

  const seen = new Set();
  const data = [];
  for (const settled of responses) {
    if (settled.status !== 'fulfilled') continue;
    for (const track of settled.value.results || []) {
      if (!track || !track.trackId || !track.previewUrl || seen.has(track.trackId)) continue;
      seen.add(track.trackId);
      data.push({
        id: String(track.trackId),
        title: track.trackName || '未命名歌曲',
        artist: track.artistName || '未知歌手',
        artwork: String(track.artworkUrl100 || '').replace('100x100bb', '600x600bb'),
        duration: Math.round((Number(track.trackTimeMillis) || 0) / 1000),
        genre: track.primaryGenreName || '',
        collection: track.collectionName || '',
        externalUrl: track.trackViewUrl || '',
        streamUrl: track.previewUrl,
        source: 'itunes',
      });
      if (data.length >= limit) break;
    }
    if (data.length >= limit) break;
  }
  if (!data.length) throw new Error('没有找到可试听的歌曲');

  itunesSearchCache.set(key, { data, expires: Date.now() + 3 * 60 * 1000 });
  return data;
}

async function extractNeteaseId(raw) {
  let url = parseShareUrl(raw);
  if (/163cn\.tv$/i.test(url.hostname)) {
    try {
      const res = await fetchWithTimeout(url.href, {
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      url = new URL(res.url);
    } catch {
      throw new Error('网易云短链接解析失败，请使用 music.163.com/song?id=... 完整链接');
    }
  }
  const id =
    url.searchParams.get('id') ||
    (url.pathname.match(/(?:song|song\/detail)\/(\d+)/) || [])[1];
  if (!id || !/^\d+$/.test(id)) throw new Error('无法识别网易云歌曲 ID');
  return { id, url };
}

function extractQQSongMid(raw) {
  const url = parseShareUrl(raw);
  const mid =
    url.searchParams.get('songmid') ||
    url.searchParams.get('songMid') ||
    (url.pathname.match(/songDetail\/([A-Za-z0-9]+)/) || [])[1] ||
    (url.searchParams.get('songid') || '').replace(/\D/g, '');
  if (!mid) throw new Error('无法识别 QQ 音乐歌曲 ID');
  return { mid, url };
}

async function handleAuth(req, res, pathname, query) {
  if (pathname === '/api/auth/status' && req.method === 'GET') {
    json(res, 200, {
      album: isAlbumAuthed(req),
      admin: isAdminAuthed(req),
    });
    return true;
  }
  if (pathname === '/api/auth/logout' && req.method === 'POST') {
    clearAuthCookie(res, 'ut_album');
    clearAuthCookie(res, 'ut_admin');
    json(res, 200, { ok: true });
    return true;
  }
  if (pathname === '/api/auth/album' && req.method === 'POST') {
    const body = await readJson(req);
    const expect = db.getSetting('album_password');
    if (body.password && body.password === expect) {
      setAlbumCookie(res);
      json(res, 200, { ok: true });
    } else {
      json(res, 401, { ok: false, error: '相册密码不正确' });
    }
    return true;
  }
  if (pathname === '/api/auth/admin' && req.method === 'POST') {
    const body = await readJson(req);
    const expect = db.getSetting('admin_password');
    if (body.password && body.password === expect) {
      setAdminCookie(res);
      json(res, 200, { ok: true });
    } else {
      json(res, 401, { ok: false, error: '管理员密码不正确' });
    }
    return true;
  }
  return false;
}

async function handleCountdowns(req, res, pathname, query) {
  if (pathname === '/api/countdowns' && req.method === 'GET') {
    json(res, 200, { ok: true, data: db.listCountdowns() });
    return true;
  }
  if (pathname === '/api/countdowns' && req.method === 'POST') {
    if (!requireAdmin(req, res)) return true;
    const body = await readJson(req);
    const title = String(body.title || '').trim();
    const target = String(body.target_date || '').trim();
    if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(target)) {
      json(res, 400, { ok: false, error: '请填写标题与正确格式的日期（YYYY-MM-DD）' });
      return true;
    }
    const color = sanitizeColor(body.color) || '#C96F7B';
    const sort = Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0;
    const record = db.insertCountdown({ title, target_date: target, color, sort_order: sort });
    json(res, 201, { ok: true, data: record });
    return true;
  }
  const m = pathname.match(/^\/api\/countdowns\/(\d+)$/);
  if (m) {
    const id = Number(m[1]);
    if (!requireAdmin(req, res)) return true;
    if (req.method === 'PUT') {
      const body = await readJson(req);
      const fields = {};
      if (body.title !== undefined) fields.title = String(body.title).trim();
      if (body.target_date !== undefined) fields.target_date = String(body.target_date).trim();
      if (body.color !== undefined) fields.color = sanitizeColor(body.color) || undefined;
      if (body.sort_order !== undefined) fields.sort_order = Number(body.sort_order);
      const record = db.updateCountdown(id, fields);
      if (!record) return json(res, 404, { ok: false, error: '未找到该倒计时' });
      return json(res, 200, { ok: true, data: record });
    }
    if (req.method === 'DELETE') {
      db.deleteCountdown(id);
      return json(res, 200, { ok: true });
    }
  }
  return false;
}

async function handlePhotos(req, res, pathname, query) {
  if (pathname === '/api/photos' && req.method === 'GET') {
    if (!requireAlbum(req, res)) return true;
    return json(res, 200, { ok: true, data: withUrl(db.listPhotos()) });
  }
  if (pathname === '/api/photos' && req.method === 'POST') {
    if (!requireAdmin(req, res)) return true;
    const contentType = req.headers['content-type'] || '';
    const buffer = await readBody(req, config.maxUploadBytes).catch(() => null);
    if (buffer === null) return json(res, 413, { ok: false, error: '文件超过大小限制' });
    if (!isImage(contentType) && !isImage(extMime(query.filename))) {
      return json(res, 400, { ok: false, error: '仅支持图片文件' });
    }
    const originalName = String(query.filename || 'photo.jpg');
    const baseName = originalName.replace(/\.[^.]+$/, '');
    const key = makeKey('photos', originalName, contentType);
    const url = await storage.put(key, buffer, contentType);
    const record = db.insertPhoto({
      filename: key,
      storage_key: key,
      original_name: originalName,
      mime: contentType || 'image/jpeg',
      size: buffer.length,
      caption: String(query.caption || ''),
      alt: String(query.alt || query.caption || baseName),
    });
    return json(res, 201, { ok: true, data: { ...record, url } });
  }
  const m = pathname.match(/^\/api\/photos\/(\d+)$/);
  if (m) {
    const id = Number(m[1]);
    if (!requireAdmin(req, res)) return true;
    if (req.method === 'PUT') {
      const body = await readJson(req);
      const record = db.updatePhoto(id, { caption: body.caption, alt: body.alt });
      if (!record) return json(res, 404, { ok: false, error: '未找到该照片' });
      return json(res, 200, { ok: true, data: { ...record, url: storage.url(record.storage_key) } });
    }
    if (req.method === 'DELETE') {
      const record = db.deletePhoto(id);
      if (!record) return json(res, 404, { ok: false, error: '未找到该照片' });
      await storage.remove(record.storage_key).catch(() => {});
      return json(res, 200, { ok: true });
    }
  }
  return false;
}

async function handleTracks(req, res, pathname, query) {
  if (pathname === '/api/tracks' && req.method === 'GET') {
    return json(res, 200, { ok: true, data: withUrl(db.listTracks()) });
  }
  if (pathname === '/api/tracks/import' && req.method === 'POST') {
    if (!requireAdmin(req, res)) return true;
    const body = await readJson(req);
    const source = String(body.source || '');
    const shareUrl = String(body.url || '').trim();
    let title = String(body.title || '').trim();
    let artist = String(body.artist || '').trim();
    let externalId = '';
    let externalUrl = '';
    let embedUrl = '';

    if (source === 'netease') {
      const { id } = await extractNeteaseId(shareUrl);
      externalId = id;
      externalUrl = `https://music.163.com/song?id=${id}`;
      embedUrl = `https://music.163.com/outchain/player?type=2&id=${id}&auto=1&height=66`;
      if (!title || !artist) {
        try {
          const response = await fetchWithTimeout(
            `https://music.163.com/api/song/detail/?id=${id}&ids=%5B${id}%5D`,
            {
              headers: {
                'User-Agent': 'Mozilla/5.0',
                Referer: 'https://music.163.com/',
              },
            }
          );
          const payload = await response.json();
          const song = payload && payload.songs && payload.songs[0];
          if (song) {
            title = title || song.name || '';
            artist =
              artist ||
              (song.artists || song.ar || []).map((a) => a.name).filter(Boolean).join(' / ');
          }
        } catch {
          /* 外网不可用时允许用户手填歌名和歌手 */
        }
      }
      title = title || `网易云音乐 ${id}`;
      artist = artist || '网易云音乐';
    } else if (source === 'qq') {
      const { mid } = extractQQSongMid(shareUrl);
      externalId = mid;
      externalUrl = `https://y.qq.com/n/ryqq/songDetail/${encodeURIComponent(mid)}`;
      title = title || `QQ音乐 ${mid}`;
      artist = artist || 'QQ音乐';
    } else if (source === 'itunes') {
      const trackId = String(body.id || '').trim();
      if (!/^\d+$/.test(trackId)) {
        return json(res, 400, { ok: false, error: 'iTunes 歌曲 ID 不正确' });
      }
      let preview;
      let trackPage;
      try {
        preview = new URL(String(body.previewUrl || ''));
        trackPage = new URL(String(body.externalUrl || ''));
      } catch {
        return json(res, 400, { ok: false, error: 'iTunes 试听地址不正确' });
      }
      if (
        preview.protocol !== 'https:' ||
        !/(^|\.)apple\.com$/i.test(preview.hostname) ||
        !/(^|\.)apple\.com$/i.test(trackPage.hostname)
      ) {
        return json(res, 400, { ok: false, error: '仅允许保存 Apple 官方音乐地址' });
      }
      externalId = trackId;
      externalUrl = trackPage.href;
      embedUrl = preview.href;
      title = title || `iTunes ${trackId}`;
      artist = artist || '未知歌手';
    } else if (source === 'audius') {
      const trackId = String(body.id || '').trim();
      if (!/^[A-Za-z0-9]+$/.test(trackId)) {
        return json(res, 400, { ok: false, error: 'Audius 歌曲 ID 不正确' });
      }
      externalId = trackId;
      const permalink = String(body.permalink || '');
      externalUrl = /^\/[A-Za-z0-9/_-]+$/.test(permalink)
        ? `https://audius.co${permalink}`
        : `https://audius.co/tracks/${encodeURIComponent(trackId)}`;
      embedUrl = `https://api.audius.co/v1/tracks/${encodeURIComponent(
        trackId
      )}/stream?app_name=Hourlight`;
      title = title || String(body.fallbackTitle || '').trim() || `Audius ${trackId}`;
      artist = artist || String(body.fallbackArtist || '').trim() || 'Audius';
    } else {
      return json(res, 400, { ok: false, error: '不支持的导入来源' });
    }

    const record = db.insertTrack({
      filename: '',
      storage_key: '',
      original_name: '',
      mime: '',
      size: 0,
      title,
      artist,
      source,
      external_id: externalId,
      external_url: externalUrl,
      embed_url: embedUrl,
    });
    return json(res, 201, {
      ok: true,
      data: { ...record, url: externalUrl },
    });
  }
  if (pathname === '/api/tracks' && req.method === 'POST') {
    if (!requireAdmin(req, res)) return true;
    const contentType = req.headers['content-type'] || '';
    const buffer = await readBody(req, config.maxUploadBytes).catch(() => null);
    if (buffer === null) return json(res, 413, { ok: false, error: '文件超过大小限制' });
    const ext = extOf(query.filename || '');
    if (!isAudio(contentType) && !isAudioExt(ext)) {
      return json(res, 400, { ok: false, error: '仅支持音频文件' });
    }
    const originalName = String(query.filename || 'track.mp3');
    const key = makeKey('tracks', originalName, contentType);
    const url = await storage.put(key, buffer, contentType);
    const record = db.insertTrack({
      filename: key,
      storage_key: key,
      original_name: originalName,
      mime: contentType || 'audio/mpeg',
      size: buffer.length,
      title: String(query.title || originalName.replace(/\.[^.]+$/, '')),
      artist: String(query.artist || ''),
      source: 'local',
    });
    return json(res, 201, { ok: true, data: { ...record, url } });
  }
  const m = pathname.match(/^\/api\/tracks\/(\d+)$/);
  if (m) {
    const id = Number(m[1]);
    if (!requireAdmin(req, res)) return true;
    if (req.method === 'PUT') {
      const body = await readJson(req);
      const record = db.updateTrack(id, { title: body.title, artist: body.artist });
      if (!record) return json(res, 404, { ok: false, error: '未找到该音乐' });
      return json(res, 200, {
        ok: true,
        data: {
          ...record,
          url: record.storage_key ? storage.url(record.storage_key) : record.external_url || '',
        },
      });
    }
    if (req.method === 'DELETE') {
      const record = db.deleteTrack(id);
      if (!record) return json(res, 404, { ok: false, error: '未找到该音乐' });
      if (record.storage_key) await storage.remove(record.storage_key).catch(() => {});
      return json(res, 200, { ok: true });
    }
  }
  return false;
}

async function handleMusicSearch(req, res, pathname, query) {
  if (pathname !== '/api/music/search' || req.method !== 'GET') return false;
  const q = String(query.q || '').trim().slice(0, 80);
  const limit = Math.min(20, Math.max(1, Number(query.limit) || 12));
  const source = query.source === 'itunes' ? 'itunes' : 'netease';
  if (q.length < 2) {
    json(res, 400, { ok: false, error: '请输入至少 2 个字符' });
    return true;
  }
  try {
    const data = source === 'itunes' ? await searchITunes(q, limit) : await searchNetease(q, limit);
    json(res, 200, { ok: true, data, source });
  } catch (err) {
    json(res, 502, { ok: false, error: err.message || '在线音乐搜索暂不可用' });
  }
  return true;
}

async function handleBackgrounds(req, res, pathname, query) {
  const listMatch = pathname === '/api/backgrounds' && req.method === 'GET';
  if (listMatch) {
    if (!requireAdmin(req, res)) return true;
    const all = db.listBackgrounds();
    for (const page of Object.keys(all)) {
      if (all[page].type === 'image' && all[page].storage_key) {
        all[page].url = storage.url(all[page].storage_key);
      }
    }
    return json(res, 200, { ok: true, data: all });
  }
  const m = pathname.match(/^\/api\/backgrounds\/([a-z]+)$/);
  if (m && req.method === 'POST') {
    if (!requireAdmin(req, res)) return true;
    const page = m[1];
    if (!['home', 'album', 'timeline', 'music', 'admin'].includes(page)) {
      return json(res, 400, { ok: false, error: '未知页面' });
    }
    const contentType = req.headers['content-type'] || '';
    if (contentType.startsWith('image/')) {
      const buffer = await readBody(req, config.maxUploadBytes).catch(() => null);
      if (buffer === null) return json(res, 413, { ok: false, error: '文件超过大小限制' });
      const key = makeKey('backgrounds', query.filename || 'bg.jpg', contentType);
      const url = await storage.put(key, buffer, contentType);
      const record = db.setBackground(page, {
        type: 'image',
        storage_key: key,
        filename: key,
        color: '',
      });
      return json(res, 200, { ok: true, data: { ...record, url } });
    }
    const body = await readJson(req);
    if (body.type === 'color') {
      const color = sanitizeColor(body.color) || '#F7F4EF';
      const record = db.setBackground(page, { type: 'color', color, storage_key: '', filename: '' });
      return json(res, 200, { ok: true, data: record });
    }
    return json(res, 400, { ok: false, error: '参数错误' });
  }
  return false;
}

function timelineWithPhotos() {
  const photos = withUrl(db.listTimelinePhotos());
  return db.listTimelineEvents().map((event) => ({
    ...event,
    photos: photos.filter((p) => p.event_id === event.id),
  }));
}

async function handleTimeline(req, res, pathname, query) {
  if (pathname === '/api/timeline' && req.method === 'GET') {
    if (!requireAlbum(req, res)) return true;
    return json(res, 200, { ok: true, data: timelineWithPhotos() });
  }

  if (pathname === '/api/timeline' && req.method === 'POST') {
    if (!requireAdmin(req, res)) return true;
    const body = await readJson(req);
    const eventDate = String(body.event_date || '').trim();
    const title = String(body.title || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || !title) {
      return json(res, 400, { ok: false, error: '请填写事件标题与正确日期' });
    }
    const event = db.insertTimelineEvent({
      event_date: eventDate,
      title,
      description: String(body.description || '').trim(),
    });
    return json(res, 201, { ok: true, data: { ...event, photos: [] } });
  }

  const photoDelete = pathname.match(/^\/api\/timeline\/photos\/(\d+)$/);
  if (photoDelete && req.method === 'DELETE') {
    if (!requireAdmin(req, res)) return true;
    const record = db.deleteTimelinePhoto(Number(photoDelete[1]));
    if (!record) return json(res, 404, { ok: false, error: '未找到该照片' });
    await storage.remove(record.storage_key).catch(() => {});
    return json(res, 200, { ok: true });
  }

  const photoUpload = pathname.match(/^\/api\/timeline\/(\d+)\/photos$/);
  if (photoUpload && req.method === 'POST') {
    if (!requireAdmin(req, res)) return true;
    const eventId = Number(photoUpload[1]);
    const event = db.getTimelineEvent(eventId);
    if (!event) return json(res, 404, { ok: false, error: '未找到该事件' });
    const contentType = req.headers['content-type'] || '';
    if (!isImage(contentType) && !isImage(extMime(query.filename))) {
      return json(res, 400, { ok: false, error: '仅支持图片文件' });
    }
    const buffer = await readBody(req, config.maxUploadBytes).catch(() => null);
    if (buffer === null) return json(res, 413, { ok: false, error: '文件超过大小限制' });
    const originalName = String(query.filename || 'timeline.jpg');
    const baseName = originalName.replace(/\.[^.]+$/, '');
    const key = makeKey('timeline', originalName, contentType);
    const url = await storage.put(key, buffer, contentType);
    const record = db.insertTimelinePhoto({
      event_id: eventId,
      filename: key,
      storage_key: key,
      original_name: originalName,
      mime: contentType || 'image/jpeg',
      size: buffer.length,
      alt: String(query.alt || baseName),
    });
    return json(res, 201, { ok: true, data: { ...record, url } });
  }

  const eventMatch = pathname.match(/^\/api\/timeline\/(\d+)$/);
  if (eventMatch) {
    const id = Number(eventMatch[1]);
    if (!requireAdmin(req, res)) return true;
    if (req.method === 'PUT') {
      const body = await readJson(req);
      const record = db.updateTimelineEvent(id, {
        event_date: body.event_date,
        title: body.title,
        description: body.description,
      });
      if (!record) return json(res, 404, { ok: false, error: '未找到该事件' });
      return json(res, 200, { ok: true, data: record });
    }
    if (req.method === 'DELETE') {
      const photos = db.listTimelinePhotos(id);
      const record = db.deleteTimelineEvent(id);
      if (!record) return json(res, 404, { ok: false, error: '未找到该事件' });
      await Promise.all(photos.map((p) => storage.remove(p.storage_key).catch(() => {})));
      return json(res, 200, { ok: true });
    }
  }
  return false;
}

async function handleSettings(req, res, pathname, query) {
  if (pathname === '/api/settings' && req.method === 'GET') {
    if (!requireAdmin(req, res)) return true;
    return json(res, 200, { ok: true, data: db.allSettings() });
  }
  if (pathname === '/api/settings' && req.method === 'PUT') {
    if (!requireAdmin(req, res)) return true;
    const body = await readJson(req);
    const keys = [
      'site_title',
      'site_subtitle',
      'couple_names',
      'anniversary_date',
      'album_password',
      'admin_password',
    ];
    for (const key of keys) {
      if (body[key] !== undefined && String(body[key]).trim() !== '') {
        db.setSetting(key, String(body[key]).trim());
      }
    }
    return json(res, 200, { ok: true, data: db.allSettings() });
  }
  return false;
}

async function handleCopy(req, res, pathname, query) {
  if (pathname === '/api/copy' && req.method === 'GET') {
    if (!requireAdmin(req, res)) return true;
    return json(res, 200, { ok: true, data: db.copyMap(), defaults: COPY_DEFAULTS });
  }
  if (pathname === '/api/copy' && req.method === 'PUT') {
    if (!requireAdmin(req, res)) return true;
    const body = await readJson(req);
    const allowed = new Set(Object.keys(COPY_DEFAULTS));
    for (const [key, value] of Object.entries(body || {})) {
      if (allowed.has(key)) db.setSetting(key, String(value ?? ''));
    }
    return json(res, 200, { ok: true, data: db.copyMap() });
  }
  return false;
}

function extMime(filename) {
  const ext = extOf(filename || '');
  const map = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    avif: 'image/avif',
    bmp: 'image/bmp',
    svg: 'image/svg+xml',
  };
  return map[ext] || '';
}

export async function handleApi(req, res, pathname, query) {
  try {
    if (await handleAuth(req, res, pathname, query)) return;
    if (await handlePetApi(req, res, pathname, query)) return;
    if (await handleCountdowns(req, res, pathname, query)) return;
    if (await handlePhotos(req, res, pathname, query)) return;
    if (await handleTracks(req, res, pathname, query)) return;
    if (await handleMusicSearch(req, res, pathname, query)) return;
    if (await handleBackgrounds(req, res, pathname, query)) return;
    if (await handleTimeline(req, res, pathname, query)) return;
    if (await handleSettings(req, res, pathname, query)) return;
    if (await handleCopy(req, res, pathname, query)) return;
    json(res, 404, { ok: false, error: '接口不存在' });
  } catch (err) {
    if (err && err.message === 'BODY_TOO_LARGE') {
      if (!res.headersSent) json(res, 413, { ok: false, error: '文件超过大小限制' });
    } else {
      if (!res.headersSent) json(res, 400, { ok: false, error: err.message || '请求处理失败' });
      else res.end();
    }
  }
}

