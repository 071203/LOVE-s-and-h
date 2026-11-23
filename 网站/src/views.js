import config from './config.js';
import storage from './storage/index.js';
import { escapeHtml, attr, sanitizeColor, diffDays, formatDateCn } from './util.js';

/**
 * 服务端模板渲染层。
 * 手工模板字符串，保证每个页面拥有独立的 title / description / canonical，
 * 满足 SEO 收录要求，同时不依赖任何模板引擎。
 */

function svgIcon(paths) {
  return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

const ICONS = {
  heart: svgIcon('<path d="M19.5 12.57 12 20l-7.5-7.43A5 5 0 1 1 12 6.3a5 5 0 1 1 7.5 6.27Z"/>'),
  album: svgIcon('<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.5-3.5L7 22"/>'),
  music: svgIcon('<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>'),
  timeline: svgIcon('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>'),
  admin: svgIcon('<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>'),
  plus: svgIcon('<path d="M12 5v14M5 12h14"/>'),
  upload: svgIcon('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>'),
  play: svgIcon('<path d="m6 4 14 8-14 8Z"/>'),
  pause: svgIcon('<path d="M8 5v14M16 5v14"/>'),
  trash: svgIcon('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'),
  edit: svgIcon('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/>'),
  lock: svgIcon('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
  image: svgIcon('<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.5-3.5L7 22"/>'),
  color: svgIcon('<path d="M12 22a10 10 0 1 1 10-10c0 3-1.5 5-4 5h-2a2 2 0 0 0-1 3.7c.7.4 1 1 1 1.8 0 .8-.7 1.5-1.5 1.5Z"/>'),
  x: svgIcon('<path d="M18 6 6 18M6 6l12 12"/>'),
  arrowLeft: svgIcon('<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>'),
  arrowRight: svgIcon('<path d="m12 5 7 7-7 7"/><path d="M5 12h14"/>'),
  rotateCcw: svgIcon('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>'),
  zoomIn: svgIcon('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M11 8v6M8 11h6"/>'),
  zoomOut: svgIcon('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M8 11h6"/>'),
  search: svgIcon('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'),
  sparkle: svgIcon('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/>'),
  paw: svgIcon('<path d="M8.2 11.3c-2.1 0-3.7-2.2-3.7-4.7S5.8 2 7.8 2s3.4 2.1 3.3 4.6c-.1 2.5-1.2 4.7-2.9 4.7Z"/><path d="M16.2 11.3c-1.7 0-2.8-2.2-2.9-4.7C13.2 4.1 14.5 2 16.5 2s3.3 2.1 3.3 4.6-.9 4.7-3.6 4.7Z"/><path d="M3.5 17.2c.2-3 2.8-5.4 7.9-6.1 1.9-.3 3.8 0 5.4.7 2.4 1 3.8 2.8 3.7 5.4-.2 3.4-4 4.9-7.2 4.8-2.4 0-4.7-.7-6.7-2.1-1.6-1.1-2.3-1.8-3.1-2.7Z"/>'),
};

function icon(name) {
  return ICONS[name] || ICONS.sparkle;
}

function bgStyle(bg) {
  if (bg && bg.type === 'image' && bg.url) {
    return `style="background-image:url('${attr(bg.url)}')"`;
  }
  const color = sanitizeColor(bg && bg.color);
  return `style="background-color:${color || '#F7F4EF'}"`;
}

function navHtml(active) {
  const items = [
    { key: 'home', href: '/', label: '首页', ic: 'heart' },
    { key: 'album', href: '/album', label: '相册', ic: 'album' },
    { key: 'timeline', href: '/timeline', label: '时间线', ic: 'timeline' },
    { key: 'music', href: '/music', label: '音乐', ic: 'music' },
    { key: 'pets', href: '/pets', label: '宠物', ic: 'paw' },
    { key: 'admin', href: '/admin', label: '管理', ic: 'admin' },
  ];
  const links = items
    .map(
      (it) => `<a class="nav-link ${it.key === active ? 'is-active' : ''}" href="${it.href}" data-nav><span class="nav-icon">${icon(it.ic)}</span><span class="nav-label">${it.label}</span></a>`
    )
    .join('');
  return `<aside class="side-nav"><a class="brand" href="/" aria-label="返回首页"><span class="brand-mark">${icon('heart')}</span><span class="brand-name">小时光</span></a><nav class="nav-list">${links}</nav><div class="nav-foot">始于心动 · 忠于日常</div></aside>`;
}

function mobileNav(active) {
  const items = [
    { key: 'home', href: '/', label: '首页', ic: 'heart' },
    { key: 'album', href: '/album', label: '相册', ic: 'album' },
    { key: 'timeline', href: '/timeline', label: '时间线', ic: 'timeline' },
    { key: 'music', href: '/music', label: '音乐', ic: 'music' },
    { key: 'pets', href: '/pets', label: '宠物', ic: 'paw' },
    { key: 'admin', href: '/admin', label: '管理', ic: 'admin' },
  ];
  const links = items
    .map((it) => `<a class="mnav-link ${it.key === active ? 'is-active' : ''}" href="${it.href}"><span class="mnav-icon">${icon(it.ic)}</span><span>${it.label}</span></a>`)
    .join('');
  return `<nav class="mobile-nav">${links}</nav>`;
}

function embedData(data) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return `<script type="application/json" id="page-data">${json}</script>`;
}

function shell({ page, active, title, description, keywords, body, bg, data, canonicalPath, extraHead = '' }) {
  const url = config.siteUrl + canonicalPath;
  const ogImage =
    data && data.ogImage ? data.ogImage : `${config.siteUrl}/og-cover.png`;
  const structuredData = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: title,
    url,
    description,
    inLanguage: 'zh-CN',
  }).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <script>
    (() => {
      try {
        if (sessionStorage.getItem('ut-page-transition') === 'in') {
          document.documentElement.classList.add('transition-incoming');
          window.setTimeout(() => {
            document.documentElement.classList.remove('transition-incoming');
          }, 2400);
        }
      } catch {}
    })();
  </script>
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="keywords" content="${escapeHtml(keywords)}">
  <meta name="application-name" content="${escapeHtml(title)}">
  <meta name="format-detection" content="telephone=no,email=no,address=no">
  <link rel="canonical" href="${attr(url)}">
  <meta name="robots" content="index,follow">
  <meta name="theme-color" content="#C96F7B">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="zh_CN">
  <meta property="og:site_name" content="${escapeHtml(title)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${attr(url)}">
  <meta property="og:image" content="${attr(ogImage)}">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1440">
  <meta property="og:image:height" content="1000">
  <meta property="og:image:alt" content="${escapeHtml(title)} 页面预览">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${attr(ogImage)}">
  <meta name="twitter:image:alt" content="${escapeHtml(title)} 页面预览">
  <script type="application/ld+json">${structuredData}</script>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/css/style.css">
  ${extraHead}
  <script type="importmap">
    {
      "imports": {
        "three": "/vendor/three.module.min.js",
        "three/addons/": "/vendor/addons/"
      }
    }
  </script>
