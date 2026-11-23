import config from './config.js';
import storage from './storage/index.js';
import * as db from './db.js';
import { isAlbumAuthed, isAdminAuthed } from './auth.js';
import { html, text, attr } from './util.js';
import {
  homePage,
  albumPage,
  timelinePage,
  musicPage,
  petsPage,
  adminPage,
  adminLockPage,
  resolveBg,
} from './views.js';
import { growthStage, settlePet } from './pet-sim.js';

/**
 * 页面路由层：负责渲染 HTML 页面、robots.txt 与 sitemap.xml。
 */

function withUrl(rows) {
  return rows.map((r) => ({
    ...r,
    url: r.storage_key ? storage.url(r.storage_key) : r.external_url || '',
  }));
}

function publicSettings() {
  const all = db.allSettings();
  return {
    site_title: all.site_title || '我们的小时光',
    site_subtitle: all.site_subtitle || '',
    couple_names: all.couple_names || '我 & 你',
    anniversary_date: all.anniversary_date || '2019-05-20',
  };
}

function timelineData() {
  const photos = withUrl(db.listTimelinePhotos());
  return db.listTimelineEvents().map((event) => ({
    ...event,
    photos: photos.filter((photo) => photo.event_id === event.id),
  }));
}

function petData() {
  const now = new Date();
  const pets = db.petStore.listPets().map((stored) => {
    const settled = settlePet(stored, now);
    const saved = db.petStore.savePet(settled);
    return {
      ...saved,
      growth: growthStage(saved.adoption_date, now),
    };
  });
  return {
    pets,
    events: db.petStore.listEvents(30),
  };
}

function privateSettings() {
  const all = db.allSettings();
  return {
    ...publicSettings(),
    album_password: all.album_password || '',
    admin_password: all.admin_password || '',
  };
}

function robotsTxt() {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /pets',
    '',
    `Sitemap: ${config.siteUrl}/sitemap.xml`,
    '',
  ].join('\n');
}

function sitemapXml() {
  const base = config.siteUrl;
  const pages = [
    { path: '/', priority: '1.0', change: 'daily' },
    { path: '/album', priority: '0.7', change: 'weekly' },
    { path: '/music', priority: '0.8', change: 'weekly' },
  ];
  const now = new Date().toISOString().slice(0, 10);
  const items = pages
    .map(
      (p) => `  <url>
    <loc>${attr(base + p.path)}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${p.change}</changefreq>
    <priority>${p.priority}</priority>
  </url>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</urlset>`;
}

export function handlePages(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;

  if (pathname === '/') {
    const settings = publicSettings();
    const countdowns = db.listCountdowns();
    const bg = resolveBg(db.getBackground('home'));
    html(res, 200, homePage({ settings, countdowns, bg, copy: db.copyMap() }));
    return true;
  }

  if (pathname === '/album') {
    const settings = publicSettings();
    const unlocked = isAlbumAuthed(req);
    const photos = unlocked ? withUrl(db.listPhotos()) : [];
    const bg = resolveBg(db.getBackground('album'));
    const albumPasswordSet = Boolean(db.getSetting('album_password'));
    html(res, 200, albumPage({ settings, bg, unlocked, photos, albumPasswordSet, copy: db.copyMap() }));
    return true;
  }

  if (pathname === '/music') {
    const settings = publicSettings();
    const tracks = withUrl(db.listTracks());
    const bg = resolveBg(db.getBackground('music'));
    html(res, 200, musicPage({ settings, bg, tracks, copy: db.copyMap() }));
    return true;
  }

  if (pathname === '/timeline') {
    const settings = publicSettings();
    const unlocked = isAlbumAuthed(req);
    const events = unlocked ? timelineData() : [];
    const bg = resolveBg(db.getBackground('timeline'));
    html(res, 200, timelinePage({ settings, bg, unlocked, events, copy: db.copyMap() }));
    return true;
  }

  if (pathname === '/pets') {
    const settings = publicSettings();
    const unlocked = isAlbumAuthed(req);
    const state = unlocked ? petData() : { pets: [], events: [] };
    const bg = resolveBg(db.getBackground('pets'));
    html(
      res,
      200,
      petsPage({
        settings,
        bg,
        unlocked,
        pets: state.pets,
        events: state.events,
      })
    );
    return true;
  }

  if (pathname === '/admin') {
    if (!isAdminAuthed(req)) {
      const settings = publicSettings();
      const bg = resolveBg(db.getBackground('admin'));
      html(res, 200, adminLockPage({ settings, bg, copy: db.copyMap() }));
      return true;
    }
    const settings = privateSettings();
    const countdowns = db.listCountdowns();
    const photos = withUrl(db.listPhotos());
    const tracks = withUrl(db.listTracks());
    const timeline = timelineData();
    const backgrounds = db.listBackgrounds();
    for (const page of Object.keys(backgrounds)) {
      if (backgrounds[page].type === 'image' && backgrounds[page].storage_key) {
        backgrounds[page].url = storage.url(backgrounds[page].storage_key);
      }
    }
    const bg = resolveBg(db.getBackground('admin'));
    html(
      res,
      200,
      adminPage({ settings, bg, countdowns, photos, tracks, backgrounds, timeline, storageName: storage.name, copy: db.copyMap() })
    );
    return true;
  }

  if (pathname === '/robots.txt') {
    text(res, 200, robotsTxt(), 'text/plain; charset=utf-8');
    return true;
  }

  if (pathname === '/sitemap.xml') {
    text(res, 200, sitemapXml(), 'application/xml; charset=utf-8');
    return true;
  }

  return false;
}

