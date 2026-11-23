import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import config from './config.js';
import { nowIso } from './util.js';
import { createPetStore } from './pet-store.js';

/**
 * 数据层：基于 Node 内置 SQLite（node:sqlite）。
 * 数据库文件保存在 data/site.db，重启不会丢失任何数据。
 */

fs.mkdirSync(config.dataDir, { recursive: true });
const DB_PATH = path.join(config.dataDir, 'site.db');

const db = new DatabaseSync(DB_PATH);

// 开启 WAL 模式，提升并发读写稳定性。
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
export const petStore = createPetStore(db);

// ---------------- 建表 ----------------
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS countdowns (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    target_date TEXT NOT NULL,
    color       TEXT NOT NULL DEFAULT '#C96F7B',
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS photos (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    filename      TEXT NOT NULL,
    storage_key   TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime          TEXT NOT NULL,
    size          INTEGER NOT NULL DEFAULT 0,
    caption       TEXT NOT NULL DEFAULT '',
    alt           TEXT NOT NULL DEFAULT '',
    sort_order    INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tracks (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    filename      TEXT NOT NULL,
    storage_key   TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime          TEXT NOT NULL,
    size          INTEGER NOT NULL DEFAULT 0,
    title         TEXT NOT NULL DEFAULT '',
    artist        TEXT NOT NULL DEFAULT '',
    sort_order    INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS backgrounds (
    page        TEXT PRIMARY KEY,
    type        TEXT NOT NULL DEFAULT 'color',
    color       TEXT NOT NULL DEFAULT '',
    storage_key TEXT NOT NULL DEFAULT '',
    filename    TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS timeline_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    event_date  TEXT NOT NULL,
    title       TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS timeline_photos (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id      INTEGER NOT NULL,
    filename      TEXT NOT NULL,
    storage_key   TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime          TEXT NOT NULL,
    size          INTEGER NOT NULL DEFAULT 0,
    alt           TEXT NOT NULL DEFAULT '',
    sort_order    INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL,
    FOREIGN KEY (event_id) REFERENCES timeline_events(id) ON DELETE CASCADE
  );
`);

// 兼容旧数据库：补充外部音乐来源字段。
const trackColumns = new Set(
  db.prepare('PRAGMA table_info(tracks)').all().map((col) => col.name)
);
for (const [name, ddl] of [
  ['source', "TEXT NOT NULL DEFAULT 'local'"],
  ['external_id', "TEXT NOT NULL DEFAULT ''"],
  ['external_url', "TEXT NOT NULL DEFAULT ''"],
  ['embed_url', "TEXT NOT NULL DEFAULT ''"],
]) {
  if (!trackColumns.has(name)) {
    db.exec(`ALTER TABLE tracks ADD COLUMN ${name} ${ddl}`);
  }
}

// ---------------- 默认值 ----------------
const DEFAULT_SETTINGS = {
  site_title: '我们的小时光',
  site_subtitle: '把在一起的每一天，都好好收藏。',
  couple_names: '我 & 你',
  anniversary_date: '2019-05-20',
  album_password: 'love2024',
  admin_password: '5201314',
};

// 每个界面可编辑的文案（存储为 settings 中以 copy. 开头的键）。
export const COPY_DEFAULTS = {
  'copy.home.hero_eyebrow': 'OUR LITTLE DAYS',
  'copy.home.days_label': '已经在一起 · 天',
  'copy.home.section_title': '倒计时',
  'copy.home.section_note': '把期待的日子，一天天数给你看',
  'copy.home.empty': '还没有倒计时，去「管理」添加一个吧。',

  'copy.album.lock_title': '私藏相册',
  'copy.album.lock_desc': '这里收藏着只属于我们的照片，请输入相册密码查看。',
  'copy.album.eyebrow': 'SHARED ALBUM',
  'copy.album.title': '我们的相册',
  'copy.album.sub': '每一帧，都是两个人共同的回忆。',
  'copy.album.empty': '相册还是空的，上传第一张照片吧。',
  'copy.album.upload': '上传照片',
  'copy.album.unlock_btn': '解锁相册',

  'copy.music.eyebrow': 'OUR PLAYLIST',
  'copy.music.title': '我们的歌',
  'copy.music.sub': '那些一听，就想起你的旋律。',
  'copy.music.empty': '还没有音乐，去「管理」导入一首吧。',

  'copy.timeline.eyebrow': 'OUR FOOTPRINTS',
  'copy.timeline.title': '我们的时间线',
  'copy.timeline.sub': '把一起走过的日子，按时间慢慢展开。',
  'copy.timeline.lock_title': '私藏时间线',
  'copy.timeline.lock_desc': '这里记录着我们一起经历的事，请输入相册密码查看。',
  'copy.timeline.empty': '还没有时间线记录，去「管理」添加第一段回忆吧。',
  'copy.timeline.empty_day': '这一天还没有照片',

  'copy.admin.eyebrow': 'CONTROL ROOM',
  'copy.admin.title': '管理后台',
  'copy.admin.sub': '管理倒计时、照片、音乐、背景与站点设置。',
  'copy.admin.lock_desc': '请输入管理员密码，管理倒计时、照片、音乐与站点设置。',
  'copy.admin.unlock_btn': '进入后台',
};

function nextAnniversary(dateStr) {
  // 根据在一起的第一天，计算下一个「纪念日」的日期（每年同月同日）。
  const base = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(base.getTime())) return dateStr;
  const now = new Date();
  let candidate = new Date(now.getFullYear(), base.getMonth(), base.getDate());
  if (candidate < now) {
    candidate = new Date(now.getFullYear() + 1, base.getMonth(), base.getDate());
  }
  const pad = (n) => String(n).padStart(2, '0');
  return `${candidate.getFullYear()}-${pad(candidate.getMonth() + 1)}-${pad(candidate.getDate())}`;
}

function seedDefaults() {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    const row = getSetting(key);
    if (row === null) setSetting(key, value);
  }
  for (const [key, value] of Object.entries(COPY_DEFAULTS)) {
    if (getSetting(key) === null) setSetting(key, value);
  }
  const count = Number(db.prepare('SELECT COUNT(*) AS c FROM countdowns').get().c);
  if (count === 0) {
    insertCountdown({
      title: '下一个纪念日',
      target_date: nextAnniversary(getSetting('anniversary_date')),
      color: '#C96F7B',
      sort_order: 0,
    });
  }
  // 预置四个页面的背景（默认纯色）。
  for (const page of ['home', 'album', 'timeline', 'music', 'pets', 'admin']) {
    const bg = db.prepare('SELECT page FROM backgrounds WHERE page = ?').get(page);
    if (!bg) {
      db.prepare(
        'INSERT INTO backgrounds (page, type, color) VALUES (?, ?, ?)'
      ).run(page, 'color', defaultBgColor(page));
    }
  }
}

// 读取全部可编辑文案。
export function copyMap() {
  const rows = db
    .prepare("SELECT key, value FROM settings WHERE key LIKE 'copy.%'")
    .all();
  const out = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

function defaultBgColor(page) {
  const map = {
    home: '#F7F4EF',
    album: '#F6F1EC',
    timeline: '#F5F0EA',
    music: '#F1F5F4',
    pets: '#F3EEE7',
    admin: '#F6F5F1',
  };
  return map[page] || '#F7F4EF';
}

// ---------------- 通用方法 ----------------
export function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

export function setSetting(key, value) {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, String(value ?? ''));
}

export function allSettings() {
  const rows = db.prepare('SELECT key, value FROM settings ORDER BY key').all();
  const out = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}

// ---------------- 倒计时 ----------------
export function listCountdowns() {
  return db
    .prepare('SELECT * FROM countdowns ORDER BY sort_order ASC, id ASC')
    .all();
}

export function insertCountdown({ title, target_date, color = '#C96F7B', sort_order = 0 }) {
  const info = db
    .prepare(
      'INSERT INTO countdowns (title, target_date, color, sort_order, created_at) VALUES (?, ?, ?, ?, ?)'
    )
    .run(title, target_date, color, sort_order, nowIso());
  return getCountdown(Number(info.lastInsertRowid));
}

export function getCountdown(id) {
  return db.prepare('SELECT * FROM countdowns WHERE id = ?').get(id) || null;
}

export function updateCountdown(id, fields) {
  const row = getCountdown(id);
  if (!row) return null;
  const title = fields.title ?? row.title;
  const target_date = fields.target_date ?? row.target_date;
  const color = fields.color ?? row.color;
  const sort_order = fields.sort_order ?? row.sort_order;
  db.prepare(
    'UPDATE countdowns SET title = ?, target_date = ?, color = ?, sort_order = ? WHERE id = ?'
  ).run(title, target_date, color, sort_order, id);
  return getCountdown(id);
}

export function deleteCountdown(id) {
  db.prepare('DELETE FROM countdowns WHERE id = ?').run(id);
}

// ---------------- 相册 ----------------
export function listPhotos() {
  return db.prepare('SELECT * FROM photos ORDER BY sort_order ASC, id DESC').all();
}

export function insertPhoto(record) {
  const info = db
    .prepare(
      `INSERT INTO photos
        (filename, storage_key, original_name, mime, size, caption, alt, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      record.filename,
      record.storage_key,
      record.original_name,
      record.mime,
      record.size,
      record.caption || '',
      record.alt || record.caption || '',
      record.sort_order || 0,
      nowIso()
    );
  return getPhoto(Number(info.lastInsertRowid));
}

export function getPhoto(id) {
  return db.prepare('SELECT * FROM photos WHERE id = ?').get(id) || null;
}

export function updatePhoto(id, fields) {
  const row = getPhoto(id);
  if (!row) return null;
  db.prepare('UPDATE photos SET caption = ?, alt = ? WHERE id = ?').run(
    fields.caption ?? row.caption,
    fields.alt ?? fields.caption ?? row.alt,
    id
  );
  return getPhoto(id);
}

export function deletePhoto(id) {
  const row = getPhoto(id);
  if (row) db.prepare('DELETE FROM photos WHERE id = ?').run(id);
  return row;
}

// ---------------- 音乐 ----------------
export function listTracks() {
  return db.prepare('SELECT * FROM tracks ORDER BY sort_order ASC, id ASC').all();
}

export function insertTrack(record) {
  const info = db
    .prepare(
      `INSERT INTO tracks
        (filename, storage_key, original_name, mime, size, title, artist, source,
         external_id, external_url, embed_url, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      record.filename,
      record.storage_key,
      record.original_name,
      record.mime,
      record.size,
      record.title || record.original_name,
      record.artist || '',
      record.source || 'local',
      record.external_id || '',
      record.external_url || '',
      record.embed_url || '',
      record.sort_order || 0,
      nowIso()
    );
  return getTrack(Number(info.lastInsertRowid));
}

export function getTrack(id) {
  return db.prepare('SELECT * FROM tracks WHERE id = ?').get(id) || null;
}

export function updateTrack(id, fields) {
  const row = getTrack(id);
  if (!row) return null;
  db.prepare('UPDATE tracks SET title = ?, artist = ? WHERE id = ?').run(
    fields.title ?? row.title,
    fields.artist ?? row.artist,
    id
  );
  return getTrack(id);
}

export function deleteTrack(id) {
  const row = getTrack(id);
  if (row) db.prepare('DELETE FROM tracks WHERE id = ?').run(id);
  return row;
}

// ---------------- 背景 ----------------
export function listBackgrounds() {
  const rows = db.prepare('SELECT * FROM backgrounds').all();
  const out = {};
  for (const r of rows) out[r.page] = r;
  return out;
}

export function getBackground(page) {
  return db.prepare('SELECT * FROM backgrounds WHERE page = ?').get(page) || null;
}

export function setBackground(page, { type, color, storage_key, filename }) {
  db.prepare(
    `INSERT INTO backgrounds (page, type, color, storage_key, filename)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(page) DO UPDATE SET
       type = excluded.type,
       color = excluded.color,
       storage_key = excluded.storage_key,
       filename = excluded.filename`
  ).run(page, type, color || '', storage_key || '', filename || '');
  return getBackground(page);
}

// ---------------- 时间线 ----------------
export function listTimelineEvents() {
  return db
    .prepare('SELECT * FROM timeline_events ORDER BY event_date DESC, id DESC')
    .all();
}

export function getTimelineEvent(id) {
  return db.prepare('SELECT * FROM timeline_events WHERE id = ?').get(id) || null;
}

export function insertTimelineEvent({ event_date, title, description = '' }) {
  const info = db
    .prepare(
      'INSERT INTO timeline_events (event_date, title, description, created_at) VALUES (?, ?, ?, ?)'
    )
    .run(event_date, title, description, nowIso());
  return getTimelineEvent(Number(info.lastInsertRowid));
}

export function updateTimelineEvent(id, fields) {
  const row = getTimelineEvent(id);
  if (!row) return null;
  db.prepare(
    'UPDATE timeline_events SET event_date = ?, title = ?, description = ? WHERE id = ?'
  ).run(
    fields.event_date ?? row.event_date,
    fields.title ?? row.title,
    fields.description ?? row.description,
    id
  );
  return getTimelineEvent(id);
}

export function deleteTimelineEvent(id) {
  const row = getTimelineEvent(id);
  if (row) db.prepare('DELETE FROM timeline_events WHERE id = ?').run(id);
  return row;
}

export function listTimelinePhotos(eventId = null) {
  if (eventId === null) {
    return db
      .prepare('SELECT * FROM timeline_photos ORDER BY sort_order ASC, id ASC')
      .all();
  }
  return db
    .prepare(
      'SELECT * FROM timeline_photos WHERE event_id = ? ORDER BY sort_order ASC, id ASC'
    )
    .all(eventId);
}

export function getTimelinePhoto(id) {
  return db.prepare('SELECT * FROM timeline_photos WHERE id = ?').get(id) || null;
}

export function insertTimelinePhoto(record) {
  const info = db
    .prepare(
      `INSERT INTO timeline_photos
        (event_id, filename, storage_key, original_name, mime, size, alt, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      record.event_id,
      record.filename,
      record.storage_key,
      record.original_name,
      record.mime,
      record.size,
      record.alt || '',
      record.sort_order || 0,
      nowIso()
    );
  return getTimelinePhoto(Number(info.lastInsertRowid));
}

export function deleteTimelinePhoto(id) {
  const row = getTimelinePhoto(id);
  if (row) db.prepare('DELETE FROM timeline_photos WHERE id = ?').run(id);
  return row;
}

// 初始化默认数据
seedDefaults();

export default db;