</head>
<body data-page="${attr(page)}">
  <div class="site-bg" ${bgStyle(bg)}></div>
  <canvas class="hearts-canvas" id="heartsCanvas" aria-hidden="true"></canvas>
  <div class="transition-veil" data-motion-theme="love-bloom" aria-hidden="true">
    <span class="tv-layer tv-layer-a"></span>
    <span class="tv-layer tv-layer-b"></span>
    <span class="tv-love-scene">
      <span class="tv-love-aura"></span>
      <span class="tv-love-heart">
        <svg viewBox="0 0 240 220" fill="none" aria-hidden="true">
          <path class="tv-heart-path tv-heart-path-back" pathLength="1" d="M120 191C91 166 42 135 34 94C25 48 87 21 120 61C153 21 215 48 206 94C198 135 149 166 120 191Z"></path>
          <path class="tv-heart-path tv-heart-path-front" pathLength="1" d="M120 178C96 158 58 133 51 103C44 71 88 52 114 80C116 82 118 84 120 87C122 84 124 82 126 80C152 52 196 71 189 103C182 133 144 158 120 178Z"></path>
        </svg>
      </span>
      <span class="tv-love-orbit tv-orbit-a"></span>
      <span class="tv-love-orbit tv-orbit-b"></span>
      <span class="tv-love-orbit tv-orbit-c"></span>
      <span class="tv-love-spark tv-spark-a"></span>
      <span class="tv-love-spark tv-spark-b"></span>
      <span class="tv-love-spark tv-spark-c"></span>
      <span class="tv-love-spark tv-spark-d"></span>
    </span>
    <span class="tv-pointer-romance">
      <span class="tv-pointer-halo"></span>
      <span class="tv-pointer-trail tv-pointer-trail-a"></span>
      <span class="tv-pointer-trail tv-pointer-trail-b"></span>
      <span class="tv-pointer-trail tv-pointer-trail-c"></span>
      <span class="tv-pointer-heart tv-pointer-heart-a"></span>
      <span class="tv-pointer-heart tv-pointer-heart-b"></span>
      <span class="tv-pointer-heart tv-pointer-heart-c"></span>
      <span class="tv-pointer-heart tv-pointer-heart-d"></span>
    </span>
    <span class="tv-content"><small>HEART TO HEART</small><strong>向你靠近</strong></span>
  </div>
  ${navHtml(active)}
  <main class="main" id="main">${body}</main>
  ${mobileNav(active)}
  ${data ? embedData(data) : ''}
  <script src="/vendor/gsap.min.js"></script>
  <script src="/vendor/ScrollTrigger.min.js"></script>
  <script type="module" src="/js/app.js"></script>
</body>
</html>`;
}

function countdownCard(cd) {
  const target = new Date(`${cd.target_date}T00:00:00`);
  const ts = Number.isNaN(target.getTime()) ? 0 : target.getTime();
  const rawDiff = ts ? ts - Date.now() : 0;
  const isPast = rawDiff < 0;
  const diff = Math.abs(rawDiff);
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  const status = isPast ? '已经过去' : '距离目标';
  return `<article class="countdown-card ${isPast ? 'is-past' : ''}" data-countdown data-target="${ts}" style="--cd-color:${sanitizeColor(cd.color) || '#C96F7B'}">
    <div class="cd-top"><span class="cd-title">${escapeHtml(cd.title)}</span><span class="cd-date">${formatDateCn(cd.target_date)}</span></div>
    <div class="cd-digits">
      <div class="cd-unit"><b data-days>${days}</b><span>天</span></div>
      <div class="cd-unit"><b data-hours>${hours}</b><span>时</span></div>
      <div class="cd-unit"><b data-mins>${mins}</b><span>分</span></div>
      <div class="cd-unit"><b data-secs>${secs}</b><span>秒</span></div>
    </div>
    <div class="cd-caption"><span class="cd-status" data-cd-status>${status}</span></div>
  </article>`;
}

export function homePage({ settings, countdowns, bg, copy = {} }) {
  const days = Math.max(diffDays(settings.anniversary_date), 0);
  const cards = countdowns.map(countdownCard).join('');
  const since = String(settings.anniversary_date || '').slice(0, 4) || '2019';
  const body = `<section class="hero">
    <div class="glass-heart-stage" data-heart-ready="false">
      <canvas class="glass-heart-canvas" data-glass-heart aria-label="可旋转立体透明爱心，拖动旋转"></canvas>
      <span class="glass-heart-fallback" aria-hidden="true">
        <svg viewBox="0 0 240 220" fill="none">
          <defs>
            <linearGradient id="heart-fallback-fill" x1="42" y1="36" x2="198" y2="182" gradientUnits="userSpaceOnUse">
              <stop stop-color="#fff" stop-opacity=".86"/>
              <stop offset=".48" stop-color="#f2c8d0" stop-opacity=".38"/>
              <stop offset="1" stop-color="#c8e2d7" stop-opacity=".3"/>
            </linearGradient>
          </defs>
          <path d="M120 195C92 170 35 132 32 84C29 43 89 22 120 65C151 22 211 43 208 84C205 132 148 170 120 195Z" fill="url(#heart-fallback-fill)" stroke="rgba(255,255,255,.9)" stroke-width="1.5"/>
          <path d="M120 176C98 157 59 128 56 94C54 70 90 56 114 82C117 85 118 88 120 91C122 88 123 85 126 82C150 56 186 70 184 94C181 128 142 157 120 176Z" stroke="rgba(172,103,118,.46)" stroke-width="1.2"/>
        </svg>
      </span>
      <span class="glass-heart-hint" aria-hidden="true"><i></i>拖动旋转</span>
    </div>
    <p class="hero-eyebrow">${escapeHtml(copy['copy.home.hero_eyebrow'] || 'OUR LITTLE DAYS')}</p>
    <h1 class="hero-title">${escapeHtml(settings.couple_names)}</h1>
    <p class="hero-sub">${escapeHtml(settings.site_subtitle)}</p>
    <div class="hero-meta"><span>EST. ${escapeHtml(since)}</span><span>CHAPTER 01 · TOGETHER</span></div>
    <div class="hero-days"><span class="hero-days-num">${days}</span><span class="hero-days-label">${escapeHtml(copy['copy.home.days_label'] || '已经在一起 · 天')}</span></div>
  </section>
  <section class="section">
    <div class="section-head"><h2>${escapeHtml(copy['copy.home.section_title'] || '倒计时')}</h2><span class="section-note">${escapeHtml(copy['copy.home.section_note'] || '把期待的日子，一天天数给你看')}</span></div>
    <div class="countdown-grid">${cards || `<p class="empty">${escapeHtml(copy['copy.home.empty'] || '还没有倒计时，去「管理」添加一个吧。')}</p>`}</div>
  </section>`;
  return shell({
    page: 'home',
    active: 'home',
    title: `${settings.couple_names} · 我们的纪念网站`,
    description: `${settings.site_subtitle} 记录在一起的点滴：纪念日倒计时、共享相册与两个人的音乐。`,
    keywords: '情侣纪念,纪念日,倒计时,共享相册,情侣网站,恋爱纪念日',
    body,
    bg,
    canonicalPath: '/',
    data: { page: 'home', settings, countdowns },
  });
}

function albumLock(copy) {
  return `<section class="lock-panel">
    <div class="lock-badge">${icon('lock')}</div>
    <h1 class="lock-title">${escapeHtml(copy['copy.album.lock_title'] || '私藏相册')}</h1>
    <p class="lock-desc">${escapeHtml(copy['copy.album.lock_desc'] || '这里收藏着只属于我们的照片，请输入相册密码查看。')}</p>
    <form class="lock-form" id="albumUnlockForm" autocomplete="off">
      <input type="password" id="albumPassword" placeholder="相册密码" aria-label="相册密码" required>
      <button type="submit" class="btn btn-primary">${escapeHtml(copy['copy.album.unlock_btn'] || '解锁相册')}</button>
    </form>
    <p class="lock-hint" id="albumUnlockMsg"></p>
  </section>`;
}

function albumContent(copy, photos) {
  const items = photos
    .map(
      (p, i) => `<figure class="galaxy-photo" data-photo data-id="${p.id}" style="--i:${i}">
        <img src="${attr(p.url)}" alt="${attr(p.alt || p.caption || '我们的照片')}" loading="${i < 18 ? 'eager' : 'lazy'}" draggable="false">
        ${p.caption ? `<figcaption>${escapeHtml(p.caption)}</figcaption>` : ''}
      </figure>`
    )
    .join('');
  const empty = `<section class="empty-panel">
    <div class="empty-mark">${icon('image')}</div>
    <p class="empty">${escapeHtml(copy['copy.album.empty'] || '相册还是空的，上传第一张照片吧。')}</p>
  </section>`;
  return `<section class="page-head">
    <div><p class="hero-eyebrow">${escapeHtml(copy['copy.album.eyebrow'] || 'SHARED ALBUM')}</p><h1 class="page-title">${escapeHtml(copy['copy.album.title'] || '我们的相册')}</h1><p class="page-sub">${escapeHtml(copy['copy.album.sub'] || '每一帧，都是两个人共同的回忆。')}</p></div>
    <div class="album-actions">
      <span class="photo-count">${icon('image')}<b>${photos.length}</b></span>
      <button class="btn btn-ghost" id="albumUploadBtn">${icon('upload')}<span>${escapeHtml(copy['copy.album.upload'] || '上传照片')}</span></button>
    </div>
  </section>
  ${photos.length ? `<section class="galaxy" id="photoGalaxy" aria-label="3D 照片星云">
    <div class="galaxy-glow" aria-hidden="true"></div>
    <svg class="galaxy-heartline" viewBox="0 0 200 180" aria-hidden="true">
      <path d="M100 168C92 156 20 104 20 58C20 28 44 12 68 12C84 12 96 22 100 34C104 22 116 12 132 12C156 12 180 28 180 58C180 104 108 156 100 168Z"/>
    </svg>
    <div class="galaxy-stage" id="galaxyStage">${items}</div>
    <div class="galaxy-controls">
      <button class="galaxy-btn" data-galaxy-action="zoom-out" title="缩小" aria-label="缩小">${icon('zoomOut')}</button>
      <button class="galaxy-btn" data-galaxy-action="reset" title="重置视角" aria-label="重置视角">${icon('rotateCcw')}</button>
      <button class="galaxy-btn" data-galaxy-action="zoom-in" title="放大" aria-label="放大">${icon('zoomIn')}</button>
    </div>
  </section>` : empty}
  <input type="file" id="albumFileInput" accept="image/*" multiple hidden>`;
}

export function albumPage({ settings, bg, unlocked, photos, albumPasswordSet, copy = {} }) {
  const body = unlocked ? albumContent(copy, photos) : albumLock(copy);
  const data = {
    page: 'album',
    unlocked,
    albumPasswordSet,
  };
  if (unlocked) data.photos = photos;
  return shell({
    page: 'album',
    active: 'album',
    title: `我们的相册 · ${settings.couple_names}`,
    description: '两个人的私藏相册，记录每一次相聚、旅行与日常。',
    keywords: '情侣相册,恋爱照片,私藏相册,回忆,纪念相册',
    body,
    bg,
    canonicalPath: '/album',
    data,
  });
}

function dateParts(value) {
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) {
    return { year: '', month: '', day: '', weekday: '' };
  }
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return {
    year: String(d.getFullYear()),
    month: `${d.getMonth() + 1}月`,
    day: String(d.getDate()).padStart(2, '0'),
    weekday: weekdays[d.getDay()],
  };
}

function timelineLock(copy) {
  return `<section class="lock-panel">
    <div class="lock-badge">${icon('timeline')}</div>
    <h1 class="lock-title">${escapeHtml(copy['copy.timeline.lock_title'] || '私藏时间线')}</h1>
    <p class="lock-desc">${escapeHtml(copy['copy.timeline.lock_desc'] || '这里记录着我们一起经历的事，请输入相册密码查看。')}</p>
    <form class="lock-form" id="timelineUnlockForm" autocomplete="off">
      <input type="password" id="timelinePassword" placeholder="相册密码" aria-label="相册密码" required>
      <button type="submit" class="btn btn-primary">${escapeHtml(copy['copy.album.unlock_btn'] || '解锁相册')}</button>
    </form>
    <p class="lock-hint" id="timelineUnlockMsg"></p>
  </section>`;
}

function timelineEventCard(event, copy) {
  const parts = dateParts(event.event_date);
  const photos = (event.photos || [])
    .map(
      (p) => `<button class="timeline-photo" data-photo data-id="${p.id}" type="button" aria-label="查看照片">
        <img src="${attr(p.url)}" alt="${attr(p.alt || '时间线照片')}" loading="lazy">
      </button>`
    )
    .join('');
  return `<article class="timeline-event" data-timeline-event data-date="${attr(event.event_date)}">
    <div class="timeline-marker" aria-hidden="true"><span></span></div>
    <div class="timeline-card">
      <div class="timeline-date">
        <span class="timeline-day">${escapeHtml(parts.day)}</span>
        <span class="timeline-month">${escapeHtml(parts.month)}</span>
        <span class="timeline-weekday">${escapeHtml(parts.weekday)}</span>
      </div>
      <div class="timeline-content">
        <div class="timeline-meta">
          <time datetime="${attr(event.event_date)}">${escapeHtml(parts.year)}</time>
          <span>${(event.photos || []).length} 张照片</span>
        </div>
        <h2>${escapeHtml(event.title)}</h2>
        ${event.description ? `<p class="timeline-desc">${escapeHtml(event.description)}</p>` : ''}
        ${photos ? `<div class="timeline-photos">${photos}</div>` : `<p class="timeline-no-photo">${escapeHtml(copy['copy.timeline.empty_day'] || '这一天还没有照片')}</p>`}
      </div>
    </div>
  </article>`;
}

export function timelinePage({ settings, bg, unlocked, events, copy = {} }) {
  const body = unlocked
    ? `<section class="page-head">
        <div><p class="hero-eyebrow">${escapeHtml(copy['copy.timeline.eyebrow'] || 'OUR FOOTPRINTS')}</p><h1 class="page-title">${escapeHtml(copy['copy.timeline.title'] || '我们的时间线')}</h1><p class="page-sub">${escapeHtml(copy['copy.timeline.sub'] || '把一起走过的日子，按时间慢慢展开。')}</p></div>
        <span class="photo-count">${icon('timeline')}<b>${events.length}</b></span>
      </section>
      ${events.length ? `<section class="timeline" id="timelineList"><span class="timeline-progress" aria-hidden="true"></span>${events.map((e) => timelineEventCard(e, copy)).join('')}</section>` : `<section class="empty-panel"><div class="empty-mark">${icon('timeline')}</div><p class="empty">${escapeHtml(copy['copy.timeline.empty'] || '还没有时间线记录，去「管理」添加第一段回忆吧。')}</p></section>`}`
    : timelineLock(copy);
  return shell({
    page: 'timeline',
    active: 'timeline',
    title: `我们的时间线 · ${settings.couple_names}`,
    description: '按日期记录两个人一起经历的事，以及当天留下的照片。',
    keywords: '情侣时间线,纪念日记录,恋爱事件,回忆照片',
    body,
    bg,
    canonicalPath: '/timeline',
    data: { page: 'timeline', unlocked },
  });
}

function adminLock(copy) {
  return `<section class="lock-panel">
    <div class="lock-badge">${icon('admin')}</div>
    <h1 class="lock-title">${escapeHtml(copy['copy.admin.title'] || '管理后台')}</h1>
    <p class="lock-desc">${escapeHtml(copy['copy.admin.lock_desc'] || '请输入管理员密码，管理倒计时、照片、音乐与站点设置。')}</p>
    <form class="lock-form" id="adminUnlockForm" autocomplete="off">
      <input type="password" id="adminPassword" placeholder="管理员密码" aria-label="管理员密码" required>
      <button type="submit" class="btn btn-primary">${escapeHtml(copy['copy.admin.unlock_btn'] || '进入后台')}</button>
    </form>
    <p class="lock-hint" id="adminUnlockMsg"></p>
  </section>`;
}

export function adminLockPage({ settings, bg, copy = {} }) {
  return shell({
    page: 'admin',
    active: 'admin',
    title: `管理后台 · ${settings.couple_names}`,
    description: '情侣纪念网站管理后台，管理倒计时、相册、音乐与站点设置。',
    keywords: '管理后台,情侣网站管理',
    body: adminLock(copy),
    bg,
    canonicalPath: '/admin',
    data: { page: 'admin', locked: true },
  });
}

function trackItem(t) {
  if (t.source === 'netease') {
    return `<li class="track-item track-external is-netease">
      <div class="track-external-head">
        <span class="track-source">网易云音乐</span>
        <a class="track-open" href="${attr(t.external_url)}" target="_blank" rel="noopener noreferrer">${icon('arrowRight')} 打开原曲</a>
      </div>
      <div class="track-meta"><span class="track-title">${escapeHtml(t.title)}</span><span class="track-artist">${escapeHtml(t.artist || '网易云音乐')}</span></div>
      ${t.embed_url ? `<details class="embed-details">
        <summary>${icon('play')} 网易云播放器</summary>
        <iframe class="netease-embed" src="${attr(t.embed_url)}" loading="lazy" allow="autoplay" title="${attr(t.title)}"></iframe>
      </details>` : ''}
    </li>`;
  }
  if (t.source === 'qq') {
    return `<li class="track-item track-external is-qq">
      <div class="track-external-head">
        <span class="track-source">QQ音乐</span>
        <a class="track-open" href="${attr(t.external_url)}" target="_blank" rel="noopener noreferrer">${icon('arrowRight')} 去 QQ 音乐播放</a>
      </div>
      <div class="track-meta"><span class="track-title">${escapeHtml(t.title)}</span><span class="track-artist">${escapeHtml(t.artist || 'QQ音乐')}</span></div>
    </li>`;
  }
  if (t.source === 'itunes') {
    return `<li class="track-item is-itunes" data-track data-id="${t.id}" data-src="${attr(t.embed_url)}" data-title="${attr(t.title)}" data-artist="${attr(t.artist)}">
      <button class="track-play" data-play aria-label="试听 ${attr(t.title)}">
        <span class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>${icon('play')}
      </button>
      <div class="track-meta"><span class="track-title">${escapeHtml(t.title)}</span><span class="track-artist">${escapeHtml(t.artist || '未知歌手')} · 30 秒试听</span></div>
      <a class="track-open" href="${attr(t.external_url)}" target="_blank" rel="noopener noreferrer">${icon('arrowRight')} 完整歌曲</a>
    </li>`;
  }
  if (t.source === 'audius') {
    return `<li class="track-item is-audius" data-track data-id="${t.id}" data-src="${attr(t.embed_url || t.url)}" data-title="${attr(t.title)}" data-artist="${attr(t.artist)}">
      <button class="track-play" data-play aria-label="播放 ${attr(t.title)}">
        <span class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>${icon('play')}
      </button>
      <div class="track-meta"><span class="track-title">${escapeHtml(t.title)}</span><span class="track-artist">${escapeHtml(t.artist || 'Audius')}</span></div>
      <span class="track-source">Audius</span>
    </li>`;
  }
  return `<li class="track-item" data-track data-id="${t.id}" data-src="${attr(t.url)}" data-title="${attr(t.title)}" data-artist="${attr(t.artist)}">
    <button class="track-play" data-play aria-label="播放 ${attr(t.title)}">
      <span class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>${icon('play')}
    </button>
    <div class="track-meta"><span class="track-title">${escapeHtml(t.title)}</span><span class="track-artist">${escapeHtml(t.artist || '未知歌手')}</span></div>
    <span class="track-dur" data-dur>--:--</span>
  </li>`;
}

export function musicPage({ settings, bg, tracks, copy = {} }) {
  const list = tracks.map(trackItem).join('');
  const body = `<section class="page-head">
    <div><p class="hero-eyebrow">${escapeHtml(copy['copy.music.eyebrow'] || 'OUR PLAYLIST')}</p><h1 class="page-title">${escapeHtml(copy['copy.music.title'] || '我们的歌')}</h1><p class="page-sub">${escapeHtml(copy['copy.music.sub'] || '那些一听，就想起你的旋律。')}</p></div>
  </section>
  <section class="music-search" id="musicSearch">
    <form class="music-search-form" id="musicSearchForm">
      <span class="music-search-icon">${icon('search')}</span>
      <input type="search" id="musicSearchInput" placeholder="搜索网易云歌曲、歌手" autocomplete="off" aria-label="搜索在线音乐">
      <button type="submit" class="btn btn-primary btn-sm">搜索</button>
    </form>
    <div class="music-search-tools">
      <div class="music-search-sources" id="musicSearchSources">
        <button class="search-source is-active" data-search-source="netease">网易云音乐</button>
        <button class="search-source" data-search-source="itunes">Apple Music</button>
      </div>
      <div class="music-search-source" id="musicSearchSourceNote">官方播放器 · 中文曲库</div>
    </div>
    <div class="music-search-results" id="musicSearchResults"></div>
  </section>
  <section class="music-panel">
    <ul class="track-list" id="trackList">${list || `<li class="empty">${escapeHtml(copy['copy.music.empty'] || '还没有音乐，去「管理」导入一首吧。')}</li>`}</ul>
  </section>`;
  return shell({
    page: 'music',
    active: 'music',
    title: `我们的歌单 · ${settings.couple_names}`,
    description: '两个人喜欢的音乐，一起听过的旋律，永久收藏在这里。',
    keywords: '情侣歌单,恋爱音乐,共同喜欢的歌,回忆歌单',
    body,
    bg,
    canonicalPath: '/music',
    data: { page: 'music', tracks },
  });
}

function petLock(copy) {
  return `<section class="lock-panel pets-lock">
    <div class="lock-badge">${icon('paw')}</div>
    <h1 class="lock-title">共同的小家</h1>
    <p class="lock-desc">TOM 和皮皮在这里等你们回家。输入相册密码，一起照顾它们。</p>
    <form class="lock-form" id="petsUnlockForm" autocomplete="off">
      <input type="password" id="petsPassword" placeholder="相册密码" aria-label="相册密码" required>
      <button type="submit" class="btn btn-primary">${escapeHtml(copy['copy.album.unlock_btn'] || '解锁相册')}</button>
    </form>
    <p class="lock-hint" id="petsUnlockMsg"></p>
  </section>`;
}

function petMeter(label, key, value) {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));
  return `<div class="pet-meter" data-meter="${key}">
    <div class="pet-meter-head"><span>${label}</span><b data-meter-value>${Math.round(safe)}</b></div>
    <div class="pet-meter-track"><i style="--value:${safe}%"></i></div>
  </div>`;
}

function petCompanionHint(pet) {
  if (pet.current_pose === 'sleep') return '正在睡觉';
  if (Number(pet.satiety) < 35) return `有点饿了 · 亲密 ${Math.round(Number(pet.affection) || 0)}`;
  if (Number(pet.cleanliness) < 35) {
    return `想洗个澡 · 亲密 ${Math.round(Number(pet.affection) || 0)}`;
  }
  if (Number(pet.energy) < 30) return '有点困了';
  if (Number(pet.affection) > 82) return '很想黏着你';
  return pet.slug === 'tom' ? '安静陪在身边' : '等你一起玩';
}

function petActionButton(action, label, iconName) {
  return `<button class="pet-action" type="button" data-pet-action="${action}">
    <span class="pet-action-icon">${icon(iconName)}</span>
    <span>${label}</span>
  </button>`;
}

function eventItem(event) {
  const time = new Date(event.created_at);
  const when = Number.isNaN(time.getTime())
    ? ''
    : new Intl.DateTimeFormat('zh-CN', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(time);
  return `<li class="pet-event" data-event-id="${event.id}">
    <span class="pet-event-dot"></span>
    <div><p>${escapeHtml(event.summary)}</p><time>${escapeHtml(when)}</time></div>
  </li>`;
}

export function petsPage({ settings, bg, unlocked, pets = [], events = [] }) {
  if (!unlocked) {
    return shell({
      page: 'pets',
      active: 'pets',
      title: `共同的小家 · ${settings.couple_names}`,
      description: '一起照顾 TOM 和皮皮的私密虚拟宠物空间。',
      keywords: '虚拟宠物,情侣宠物,TOM,皮皮',
      body: petLock({}),
      bg,
      canonicalPath: '/pets',
      data: { page: 'pets', unlocked: false },
      extraHead: '<link rel="stylesheet" href="/css/pets.css">',
    });
  }

  const tom = pets.find((pet) => pet.slug === 'tom') || pets[0] || {};
  const pipi =
    pets.find((pet) => pet.slug === 'pipi') ||
    pets.find((pet) => pet !== tom) ||
    {};
  const eventMarkup = events
    .slice(0, 8)
    .map(eventItem)
    .join('');
  const body = `<section class="page-head pets-page-head">
    <div>
      <p class="hero-eyebrow">OUR LITTLE HOME</p>
      <h1 class="page-title">共同的小家</h1>
      <p class="page-sub">一只安静的猫，一只热情的狗，等你们一起把日子养得柔软。</p>
    </div>
    <div class="pet-live-badge"><i></i><span>共同照看中</span></div>
  </section>
  <section class="pet-room-layout" data-pet-room data-active-pet="${attr(tom.slug || 'tom')}">
    <div class="pet-stage" data-pet-stage>
      <canvas id="petCanvas" aria-label="可旋转、可互动的 TOM 和皮皮 3D 宠物房间"></canvas>
      <div class="pet-stage-light" aria-hidden="true"></div>
      <div class="pet-room-loading" data-pet-loading>
        <span class="pet-loading-heart"></span>
        <p>正在把 TOM 和皮皮带回家…</p>
      </div>
      <div class="pet-fallback" data-pet-fallback hidden>
        <img data-fallback-image src="/pets/fallback/tom.webp" alt="TOM 的 3D 转台预览">
        <p>3D 场景暂时不可用，状态和照顾记录仍可使用。</p>
      </div>
      <button class="pet-view-toggle" type="button" data-pet-view-toggle aria-pressed="false">
        <span class="pet-view-icon" aria-hidden="true"></span>
        <span data-pet-view-label>近看它</span>
      </button>
      <div class="pet-scene-hint"><span>拖动旋转视角</span><span>点击选宠 / 亲近</span></div>
      <div class="pet-reaction" data-pet-reaction aria-live="polite"></div>
    </div>
    <aside class="pet-care-panel">
      <div class="pet-selector" role="tablist" aria-label="选择宠物">
        <button class="pet-select is-active" data-pet-select="tom" role="tab" aria-selected="true">
          <span class="pet-avatar pet-avatar-tom">TOM</span>
          <span><b>TOM</b><small data-pet-summary="tom">${escapeHtml(petCompanionHint(tom))}</small></span>
        </button>
        <button class="pet-select" data-pet-select="pipi" role="tab" aria-selected="false">
          <span class="pet-avatar pet-avatar-pipi">皮</span>
          <span><b>皮皮</b><small data-pet-summary="pipi">${escapeHtml(petCompanionHint(pipi))}</small></span>
        </button>
      </div>
      <article class="pet-status-card" data-pet-card>
        <div class="pet-status-head">
          <div><small>NOW CARING FOR</small><h2 data-pet-name>${escapeHtml(tom.display_name || 'TOM')}</h2></div>
          <span class="pet-stage-pill" data-pet-growth>${escapeHtml(tom.growth?.label || '来到身边')}</span>
        </div>
        <p class="pet-mood" data-pet-mood>它正安静地看着你，等待今天的陪伴。</p>
        <div class="pet-meters">
          ${petMeter('饱腹', 'satiety', tom.satiety)}
          ${petMeter('清洁', 'cleanliness', tom.cleanliness)}
          ${petMeter('精力', 'energy', tom.energy)}
          ${petMeter('亲密', 'affection', tom.affection)}
        </div>
        <div class="pet-care-actions">
          ${petActionButton('feed', '喂食', 'sparkle')}
          ${petActionButton('bath', '洗澡', 'image')}
          ${petActionButton('sleep', '睡觉', 'timeline')}
          ${petActionButton('ball', '玩球', 'heart')}
          ${petActionButton('teaser', '逗猫棒', 'paw')}
        </div>
        <button class="pet-wake" type="button" data-pet-wake hidden>叫醒它</button>
      </article>
      <section class="pet-events-card">
        <div class="pet-events-head"><h3>照顾记录</h3><span>两个人的陪伴</span></div>
        <ul class="pet-events" data-pet-events>
          ${eventMarkup || '<li class="pet-event is-empty"><span class="pet-event-dot"></span><div><p>还没有记录，从喂食或玩球开始吧。</p></div></li>'}
        </ul>
      </section>
    </aside>
  </section>`;

  return shell({
    page: 'pets',
    active: 'pets',
    title: `共同的小家 · ${settings.couple_names}`,
    description: '一起照顾 TOM 和皮皮的私密虚拟宠物空间，喂食、洗澡、睡觉、玩球与成长记录。',
    keywords: '虚拟宠物,情侣宠物,TOM,皮皮,3D宠物',
    body,
    bg,
    canonicalPath: '/pets',
    data: { page: 'pets', unlocked: true, pets, events },
    extraHead: '<link rel="stylesheet" href="/css/pets.css">',
  });
}

export function adminPage({ settings, bg, countdowns, photos, tracks, backgrounds, timeline = [], storageName, copy = {} }) {
  const body = `<section class="page-head">
    <div><p class="hero-eyebrow">${escapeHtml(copy['copy.admin.eyebrow'] || 'CONTROL ROOM')}</p><h1 class="page-title">${escapeHtml(copy['copy.admin.title'] || '管理后台')}</h1><p class="page-sub">${escapeHtml(copy['copy.admin.sub'] || '管理倒计时、照片、音乐、背景与站点设置。')}</p></div>
  </section>
  <div class="admin-tabs" role="tablist">
    <button class="admin-tab is-active" data-tab="countdown">倒计时</button>
    <button class="admin-tab" data-tab="photos">相册</button>
    <button class="admin-tab" data-tab="timeline">时间线</button>
    <button class="admin-tab" data-tab="music">音乐</button>
    <button class="admin-tab" data-tab="background">背景</button>
    <button class="admin-tab" data-tab="copy">文案</button>
    <button class="admin-tab" data-tab="settings">设置</button>
  </div>
  <div class="admin-body" id="adminBody"></div>`;
  return shell({
    page: 'admin',
    active: 'admin',
    title: `管理后台 · ${settings.couple_names}`,
    description: '情侣纪念网站管理后台，管理倒计时、相册、音乐与站点设置。',
    keywords: '管理后台,情侣网站管理',
    body,
    bg,
    canonicalPath: '/admin',
    data: { page: 'admin', settings, countdowns, photos, tracks, backgrounds, timeline, storageName, copy },
  });
}

// 把数据库里的背景记录补齐 url，供模板与页面使用。
export function resolveBg(record) {
  if (!record) return { type: 'color', color: '#F7F4EF', url: '' };
  const out = { ...record, url: '' };
  if (record.type === 'image' && record.storage_key) {
    out.url = storage.url(record.storage_key);
  }
  return out;
}
