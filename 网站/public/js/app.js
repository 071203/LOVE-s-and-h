// 小时光 · 前端交互脚本（原生 ES Module，无第三方依赖）

import { initSiteMusic } from './site-music.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function pageData() {
  const el = document.getElementById('page-data');
  if (!el) return {};
  try {
    return JSON.parse(el.textContent);
  } catch {
    return {};
  }
}

const COPY_FIELDS = [
  ['copy.home.hero_eyebrow', '首页 · 顶部眉标', 'input'],
  ['copy.home.days_label', '首页 · 在一起天数标签', 'input'],
  ['copy.home.section_title', '首页 · 倒计时标题', 'input'],
  ['copy.home.section_note', '首页 · 倒计时说明', 'input'],
  ['copy.home.empty', '首页 · 空状态提示', 'input'],
  ['copy.album.lock_title', '相册 · 锁屏标题', 'input'],
  ['copy.album.lock_desc', '相册 · 锁屏说明', 'textarea'],
  ['copy.album.unlock_btn', '相册 · 解锁按钮', 'input'],
  ['copy.album.eyebrow', '相册 · 顶部眉标', 'input'],
  ['copy.album.title', '相册 · 页面标题', 'input'],
  ['copy.album.sub', '相册 · 页面副标题', 'input'],
  ['copy.album.upload', '相册 · 上传按钮', 'input'],
  ['copy.album.empty', '相册 · 空状态提示', 'input'],
  ['copy.music.eyebrow', '音乐 · 顶部眉标', 'input'],
  ['copy.music.title', '音乐 · 页面标题', 'input'],
  ['copy.music.sub', '音乐 · 页面副标题', 'input'],
  ['copy.music.empty', '音乐 · 空状态提示', 'input'],
  ['copy.timeline.eyebrow', '时间线 · 顶部眉标', 'input'],
  ['copy.timeline.title', '时间线 · 页面标题', 'input'],
  ['copy.timeline.sub', '时间线 · 页面副标题', 'input'],
  ['copy.timeline.lock_title', '时间线 · 锁屏标题', 'input'],
  ['copy.timeline.lock_desc', '时间线 · 锁屏说明', 'textarea'],
  ['copy.timeline.empty', '时间线 · 空状态提示', 'input'],
  ['copy.timeline.empty_day', '时间线 · 当天无照片提示', 'input'],
  ['copy.admin.eyebrow', '管理 · 顶部眉标', 'input'],
  ['copy.admin.title', '管理 · 页面标题', 'input'],
  ['copy.admin.sub', '管理 · 页面副标题', 'input'],
  ['copy.admin.lock_desc', '管理 · 锁屏说明', 'textarea'],
  ['copy.admin.unlock_btn', '管理 · 进入按钮', 'input'],
];

function ic(name, size = 18) {
  const paths = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
    play: '<path d="m6 4 14 8-14 8Z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    arrowLeft: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
    arrowRight: '<path d="m12 5 7 7-7 7"/><path d="M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
  };
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.plus}</svg>`;
}

function splitChars(element) {
  if (!element || element.dataset.split === 'true') return [];
  const text = element.textContent || '';
  if (!text.trim()) return [];
  element.dataset.split = 'true';
  element.setAttribute('aria-label', text);
  element.textContent = '';
  return Array.from(text).map((char) => {
    const span = document.createElement('span');
    span.className = 'char';
    span.setAttribute('aria-hidden', 'true');
    span.textContent = char === ' ' ? '\u00A0' : char;
    element.appendChild(span);
    return span;
  });
}

function initGSAPExperience() {
  const g = window.gsap;
  if (!g) return;
  const ScrollTrigger = window.ScrollTrigger;
  if (ScrollTrigger) g.registerPlugin(ScrollTrigger);
  document.documentElement.classList.add('gsap-enabled');
  g.defaults({ ease: 'power3.out' });

  const html = document.documentElement;
  const incoming = html.classList.contains('transition-incoming');
  const veil = document.querySelector('.transition-veil');
  const layers = veil ? Array.from(veil.querySelectorAll('.tv-layer')) : [];
  const tvContent = veil ? veil.querySelector('.tv-content') : null;
  const loveHeart = veil ? veil.querySelector('.tv-love-heart') : null;
  const loveHeartPaths = veil ? Array.from(veil.querySelectorAll('.tv-heart-path')) : [];
  const loveOrbits = veil ? Array.from(veil.querySelectorAll('.tv-love-orbit')) : [];
  const loveSparks = veil ? Array.from(veil.querySelectorAll('.tv-love-spark')) : [];
  const loveAura = veil ? veil.querySelector('.tv-love-aura') : null;

  function clearIncoming() {
    html.classList.remove('transition-incoming');
    if (veil) {
      delete veil.dataset.transitionState;
      delete veil.dataset.pointerActive;
    }
    try {
      sessionStorage.removeItem('ut-page-transition');
    } catch {
      /* ignore */
    }
  }

  const mm = g.matchMedia();
  mm.add(
    {
      motion: '(prefers-reduced-motion: no-preference)',
      reduce: '(prefers-reduced-motion: reduce)',
    },
    (context) => {
      const { motion } = context.conditions;
      if (!motion) {
        g.set('.main, .side-nav, .mobile-nav', { clearProps: 'all' });
        if (veil) g.set(veil, { autoAlpha: 0, pointerEvents: 'none' });
        clearIncoming();
        return;
      }

      const heroChars = splitChars(document.querySelector('.hero-title'));
      const pageChars = splitChars(document.querySelector('.page-head .page-title'));

      g.set('.main', { autoAlpha: 0, y: 18 });
      g.set('.side-nav, .mobile-nav', { autoAlpha: 0 });

      if (incoming && veil) {
        g.set(veil, { autoAlpha: 1, pointerEvents: 'auto' });
        veil.dataset.transitionState = 'unfurling';
        g.set(veil, { '--tv-origin-x': '50vw', '--tv-origin-y': '50vh' });
        g.set(layers, { autoAlpha: 1, scale: 1 });
        g.set(tvContent, { autoAlpha: 1, y: 0 });
        g.set([loveHeart, loveAura, ...loveOrbits], {
          xPercent: -50,
          yPercent: -50,
          transformOrigin: '50% 50%',
        });
        g.set(loveAura, { autoAlpha: 0.82, scale: 1.04 });
        g.set(loveHeart, { autoAlpha: 1, scale: 1.04 });
        g.set(loveOrbits, { autoAlpha: 0.9, scale: 1 });
        g.set(loveHeartPaths, { strokeDashoffset: 0 });
      }

      const contentStart = incoming ? 0.3 : 0;
      const intro = g.timeline({
        defaults: { duration: 0.8, ease: 'power3.out' },
        onComplete: () => {
          if (incoming && veil) {
            g.set(veil, { autoAlpha: 0, pointerEvents: 'none' });
          }
          clearIncoming();
        },
      });

      if (incoming) {
        intro
          .to(tvContent, { autoAlpha: 0, duration: 0.26, ease: 'power2.in' }, 0)
          .to(loveHeart, {
            autoAlpha: 0,
            scale: 1.3,
            duration: 0.82,
            ease: 'power2.out',
          }, 0.04)
          .to(loveOrbits, {
            autoAlpha: 0,
            scale: 1.38,
            rotation: '+=14',
            duration: 0.86,
            stagger: 0.035,
            ease: 'power2.out',
          }, 0.07)
          .to(loveAura, {
            autoAlpha: 0,
            scale: 1.62,
            duration: 0.9,
            ease: 'power2.out',
          }, 0.08)
          .to(layers, {
            autoAlpha: 0,
            scale: 1.025,
            duration: 0.74,
            ease: 'power2.inOut',
          }, 0.18);
      }

      intro
        .to('.main', { autoAlpha: 1, y: 0, duration: 0.98 }, contentStart)
        .to('.side-nav, .mobile-nav', { autoAlpha: 1, duration: 0.68, stagger: 0.08 }, contentStart + 0.08);

      if (heroChars.length) {
        intro
          .from('.hero-eyebrow', { y: 18, autoAlpha: 0, duration: 0.6 }, contentStart + 0.2)
          .from(
            heroChars,
            {
              yPercent: 115,
              rotationX: -48,
              autoAlpha: 0,
              transformOrigin: '50% 100%',
              stagger: 0.035,
              duration: 0.95,
              ease: 'power4.out',
            },
            contentStart + 0.32
          )
          .from('.hero-sub, .hero-meta', { y: 22, autoAlpha: 0, stagger: 0.08, duration: 0.65 }, contentStart + 0.67)
          .from('.hero-days', { x: 28, autoAlpha: 0, duration: 0.75 }, contentStart + 0.74);
      } else {
        if (pageChars.length) {
          intro.from(
            pageChars,
            {
              yPercent: 110,
              rotationX: -36,
              autoAlpha: 0,
              transformOrigin: '50% 100%',
              stagger: 0.025,
              duration: 0.9,
              ease: 'power4.out',
            },
            contentStart + 0.24
          );
        }
        intro.from('.page-head .hero-eyebrow, .page-head .page-sub', {
          y: 18,
          autoAlpha: 0,
          stagger: 0.08,
          duration: 0.6,
        }, contentStart + 0.44);
      }

      if (ScrollTrigger) {
        g.to('.site-bg', {
          yPercent: 5,
          ease: 'none',
          scrollTrigger: {
            trigger: document.body,
            start: 'top top',
            end: 'bottom bottom',
            scrub: 1.2,
          },
        });

        ScrollTrigger.batch(
          '.section-head, .countdown-card, .music-search, .music-panel, .empty-panel, .timeline-event, .admin-panel',
          {
            start: 'top 88%',
            once: true,
            onEnter: (batch) =>
              g.fromTo(
                batch,
                { y: 34, autoAlpha: 0 },
                {
                  y: 0,
                  autoAlpha: 1,
                  duration: 0.82,
                  stagger: 0.07,
                  ease: 'power3.out',
                  clearProps: 'transform',
                }
              ),
          }
        );
      }
    }
  );
}

async function apiJson(method, path, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(path, opts);
  let data = {};
  try {
    data = await res.json();
  } catch {
    /* 非 JSON 响应 */
  }
  return { status: res.status, data };
}

async function uploadRaw(path, file, fields = {}) {
  const q = new URLSearchParams({ filename: file.name, ...fields });
  const res = await fetch(`${path}?${q}`, {
    method: 'POST',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    /* ignore */
  }
  return { status: res.status, data };
}

function initTransitions() {
  const veil = document.querySelector('.transition-veil');
  const g = window.gsap;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const layers = veil ? Array.from(veil.querySelectorAll('.tv-layer')) : [];
  const content = veil ? veil.querySelector('.tv-content') : null;
  const heart = veil ? veil.querySelector('.tv-love-heart') : null;
  const heartPaths = veil ? Array.from(veil.querySelectorAll('.tv-heart-path')) : [];
  const orbits = veil ? Array.from(veil.querySelectorAll('.tv-love-orbit')) : [];
  const sparks = veil ? Array.from(veil.querySelectorAll('.tv-love-spark')) : [];
  const aura = veil ? veil.querySelector('.tv-love-aura') : null;
  const loveScene = veil ? veil.querySelector('.tv-love-scene') : null;
  const pointerHalo = veil ? veil.querySelector('.tv-pointer-halo') : null;
  const pointerTrails = veil ? Array.from(veil.querySelectorAll('.tv-pointer-trail')) : [];
  const pointerHearts = veil ? Array.from(veil.querySelectorAll('.tv-pointer-heart')) : [];
  let haloXTo = null;
  let haloYTo = null;
  let sceneXTo = null;
  let sceneYTo = null;
  let sceneRotationTo = null;
  let sceneTiltXTo = null;
  let sceneTiltYTo = null;
  const trailFollowers = [];
  const heartFollowers = [];
  let transitioning = false;

  if (g && !reduceMotion && pointerHalo && loveScene) {
    haloXTo = g.quickTo(pointerHalo, 'x', { duration: 0.24, ease: 'power3' });
    haloYTo = g.quickTo(pointerHalo, 'y', { duration: 0.24, ease: 'power3' });
    sceneXTo = g.quickTo(loveScene, 'x', { duration: 0.42, ease: 'power3' });
    sceneYTo = g.quickTo(loveScene, 'y', { duration: 0.42, ease: 'power3' });
    sceneRotationTo = g.quickTo(loveScene, 'rotation', { duration: 0.5, ease: 'power3' });
    sceneTiltXTo = g.quickTo(loveScene, 'rotationX', { duration: 0.54, ease: 'power3' });
    sceneTiltYTo = g.quickTo(loveScene, 'rotationY', { duration: 0.54, ease: 'power3' });

    pointerTrails.forEach((trail, index) => {
      trailFollowers.push({
        xTo: g.quickTo(trail, 'x', { duration: 0.18 + index * 0.08, ease: 'power3' }),
        yTo: g.quickTo(trail, 'y', { duration: 0.18 + index * 0.08, ease: 'power3' }),
      });
    });

    pointerHearts.forEach((heart, index) => {
      heartFollowers.push({
        xTo: g.quickTo(heart, 'x', { duration: 0.28 + index * 0.055, ease: 'power3' }),
        yTo: g.quickTo(heart, 'y', { duration: 0.28 + index * 0.055, ease: 'power3' }),
      });
    });
  }

  function primePointerRomance(x, y) {
    if (!g || reduceMotion || !veil || !loveScene) return;
    veil.dataset.pointerActive = 'false';
    g.set(loveScene, {
      x: 0,
      y: 0,
      rotation: 0,
      rotationX: 0,
      rotationY: 0,
      transformPerspective: 900,
    });
    g.set([pointerHalo, ...pointerTrails, ...pointerHearts], { x, y });
  }

  function followPointerRomance(event) {
    if (!transitioning || !g || reduceMotion || !veil || !loveScene) return;
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    const x = Math.min(width, Math.max(0, event.clientX));
    const y = Math.min(height, Math.max(0, event.clientY));
    const nx = x / width - 0.5;
    const ny = y / height - 0.5;

    veil.dataset.pointerActive = 'true';
    haloXTo?.(x);
    haloYTo?.(y);
    trailFollowers.forEach(({ xTo, yTo }) => {
      xTo(x);
      yTo(y);
    });
    heartFollowers.forEach(({ xTo, yTo }) => {
      xTo(x);
      yTo(y);
    });
    sceneXTo?.(nx * 22);
    sceneYTo?.(ny * 15);
    sceneRotationTo?.(nx * 1.4);
    sceneTiltXTo?.(-ny * 4);
    sceneTiltYTo?.(nx * 5.5);
  }

  document.addEventListener('pointermove', followPointerRomance, { passive: true });

  function navigateWithTransition(href, point) {
    if (transitioning) return;
    transitioning = true;
    if (veil) {
      const x = Number.isFinite(point?.x) ? point.x : window.innerWidth / 2;
      const y = Number.isFinite(point?.y) ? point.y : window.innerHeight * 0.46;
      veil.style.setProperty('--tv-origin-x', `${Math.max(0, x)}px`);
      veil.style.setProperty('--tv-origin-y', `${Math.max(0, y)}px`);
      primePointerRomance(x, y);
    }
    if (!g || reduceMotion) {
      if (veil) {
        veil.classList.add('is-on');
        veil.dataset.transitionState = 'blooming';
      }
      setTimeout(() => {
        window.location.href = href;
      }, reduceMotion ? 50 : 280);
      return;
    }
    try {
      sessionStorage.setItem('ut-page-transition', 'in');
    } catch {
      /* ignore */
    }
    veil.dataset.transitionState = 'blooming';
    g.set(veil, { autoAlpha: 1, pointerEvents: 'auto' });
    g.set([heart, aura, ...orbits], {
      xPercent: -50,
      yPercent: -50,
      transformOrigin: '50% 50%',
    });
    g.set(layers, { autoAlpha: 0, scale: 0.985 });
    g.set(aura, { autoAlpha: 0, scale: 0.34 });
    g.set(heart, { autoAlpha: 0.14, scale: 0.44, rotation: -4 });
    g.set(orbits, { autoAlpha: 0, scale: 0.36 });
    g.set(sparks, { autoAlpha: 0, scale: 0.2 });
    g.set(heartPaths, { strokeDashoffset: 1 });
    g.set(content, { autoAlpha: 0, y: 14 });
    const tl = g.timeline({
      onComplete: () => {
        window.location.href = href;
      },
    });
    tl.addLabel('heart-leave', 0)
      .to('.main, .side-nav, .mobile-nav', {
        autoAlpha: 0,
        y: -10,
        scale: 0.996,
        duration: 0.48,
        ease: 'power2.inOut',
      }, 'heart-leave')
      .to(layers, {
        autoAlpha: 1,
        scale: 1,
        duration: 0.68,
        ease: 'power2.out',
      }, 0.02)
      .to(aura, {
        autoAlpha: 0.9,
        scale: 1.12,
        duration: 0.72,
        ease: 'power2.out',
      }, 0.08)
      .to(heart, {
        autoAlpha: 1,
        scale: 1,
        rotation: 1,
        duration: 0.44,
        ease: 'power3.out',
      }, 0.08)
      .to(heartPaths, {
        strokeDashoffset: 0,
        duration: 0.62,
        stagger: 0.07,
        ease: 'power2.inOut',
      }, 0.14)
      .to(orbits, {
        autoAlpha: 0.88,
        scale: 1,
        rotation: '+=12',
        duration: 0.78,
        stagger: 0.06,
        ease: 'power2.out',
      }, 0.18)
      .to(sparks, {
        autoAlpha: 0.9,
        scale: 1,
        x: (index) => [-18, 15, 12, -14][index] || 0,
        y: (index) => [10, -14, 13, 8][index] || 0,
        duration: 0.58,
        stagger: 0.035,
        ease: 'power2.out',
      }, 0.26)
      .to(content, {
        autoAlpha: 1,
        y: 0,
        duration: 0.34,
        ease: 'power2.out',
      }, 0.42);
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a || !veil) return;
    const href = a.getAttribute('href') || '';
    if (
      !href ||
      href.startsWith('#') ||
      href.startsWith('http') ||
      href.startsWith('//') ||
      a.target === '_blank' ||
      a.hasAttribute('download') ||
      href.startsWith('/uploads/')
    ) {
      return;
    }
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigateWithTransition(href, { x: e.clientX, y: e.clientY });
  });
}

function initHearts() {
  const canvas = document.getElementById('heartsCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const colors = ['#c9707f', '#7c9a8b', '#7a9db9', '#d9a052'];
  let hearts = [];
  let w = 0;
  let h = 0;

  function resize() {
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawHeart(x, y, size, color, alpha, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    const s = size;
    ctx.beginPath();
    ctx.moveTo(0, s * 0.3);
    ctx.bezierCurveTo(s * 0.5, -s * 0.2, s * 0.9, s * 0.25, 0, s * 0.95);
    ctx.bezierCurveTo(-s * 0.9, s * 0.25, -s * 0.5, -s * 0.2, 0, s * 0.3);
    ctx.fill();
    ctx.restore();
  }

  function spawn() {
    hearts.push({
      x: Math.random() * w,
      y: -20,
      size: 8 + Math.random() * 14,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 0.25 + Math.random() * 0.4,
      vy: 0.6 + Math.random() * 1.4,
      sway: Math.random() * Math.PI * 2,
      swaySpeed: 0.4 + Math.random() * 1.2,
      rot: (Math.random() - 0.5) * 0.8,
    });
    if (hearts.length > 26) hearts.shift();
  }

  function tick() {
    ctx.clearRect(0, 0, w, h);
    for (let i = hearts.length - 1; i >= 0; i--) {
      const p = hearts[i];
      p.y += p.vy;
      p.sway += p.swaySpeed * 0.01;
      p.x += Math.sin(p.sway) * 0.35;
      drawHeart(p.x, p.y, p.size, p.color, p.alpha, p.rot);
      if (p.y > h + 30) hearts.splice(i, 1);
    }
    requestAnimationFrame(tick);
  }

  resize();
  setInterval(spawn, 380);
  window.addEventListener('resize', resize);
  tick();
}

function initGlassHeartExperience() {
  const canvas = document.querySelector('[data-glass-heart]');
  if (!canvas) return;
  import('./glass-heart.js')
    .then(({ initGlassHeart }) => initGlassHeart(canvas))
    .catch((error) => {
      const stage = canvas.closest('.glass-heart-stage');
      if (stage) {
        stage.dataset.heartReady = 'false';
        stage.classList.add('is-fallback');
      }
      console.warn('立体透明爱心已切换为静态模式', error);
    });
}

function initCountdowns() {
  $$('[data-countdown]').forEach((card) => {
    const target = Number(card.dataset.target || 0);
    const el = (name) => card.querySelector(`[data-${name}]`);
    const statusEl = card.querySelector('[data-cd-status]');
    const update = () => {
      const rawDiff = target - Date.now();
      const isPast = rawDiff < 0;
      const diff = Math.abs(rawDiff);
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      el('days').textContent = days;
      el('hours').textContent = hours;
      el('mins').textContent = mins;
      el('secs').textContent = secs;
      card.classList.toggle('is-past', isPast);
      if (statusEl) statusEl.textContent = isPast ? '已经过去' : '距离目标';
    };
    update();
    setInterval(update, 1000);
  });
}

function promptPassword(title, subtitle) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `<div class="modal-card">
      <h3>${title}</h3>
      <p style="color:var(--muted);margin:0 0 14px">${subtitle}</p>
      <form>
        <label class="field"><span>密码</span><input class="input" type="password" required autofocus></label>
        <div style="display:flex;gap:10px;justify-content:flex-end">
          <button type="button" class="btn btn-ghost" data-cancel>取消</button>
          <button type="submit" class="btn btn-primary">确认</button>
        </div>
      </form>
    </div>`;
    document.body.appendChild(backdrop);
    const input = backdrop.querySelector('input');
    input.focus();
    const close = (val) => {
      backdrop.remove();
      resolve(val);
    };
    backdrop.querySelector('[data-cancel]').addEventListener('click', () => close(null));
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close(null);
    });
    backdrop.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      close(input.value);
    });
  });
}

async function ensureAdmin() {
  const check = await apiJson('GET', '/api/auth/status');
  if (check.status === 200 && check.data.admin) return true;
  const password = await promptPassword('管理员验证', '请输入管理员密码以继续');
  if (!password) return false;
  const res = await apiJson('POST', '/api/auth/admin', { password });
  return res.status === 200 && res.data.ok;
}

// ---------------- 鼠标驱动的玻璃波动 ----------------
const GLASS_SELECTOR = [
  '.hero',
  '.page-head',
  '.lock-panel',
  '.music-panel',
  '.admin-body',
  '.admin-panel',
  '.countdown-card',
  '.timeline-card',
  '.player',
].join(',');

function enhanceGlass(root = document) {
  root.querySelectorAll(GLASS_SELECTOR).forEach((el) => {
    el.classList.add('glass-reactive');
    const hasSheen = Array.from(el.children).some((c) =>
      c.classList && c.classList.contains('glass-sheen')
    );
    if (!hasSheen) {
      const sheen = document.createElement('span');
      sheen.className = 'glass-sheen';
      sheen.setAttribute('aria-hidden', 'true');
      el.prepend(sheen);
    }
  });
}

function initGlassMotion() {
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  enhanceGlass();
  window.enhanceGlass = enhanceGlass;
  if (!finePointer || reduceMotion) return;

  let active = null;
  let raf = 0;
  let pendingEvent = null;

  function reset(el) {
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
    el.classList.remove('is-sheened');
  }

  function apply() {
    raf = 0;
    const e = pendingEvent;
    if (!e) return;
    const vw = window.innerWidth || 1;
    const vh = window.innerHeight || 1;
    const bgX = (e.clientX / vw - 0.5) * -12;
    const bgY = (e.clientY / vh - 0.5) * -8;
    document.documentElement.style.setProperty('--bgx', `${bgX.toFixed(2)}px`);
    document.documentElement.style.setProperty('--bgy', `${bgY.toFixed(2)}px`);

    const el = e.target.closest && e.target.closest(GLASS_SELECTOR);
    if (el !== active) {
      reset(active);
      active = el;
    }
    if (!active) return;

    const rect = active.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const px = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    const py = Math.min(Math.max((e.clientY - rect.top) / rect.height, 0), 1);
    const large = active.matches('.hero, .page-head, .admin-body, .music-panel');
    const strength = large ? 1.15 : 2.1;

    active.style.setProperty('--gx', `${(px * 100).toFixed(2)}%`);
    active.style.setProperty('--gy', `${(py * 100).toFixed(2)}%`);
    active.style.setProperty('--ry', `${((px - 0.5) * strength * 2).toFixed(2)}deg`);
    active.style.setProperty('--rx', `${((0.5 - py) * strength * 2).toFixed(2)}deg`);
    active.classList.add('is-sheened');
  }

  document.addEventListener(
    'pointermove',
    (e) => {
      pendingEvent = e;
      if (!raf) raf = requestAnimationFrame(apply);
    },
    { passive: true }
  );

  document.addEventListener('pointerleave', () => {
    reset(active);
    active = null;
    document.documentElement.style.removeProperty('--bgx');
    document.documentElement.style.removeProperty('--bgy');
  });
}

// ---------------- 全局动态美化 ----------------
function initMotionPolish() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // 滚动显现
  const revealTargets = $$('.section-head, .countdown-card, .music-panel, .empty-panel');
  if (window.gsap && !reduceMotion) {
    revealTargets.forEach((el) => el.classList.add('is-revealed'));
  } else {
    revealTargets.forEach((el, i) => {
      el.classList.add('motion-reveal');
      el.style.setProperty('--reveal-delay', `${Math.min(i * 55, 330)}ms`);
    });
    if (reduceMotion || !('IntersectionObserver' in window)) {
      revealTargets.forEach((el) => el.classList.add('is-revealed'));
    } else {
      const revealObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-revealed');
            revealObserver.unobserve(entry.target);
          });
        },
        { threshold: 0.1, rootMargin: '0px 0px -6% 0px' }
      );
      revealTargets.forEach((el) => revealObserver.observe(el));
    }
  }

  // 数字增长
  const dayNumber = document.querySelector('.hero-days-num');
  if (dayNumber && !reduceMotion) {
    const target = Number.parseInt(dayNumber.textContent, 10);
    if (Number.isFinite(target) && target > 0) {
      const start = performance.now();
      const duration = 1200;
      const tick = (now) => {
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        dayNumber.textContent = String(Math.round(target * eased));
        if (p < 1) requestAnimationFrame(tick);
      };
      dayNumber.textContent = '0';
      requestAnimationFrame(tick);
    }
  }

  if (!finePointer || reduceMotion) return;

  // 磁吸按钮
  document.addEventListener('pointermove', (e) => {
    const btn = e.target.closest('.btn, .icon-btn, .admin-tab, .galaxy-btn, .nav-link');
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) * 0.14;
    const y = (e.clientY - rect.top - rect.height / 2) * 0.14;
    btn.style.setProperty('--mag-x', `${x.toFixed(2)}px`);
    btn.style.setProperty('--mag-y', `${y.toFixed(2)}px`);
  }, { passive: true });

  document.addEventListener('pointerout', (e) => {
    const btn = e.target.closest && e.target.closest('.btn, .icon-btn, .admin-tab, .galaxy-btn, .nav-link');
    if (!btn || btn.contains(e.relatedTarget)) return;
    btn.style.removeProperty('--mag-x');
    btn.style.removeProperty('--mag-y');
  }, { passive: true });

  // 侧边导航聚光
  const nav = document.querySelector('.side-nav');
  if (nav) {
    nav.addEventListener('pointermove', (e) => {
      const rect = nav.getBoundingClientRect();
      nav.style.setProperty('--nav-x', `${e.clientX - rect.left}px`);
      nav.style.setProperty('--nav-y', `${e.clientY - rect.top}px`);
      nav.classList.add('is-lit');
    }, { passive: true });
    nav.addEventListener('pointerleave', () => nav.classList.remove('is-lit'));
  }
}

// ---------------- Liquid Metal controls ----------------
function initLiquidMetalButtons() {
  if (window.__liquidMetalReady) return;
  window.__liquidMetalReady = true;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const selector = 'button:not(.timeline-photo):not(.liquid-metal), a.btn:not(.liquid-metal)';

  function enhance(root = document) {
    const elements = [];
    if (root.nodeType === 1 && root.matches && root.matches(selector)) elements.push(root);
    if (root.querySelectorAll) elements.push(...root.querySelectorAll(selector));
    elements.forEach((element) => {
      element.classList.add('liquid-metal');
      element.style.setProperty('--lm-x', '50%');
      element.style.setProperty('--lm-y', '50%');
      element.style.setProperty('--lm-rx', '0deg');
      element.style.setProperty('--lm-ry', '0deg');
    });
  }

  enhance(document);
  window.enhanceLiquidButtons = enhance;

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) enhance(node);
      });
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });

  let active = null;
  let frame = 0;
  let pending = null;

  document.addEventListener('pointermove', (event) => {
    const button = event.target.closest && event.target.closest('.liquid-metal');
    if (!button || button.disabled) return;
    pending = { button, x: event.clientX, y: event.clientY };
    if (!frame) {
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!pending) return;
        const { button: target, x, y } = pending;
        const rect = target.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const px = Math.min(1, Math.max(0, (x - rect.left) / rect.width));
        const py = Math.min(1, Math.max(0, (y - rect.top) / rect.height));
        target.style.setProperty('--lm-x', `${(px * 100).toFixed(2)}%`);
        target.style.setProperty('--lm-y', `${(py * 100).toFixed(2)}%`);
        if (!reduceMotion) {
          target.style.setProperty('--lm-ry', `${((px - 0.5) * 10).toFixed(2)}deg`);
          target.style.setProperty('--lm-rx', `${((0.5 - py) * 8).toFixed(2)}deg`);
        }
        if (active !== target) {
          if (active) active.classList.remove('is-liquid-active');
          active = target;
          active.classList.add('is-liquid-active');
        }
      });
    }
  }, { passive: true });

  document.addEventListener('pointerout', (event) => {
    const button = event.target.closest && event.target.closest('.liquid-metal');
    if (!button || button.contains(event.relatedTarget)) return;
    button.classList.remove('is-liquid-active');
    button.style.setProperty('--lm-x', '50%');
    button.style.setProperty('--lm-y', '50%');
    button.style.setProperty('--lm-rx', '0deg');
    button.style.setProperty('--lm-ry', '0deg');
    if (active === button) active = null;
  }, { passive: true });

  document.addEventListener('pointerdown', (event) => {
    const button = event.target.closest && event.target.closest('.liquid-metal');
    if (!button || button.disabled || reduceMotion) return;
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.65;
    const ripple = document.createElement('span');
    ripple.className = 'liquid-ripple';
    ripple.setAttribute('aria-hidden', 'true');
    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;
    ripple.style.left = `${event.clientX - rect.left}px`;
    ripple.style.top = `${event.clientY - rect.top}px`;
    button.appendChild(ripple);
    if (window.gsap) {
      window.gsap.fromTo(
        ripple,
        { xPercent: -50, yPercent: -50, scale: 0, opacity: 0.72 },
        {
          scale: 1,
          opacity: 0,
          duration: 0.72,
          ease: 'power2.out',
          onComplete: () => ripple.remove(),
        }
      );
    } else {
      ripple.classList.add('is-css');
      ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
    }
  }, { passive: true });
}

// ---------------- 相册：心形 3D 照片星云 ----------------
function initAlbumGalaxy() {
  const galaxy = document.getElementById('photoGalaxy');
  const stage = document.getElementById('galaxyStage');
  if (!galaxy || !stage) return;
  const cards = Array.from(stage.querySelectorAll('.galaxy-photo'));
  if (!cards.length) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const heartNodes = [];

  const state = {
    rotX: -4,
    rotY: 0,
    targetX: -4,
    targetY: 0,
    zoom: 1,
    targetZoom: 1,
    dragging: false,
    startX: 0,
    startY: 0,
    startRotX: -4,
    startRotY: 0,
    moved: 0,
    pinchStart: 0,
    pinchZoom: 1,
  };
  const pointers = new Map();

  function hash(value) {
    let x = Math.imul(value || 1, 2654435761);
    x ^= x >>> 15;
    return Math.abs(x);
  }

  function createHearts() {
    const layer = document.createElement('div');
    layer.className = 'galaxy-hearts';
    for (let i = 0; i < 20; i++) {
      const node = document.createElement('span');
      node.className = 'galaxy-heart';
      layer.appendChild(node);
      heartNodes.push({ node, h: hash(i + 97) });
    }
    stage.prepend(layer);
  }

  function layout() {
    const width = stage.clientWidth || galaxy.clientWidth;
    const height = stage.clientHeight || galaxy.clientHeight;
    const spreadX = Math.min(width * 0.37, 540);
    const spreadY = Math.min(height * 0.36, 330);
    const total = cards.length;

    cards.forEach((card, i) => {
      const t = (i / total) * Math.PI * 2 + Math.PI / 2;
      const hx = 16 * Math.pow(Math.sin(t), 3);
      const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      const h = hash(Number(card.dataset.id) || i + 1);
      const onOutline = i % 2 === 0 || total < 7;
      const radius = total < 4 ? 0.18 : onOutline ? 1 : 0.42 + ((h % 100) / 100) * 0.48;
      const jitterX = onOutline ? ((h % 9) - 4) * 2.1 : ((h % 23) - 11) * 2.8;
      const jitterY = onOutline ? (((h >> 4) % 9) - 4) * 1.8 : (((h >> 7) % 23) - 11) * 2.4;
      const x = (hx / 17) * spreadX * radius + jitterX;
      const y = (-hy / 17) * spreadY * radius + jitterY;
      const z = onOutline ? -120 + (h % 360) : -540 + (h % 760);
      const scale = 0.78 + ((z + 560) / 1320) * 0.32;
      const blur = z < -360 ? 0.8 : z < -160 ? 0.35 : 0;

      card.style.setProperty('--x', `${x.toFixed(1)}px`);
      card.style.setProperty('--y', `${y.toFixed(1)}px`);
      card.style.setProperty('--z', `${z.toFixed(0)}px`);
      card.style.setProperty('--ry', `${((h % 28) - 14).toFixed(1)}deg`);
      card.style.setProperty('--rz', `${((((h >> 3) % 16) - 8) * 0.8).toFixed(1)}deg`);
      card.style.setProperty('--s', scale.toFixed(2));
      card.style.setProperty('--blur', `${blur.toFixed(2)}px`);
      card.style.zIndex = String(600 + Math.round(z));
      card.style.opacity = String(0.68 + ((z + 560) / 1320) * 0.32);
    });

    heartNodes.forEach(({ node, h }, i) => {
      const t = (i / heartNodes.length) * Math.PI * 2;
      const hx = 16 * Math.pow(Math.sin(t), 3);
      const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      const radius = 0.32 + ((h % 100) / 100) * 0.72;
      node.style.setProperty('--hx', `${((hx / 17) * spreadX * radius).toFixed(1)}px`);
      node.style.setProperty('--hy', `${((-hy / 17) * spreadY * radius).toFixed(1)}px`);
      node.style.setProperty('--hz', `${(-640 + (h % 680)).toFixed(0)}px`);
      node.style.setProperty('--hs', `${(5 + (h % 8)).toFixed(0)}px`);
      node.style.setProperty('--hr', `${((h % 60) - 30).toFixed(0)}deg`);
      node.style.opacity = String(0.12 + ((h % 100) / 100) * 0.24);
    });
  }

  cards.forEach((card) => {
    const img = card.querySelector('img');
    if (!img) return;
    const updateShape = () => {
      const ratio = img.naturalWidth / (img.naturalHeight || 1);
      card.classList.toggle('is-portrait', ratio < 0.88);
      card.classList.toggle('is-wide', ratio > 1.35);
    };
    if (img.complete) updateShape();
    else img.addEventListener('load', updateShape, { once: true });
  });

  function clampZoom(value) {
    return Math.min(1.6, Math.max(0.62, value));
  }

  function startDrag(e) {
    if (e.target.closest('.galaxy-btn')) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      state.dragging = true;
      state.startX = e.clientX;
      state.startY = e.clientY;
      state.startRotX = state.targetX;
      state.startRotY = state.targetY;
      state.moved = 0;
    } else if (pointers.size === 2) {
      const pts = Array.from(pointers.values());
      state.pinchStart = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
      state.pinchZoom = state.targetZoom;
      state.dragging = false;
    }
  }

  function moveDrag(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2 && state.pinchStart) {
      const pts = Array.from(pointers.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      state.targetZoom = clampZoom(state.pinchZoom * (dist / state.pinchStart));
      window.__suppressPhotoClick = Date.now() + 350;
      return;
    }
    if (!state.dragging) return;
    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    state.moved = Math.max(state.moved, Math.hypot(dx, dy));
    state.targetY = state.startRotY + dx * 0.22;
    state.targetX = Math.min(20, Math.max(-20, state.startRotX - dy * 0.16));
    if (state.moved > 6) window.__suppressPhotoClick = Date.now() + 350;
    galaxy.classList.add('is-dragging');
  }

  function endDrag(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) state.pinchStart = 0;
    if (pointers.size === 0) {
      state.dragging = false;
      galaxy.classList.remove('is-dragging');
    }
  }

  galaxy.addEventListener('pointerdown', startDrag);
  window.addEventListener('pointermove', moveDrag);
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);
  galaxy.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      state.targetZoom = clampZoom(state.targetZoom - e.deltaY * 0.0009);
    },
    { passive: false }
  );

  galaxy.querySelectorAll('[data-galaxy-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.galaxyAction;
      if (action === 'zoom-in') state.targetZoom = clampZoom(state.targetZoom + 0.14);
      if (action === 'zoom-out') state.targetZoom = clampZoom(state.targetZoom - 0.14);
      if (action === 'reset') {
        state.targetX = -4;
        state.targetY = Math.round(state.targetY / 360) * 360;
        state.targetZoom = 1;
      }
    });
  });

  function frame() {
    if (!state.dragging && pointers.size === 0 && !reduceMotion) {
      state.targetY += 0.012;
    }
    state.rotX += (state.targetX - state.rotX) * 0.075;
    state.rotY += (state.targetY - state.rotY) * 0.075;
    state.zoom += (state.targetZoom - state.zoom) * 0.09;
    stage.style.transform = `translate3d(0, 0, 0) rotateX(${state.rotX.toFixed(
      3
    )}deg) rotateY(${state.rotY.toFixed(3)}deg) scale(${state.zoom.toFixed(3)})`;
    requestAnimationFrame(frame);
  }

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layout, 140);
  });

  createHearts();
  layout();
  galaxy.classList.add('is-ready');
  frame();
}

function initLightbox() {
  const photos = $$('[data-photo]');
  if (!photos.length) return;
  let current = 0;
  const box = document.createElement('div');
  box.className = 'lightbox';
  box.hidden = true;
  box.innerHTML = `<button class="lightbox-close">${ic('x', 22)}</button>
    <button class="lightbox-prev">${ic('arrowLeft', 22)}</button>
    <img alt="">
    <button class="lightbox-next">${ic('arrowRight', 22)}</button>`;
  document.body.appendChild(box);
  const img = box.querySelector('img');

  function show(i) {
    current = (i + photos.length) % photos.length;
    const p = photos[current];
    img.src = p.querySelector('img').src;
    img.alt = p.querySelector('img').alt;
    box.hidden = false;
  }
  function close() {
    box.hidden = true;
  }

  photos.forEach((p, i) =>
    p.addEventListener('click', () => {
      if (Date.now() < (window.__suppressPhotoClick || 0)) return;
      show(i);
    })
  );
  box.querySelector('.lightbox-close').addEventListener('click', close);
  box.querySelector('.lightbox-prev').addEventListener('click', () => show(current - 1));
  box.querySelector('.lightbox-next').addEventListener('click', () => show(current + 1));
  box.addEventListener('click', (e) => {
    if (e.target === box) close();
  });
  document.addEventListener('keydown', (e) => {
    if (box.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') show(current - 1);
    if (e.key === 'ArrowRight') show(current + 1);
  });
}

function initAlbum() {
  const unlockForm = document.getElementById('albumUnlockForm');
  if (unlockForm) {
    unlockForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const password = document.getElementById('albumPassword').value;
      const { status, data } = await apiJson('POST', '/api/auth/album', { password });
      if (status === 200 && data.ok) {
        window.location.reload();
      } else {
        document.getElementById('albumUnlockMsg').textContent = data.error || '解锁失败，请重试';
      }
    });
  }

  initLightbox();
  initAlbumGalaxy();

  const btn = document.getElementById('albumUploadBtn');
  const input = document.getElementById('albumFileInput');
  if (btn && input) {
    btn.addEventListener('click', async () => {
      const ok = await ensureAdmin();
      if (!ok) return;
      input.click();
    });
    input.addEventListener('change', async () => {
      const files = Array.from(input.files || []);
      for (const file of files) {
        await uploadRaw('/api/photos', file, { caption: '' });
      }
      window.location.reload();
    });
  }
}

function initMusic() {
  const tracks = $$('[data-track]');
  if (!tracks.length) return;
  const audio = new Audio();
  let current = null;

  const player = document.createElement('div');
  player.className = 'player';
  player.hidden = true;
  player.innerHTML = `<button class="player-play">${ic('play', 20)}</button>
    <div class="player-info">
      <span class="player-title"></span>
      <div class="player-progress">
        <span data-cur>0:00</span>
        <input type="range" min="0" max="100" value="0">
        <span data-dur>0:00</span>
      </div>
    </div>`;
  document.body.appendChild(player);

  const playBtn = player.querySelector('.player-play');
  const titleEl = player.querySelector('.player-title');
  const range = player.querySelector('input[type="range"]');
  const curEl = player.querySelector('[data-cur]');
  const durEl = player.querySelector('[data-dur]');

  function fmt(sec) {
    if (!Number.isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function markPlaying(li, playing) {
    if (current) {
      current.classList.remove('is-current');
      current.classList.remove('is-playing');
    }
    current = li;
    li.classList.add('is-current');
    li.classList.toggle('is-playing', playing);
    li.querySelector('[data-play]').innerHTML = ic(playing ? 'pause' : 'play', 18);
    playBtn.innerHTML = ic(playing ? 'pause' : 'play', 20);
  }

  function load(li) {
    if (current === li) {
      if (audio.paused) {
        audio.play();
      } else {
        audio.pause();
      }
      markPlaying(li, !audio.paused);
      return;
    }
    markPlaying(li, true);
    audio.src = li.dataset.src;
    audio.play();
    titleEl.textContent = li.dataset.title || '未命名';
    player.hidden = false;
  }

  tracks.forEach((li) => {
    li.querySelector('[data-play]').addEventListener('click', () => load(li));
  });

  audio.addEventListener('loadedmetadata', () => {
    durEl.textContent = fmt(audio.duration);
    const d = current && current.querySelector('[data-dur]');
    if (d) d.textContent = fmt(audio.duration);
    range.max = Math.floor(audio.duration || 0);
  });
  audio.addEventListener('timeupdate', () => {
    curEl.textContent = fmt(audio.currentTime);
    if (audio.duration) range.value = Math.floor(audio.currentTime);
  });
  audio.addEventListener('play', () => {
    if (current) markPlaying(current, true);
  });
  audio.addEventListener('pause', () => {
    if (current) markPlaying(current, false);
  });
  audio.addEventListener('ended', () => {
    const idx = tracks.indexOf(current);
    const next = tracks[(idx + 1) % tracks.length];
    if (next) load(next);
  });
  playBtn.addEventListener('click', () => {
    if (current) load(current);
  });
  range.addEventListener('input', () => {
    if (audio.duration) audio.currentTime = Number(range.value);
  });
}

function initMusicSearch() {
  const form = document.getElementById('musicSearchForm');
  const input = document.getElementById('musicSearchInput');
  const resultsEl = document.getElementById('musicSearchResults');
  const sourceNote = document.getElementById('musicSearchSourceNote');
  const sourceButtons = $$('.search-source');
  if (!form || !input || !resultsEl) return;

  const audio = new Audio();
  let results = [];
  let activeCard = null;
  let ignorePauseUntil = 0;
  let searchSource = 'netease';

  function setPlayButton(card, playing) {
    const btn = card.querySelector('[data-search-play]');
    if (btn) btn.innerHTML = ic(playing ? 'pause' : 'play', 16);
    card.classList.toggle('is-playing', playing);
  }

  function cardHtml(track, index) {
    const art = track.artwork
      ? `<img class="search-art" src="${escapeHtml(track.artwork)}" alt="" loading="lazy">`
      : `<span class="search-art"></span>`;
    const isEmbed = track.playMode === 'embed' || !track.streamUrl;
    return `<article class="search-card" data-search-card data-index="${index}"
      data-stream="${escapeHtml(track.streamUrl)}"
      data-embed="${escapeHtml(track.embedUrl || '')}"
      data-source="${escapeHtml(track.source || '')}"
      data-id="${escapeHtml(track.id)}"
      data-title="${escapeHtml(track.title)}"
      data-artist="${escapeHtml(track.artist)}"
      data-external="${escapeHtml(track.externalUrl || '')}">
      ${art}
      <div class="search-main">
        <div class="search-title">${escapeHtml(track.title)}</div>
        <div class="search-artist">${escapeHtml(track.artist)}${track.genre ? ` · ${escapeHtml(track.genre)}` : ''}</div>
      </div>
      <div class="search-actions">
        <button class="search-play" data-search-play title="${isEmbed ? '播放' : '试听'}" aria-label="${isEmbed ? '播放' : '试听'} ${escapeHtml(track.title)}">${ic('play', 16)}</button>
        <button class="search-add" data-search-add title="加入歌单">${ic('plus', 13)}<span>加入歌单</span></button>
      </div>
      ${isEmbed ? '<div class="search-embed" hidden></div>' : ''}
    </article>`;
  }

  async function search() {
    const q = input.value.trim();
    if (q.length < 2) {
      resultsEl.innerHTML = '<div class="search-state">请输入至少 2 个字符</div>';
      return;
    }
    resultsEl.innerHTML = '<div class="search-state">正在搜索音乐…</div>';
    const res = await apiJson(
      'GET',
      `/api/music/search?source=${encodeURIComponent(searchSource)}&q=${encodeURIComponent(q)}&limit=12`
    );
    if (res.status !== 200 || !res.data.ok) {
      resultsEl.innerHTML = `<div class="search-state">${escapeHtml(res.data.error || '搜索暂不可用，请稍后再试')}</div>`;
      return;
    }
    results = res.data.data || [];
    if (!results.length) {
      resultsEl.innerHTML = '<div class="search-state">没有找到匹配的音乐</div>';
      return;
    }
    resultsEl.innerHTML = results.map(cardHtml).join('');
    if (window.gsap) {
      window.gsap.from(resultsEl.querySelectorAll('.search-card'), {
        y: 16,
        autoAlpha: 0,
        duration: 0.46,
        stagger: 0.045,
        ease: 'power3.out',
        overwrite: 'auto',
      });
      window.ScrollTrigger?.refresh();
    }
  }

  function closeEmbed(card) {
    if (!card) return;
    const embed = card.querySelector('.search-embed');
    if (embed) {
      embed.hidden = true;
      embed.innerHTML = '';
    }
    setPlayButton(card, false);
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    search();
  });

  sourceButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      searchSource = btn.dataset.searchSource || 'netease';
      sourceButtons.forEach((item) =>
        item.classList.toggle('is-active', item.dataset.searchSource === searchSource)
      );
      if (sourceNote) {
        sourceNote.textContent =
          searchSource === 'netease'
            ? '官方播放器 · 中文曲库'
            : '官方 30 秒试听 · 全球曲库';
      }
      input.placeholder =
        searchSource === 'netease'
          ? '搜索网易云歌曲、歌手'
          : '搜索 Apple Music 歌曲、歌手';
      if (input.value.trim().length >= 2) search();
    });
  });

  resultsEl.addEventListener('click', async (e) => {
    const card = e.target.closest('[data-search-card]');
    if (!card) return;
    if (e.target.closest('[data-search-add]')) {
      const ok = await ensureAdmin();
      if (!ok) return;
      const payload =
        card.dataset.source === 'netease'
          ? {
              source: 'netease',
              url: card.dataset.external,
              title: card.dataset.title,
              artist: card.dataset.artist,
            }
          : {
              source: 'itunes',
              id: card.dataset.id,
              title: card.dataset.title,
              artist: card.dataset.artist,
              previewUrl: card.dataset.stream,
              externalUrl: card.dataset.external,
            };
      const res = await apiJson('POST', '/api/tracks/import', payload);
      if (res.status === 201) {
        const btn = card.querySelector('[data-search-add]');
        btn.innerHTML = `${ic('check', 13)}<span>已加入</span>`;
        btn.disabled = true;
        flashNotice('已加入情侣歌单');
      } else {
        flashNotice(res.data.error || '加入歌单失败');
      }
      return;
    }
    if (e.target.closest('[data-search-play]')) {
      if (card.dataset.source === 'netease') {
        const embed = card.querySelector('.search-embed');
        if (!embed) return;
        if (activeCard === card && !embed.hidden) {
          closeEmbed(card);
          return;
        }
        if (activeCard && activeCard !== card) {
          if (activeCard.dataset.source === 'netease') closeEmbed(activeCard);
          else setPlayButton(activeCard, false);
        }
        audio.pause();
        activeCard = card;
        embed.innerHTML = `<iframe src="${escapeHtml(card.dataset.embed)}" loading="lazy" allow="autoplay" title="${escapeHtml(card.dataset.title)}"></iframe>`;
        embed.hidden = false;
        setPlayButton(card, true);
        return;
      }
      if (activeCard === card && !audio.paused) {
        audio.pause();
        return;
      }
      if (activeCard && activeCard !== card) {
        if (activeCard.dataset.source === 'netease') closeEmbed(activeCard);
        else setPlayButton(activeCard, false);
      }
      activeCard = card;
      ignorePauseUntil = Date.now() + 900;
      audio.src = card.dataset.stream;
      try {
        await audio.play();
        setPlayButton(card, true);
      } catch {
        setPlayButton(card, false);
        flashNotice('无法播放这首音乐，请重试');
      }
    }
  });

  audio.addEventListener('pause', () => {
    if (activeCard && Date.now() > ignorePauseUntil) setPlayButton(activeCard, false);
  });
  audio.addEventListener('play', () => {
    if (activeCard) setPlayButton(activeCard, true);
  });
  audio.addEventListener('ended', () => {
    if (activeCard) setPlayButton(activeCard, false);
  });
}

function initTimeline() {
  const unlockForm = document.getElementById('timelineUnlockForm');
  if (unlockForm) {
    unlockForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const password = document.getElementById('timelinePassword').value;
      const { status, data } = await apiJson('POST', '/api/auth/album', { password });
      if (status === 200 && data.ok) {
        window.location.reload();
      } else {
        document.getElementById('timelineUnlockMsg').textContent = data.error || '解锁失败，请重试';
      }
    });
    return;
  }

  initLightbox();
  const events = $$('.timeline-event');
  const timeline = document.getElementById('timelineList');
  const progress = timeline && timeline.querySelector('.timeline-progress');
  if (timeline && progress) {
    let ticking = false;
    const updateProgress = () => {
      ticking = false;
      const rect = timeline.getBoundingClientRect();
      const focus = window.innerHeight * 0.58;
      const value = Math.min(1, Math.max(0, (focus - rect.top) / Math.max(rect.height, 1)));
      progress.style.height = `${(value * 100).toFixed(2)}%`;
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(updateProgress);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    updateProgress();
  }
  if (!events.length) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (window.gsap && !reduceMotion) {
    events.forEach((el) => el.classList.add('is-visible'));
    return;
  }
  if (reduceMotion || !('IntersectionObserver' in window)) {
    events.forEach((el) => el.classList.add('is-visible'));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.16, rootMargin: '0px 0px -8% 0px' }
  );
  events.forEach((el) => observer.observe(el));
}

// ---------------- 管理后台 ----------------
function initAdmin() {
  const body = document.getElementById('adminBody');
  if (!body) return;

  const d = pageData();
  const state = {
    settings: d.settings || {},
    countdowns: d.countdowns || [],
    photos: d.photos || [],
    tracks: d.tracks || [],
    backgrounds: d.backgrounds || {},
    timeline: d.timeline || [],
    musicSource: 'local',
    storageName: d.storageName || 'local',
    copy: d.copy || {},
  };

  const tabs = $$('.admin-tab');
  let currentTab = 'countdown';

  function render(key) {
    currentTab = key;
    tabs.forEach((t) => t.classList.toggle('is-active', t.dataset.tab === key));
    const renderers = {
      countdown: renderCountdown,
      photos: renderPhotos,
      timeline: renderTimeline,
      music: renderMusic,
      background: renderBackground,
      copy: renderCopy,
      settings: renderSettings,
    };
    body.innerHTML = renderers[key](state);
    window.enhanceGlass?.(body);
    if (window.gsap) {
      window.gsap.from(body.children, {
        y: 18,
        autoAlpha: 0,
        duration: 0.48,
        stagger: 0.05,
        ease: 'power3.out',
        overwrite: 'auto',
      });
    }
  }

  tabs.forEach((t) => t.addEventListener('click', () => render(t.dataset.tab)));

  // 事件委托：统一处理按钮点击
  body.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = Number(btn.dataset.id || 0);
    const page = btn.dataset.page || '';

    if (action === 'delete-countdown') {
      if (!(await ensureAdmin())) return;
      await apiJson('DELETE', `/api/countdowns/${id}`);
      state.countdowns = state.countdowns.filter((c) => c.id !== id);
      render('countdown');
    }
    if (action === 'delete-photo') {
      if (!(await ensureAdmin())) return;
      await apiJson('DELETE', `/api/photos/${id}`);
      state.photos = state.photos.filter((p) => p.id !== id);
      render('photos');
    }
    if (action === 'delete-timeline') {
      if (!(await ensureAdmin())) return;
      await apiJson('DELETE', `/api/timeline/${id}`);
      state.timeline = state.timeline.filter((e) => e.id !== id);
      render('timeline');
    }
    if (action === 'delete-timeline-photo') {
      if (!(await ensureAdmin())) return;
      const eventId = Number(btn.dataset.event || 0);
      await apiJson('DELETE', `/api/timeline/photos/${id}`);
      const event = state.timeline.find((e) => e.id === eventId);
      if (event) event.photos = event.photos.filter((p) => p.id !== id);
      render('timeline');
    }
    if (action === 'timeline-upload') {
      if (!(await ensureAdmin())) return;
      document.getElementById(`timelineInput-${id}`).click();
    }
    if (action === 'delete-track') {
      if (!(await ensureAdmin())) return;
      await apiJson('DELETE', `/api/tracks/${id}`);
      state.tracks = state.tracks.filter((t) => t.id !== id);
      render('music');
    }
    if (action === 'pick-photo') {
      if (!(await ensureAdmin())) return;
      document.getElementById('adminPhotoInput').click();
    }
    if (action === 'pick-track') {
      if (!(await ensureAdmin())) return;
      document.getElementById('adminTrackInput').click();
    }
    if (action === 'music-source') {
      state.musicSource = btn.dataset.source || 'local';
      render('music');
    }
    if (action === 'import-track') {
      if (!(await ensureAdmin())) return;
      const source = btn.dataset.source || '';
      const url = document.getElementById(`${source}Link`)?.value || '';
      const title = document.getElementById(`${source}Title`)?.value || '';
      const artist = document.getElementById(`${source}Artist`)?.value || '';
      const res = await apiJson('POST', '/api/tracks/import', { source, url, title, artist });
      if (res.status === 201) {
        state.tracks.push(res.data);
        render('music');
        flashNotice(source === 'netease' ? '网易云音乐已导入' : 'QQ 音乐已导入');
      } else {
        alert(res.data.error || '导入失败');
      }
    }
    if (action === 'pick-bg') {
      if (!(await ensureAdmin())) return;
      document.getElementById(`bgInput-${page}`).click();
    }
    if (action === 'set-bg-color') {
      if (!(await ensureAdmin())) return;
      const color = document.getElementById(`bgColor-${page}`).value;
      const res = await apiJson('POST', `/api/backgrounds/${page}`, { type: 'color', color });
      if (res.status === 200) {
        state.backgrounds[page] = res.data;
        render('background');
      }
    }
  });

  // 文件上传变更
  body.addEventListener('change', async (e) => {
    const input = e.target;
    if (input.id === 'adminPhotoInput') {
      const files = Array.from(input.files || []);
      for (const file of files) {
        const res = await uploadRaw('/api/photos', file, { caption: '' });
        if (res.status === 201) state.photos.unshift(res.data);
      }
      render('photos');
    }
    if (input.id === 'adminTrackInput') {
      const file = input.files && input.files[0];
      if (!file) return;
      const title = document.getElementById('trackTitle')?.value || '';
      const artist = document.getElementById('trackArtist')?.value || '';
      const res = await uploadRaw('/api/tracks', file, { title, artist });
      if (res.status === 201) {
        state.tracks.push(res.data);
        render('music');
      }
    }
    if (input.id && input.id.startsWith('timelineInput-')) {
      const eventId = Number(input.dataset.event || 0);
      const files = Array.from(input.files || []);
      const event = state.timeline.find((e) => e.id === eventId);
      for (const file of files) {
        const res = await uploadRaw(`/api/timeline/${eventId}/photos`, file, { alt: file.name });
        if (res.status === 201 && event) event.photos.push(res.data);
      }
      render('timeline');
    }
    if (input.id && input.id.startsWith('bgInput-')) {
      const page = input.dataset.page;
      const file = input.files && input.files[0];
      if (!file) return;
      const res = await uploadRaw(`/api/backgrounds/${page}`, file);
      if (res.status === 200) {
        state.backgrounds[page] = res.data;
        render('background');
      }
    }
  });

  // 表单提交（添加倒计时 / 保存设置）
  body.addEventListener('submit', async (e) => {
    const form = e.target;
    if (form.id === 'cdForm') {
      e.preventDefault();
      if (!(await ensureAdmin())) return;
      const fd = new FormData(form);
      const res = await apiJson('POST', '/api/countdowns', {
        title: fd.get('title'),
        target_date: fd.get('target_date'),
        color: fd.get('color') || '#C96F7B',
      });
      if (res.status === 201) {
        state.countdowns.push(res.data);
        render('countdown');
      }
    }
    if (form.id === 'settingsForm') {
      e.preventDefault();
      if (!(await ensureAdmin())) return;
      const fd = new FormData(form);
      const payload = {};
      for (const key of ['site_title', 'site_subtitle', 'couple_names', 'anniversary_date', 'album_password', 'admin_password']) {
        payload[key] = fd.get(key);
      }
      const res = await apiJson('PUT', '/api/settings', payload);
      if (res.status === 200) {
        state.settings = res.data;
        alert('设置已保存');
      }
    }
    if (form.id === 'copyForm') {
      e.preventDefault();
      if (!(await ensureAdmin())) return;
      const fd = new FormData(form);
      const payload = {};
      for (const [key] of COPY_FIELDS) payload[key] = fd.get(key) ?? '';
      const res = await apiJson('PUT', '/api/copy', payload);
      if (res.status === 200) {
        state.copy = res.data;
        flashNotice('文案已保存');
      }
    }
    if (form.id === 'timelineForm') {
      e.preventDefault();
      if (!(await ensureAdmin())) return;
      const fd = new FormData(form);
      const res = await apiJson('POST', '/api/timeline', {
        event_date: fd.get('event_date'),
        title: fd.get('title'),
        description: fd.get('description'),
      });
      if (res.status === 201) {
        state.timeline.unshift(res.data);
        render('timeline');
        flashNotice('时间线事件已添加');
      }
    }
  });

  render('countdown');
}

function initAdminLock() {
  const form = document.getElementById('adminUnlockForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('adminPassword').value;
    const { status, data } = await apiJson('POST', '/api/auth/admin', { password });
    if (status === 200 && data.ok) {
      window.location.reload();
    } else {
      document.getElementById('adminUnlockMsg').textContent = data.error || '密码不正确，请重试';
    }
  });
}

function renderCountdown(state) {
  const rows = state.countdowns
    .map(
      (c) => `<div class="admin-row">
        <span style="width:12px;height:12px;border-radius:50%;background:${c.color || '#C96F7B'};flex:none"></span>
        <div class="row-main"><div class="row-title">${escapeHtml(c.title)}</div><div class="row-sub">${escapeHtml(c.target_date)}</div></div>
        <div class="row-actions"><button class="icon-btn" data-action="delete-countdown" data-id="${c.id}" title="删除">${ic('trash')}</button></div>
      </div>`
    )
    .join('');
  return `<div class="admin-panel">
      <h3>添加倒计时</h3>
      <form id="cdForm" style="display:grid;gap:12px">
        <label class="field"><span>标题</span><input class="input" name="title" required placeholder="例如：她的生日"></label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <label class="field"><span>目标日期</span><input class="input" name="target_date" type="date" required></label>
          <label class="field"><span>主题色</span><input class="color-input" name="color" type="color" value="#C96F7B"></label>
        </div>
        <button class="btn btn-primary" style="justify-self:start">${ic('plus')} 添加</button>
      </form>
    </div>
    <div class="admin-panel" style="margin-top:18px">
      <h3>已有倒计时（${state.countdowns.length}）</h3>
      ${rows || '<p class="empty" style="padding:12px 0">暂无倒计时</p>'}
    </div>`;
}

function renderPhotos(state) {
  const rows = state.photos
    .map(
      (p) => `<div class="admin-row">
        <img class="thumb" src="${escapeHtml(p.url)}" alt="${escapeHtml(p.alt || p.original_name)}">
        <div class="row-main"><div class="row-title">${escapeHtml(p.original_name)}</div><div class="row-sub">${escapeHtml(p.caption || '无说明')}</div></div>
        <div class="row-actions"><button class="icon-btn" data-action="delete-photo" data-id="${p.id}" title="删除">${ic('trash')}</button></div>
      </div>`
    )
    .join('');
  return `<div class="admin-panel">
      <h3>上传照片</h3>
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <button class="btn btn-primary" data-action="pick-photo">${ic('upload')} 选择照片</button>
        <span style="color:var(--faint);font-size:13px">支持多选，上传后永久保存</span>
      </div>
      <input type="file" id="adminPhotoInput" accept="image/*" multiple hidden>
    </div>
    <div class="admin-panel" style="margin-top:18px">
      <h3>已有照片（${state.photos.length}）</h3>
      ${rows || '<p class="empty" style="padding:12px 0">暂无照片</p>'}
    </div>`;
}

function renderTimeline(state) {
  const events = state.timeline
    .map((event) => {
      const date = new Date(`${event.event_date}T00:00:00`);
      const dateText = Number.isNaN(date.getTime())
        ? event.event_date
        : `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
      const photos = (event.photos || [])
        .map(
          (p) => `<div class="timeline-admin-photo">
            <img src="${escapeHtml(p.url)}" alt="${escapeHtml(p.alt || '时间线照片')}">
            <button class="timeline-photo-remove" data-action="delete-timeline-photo" data-id="${p.id}" data-event="${event.id}" title="删除照片" aria-label="删除照片">${ic('x', 12)}</button>
          </div>`
        )
        .join('');
      return `<div class="timeline-admin-event">
        <div class="timeline-admin-head">
          <div>
            <div class="row-sub">${escapeHtml(dateText)}</div>
            <div class="row-title">${escapeHtml(event.title)}</div>
          </div>
          <button class="icon-btn" data-action="delete-timeline" data-id="${event.id}" title="删除事件" aria-label="删除事件">${ic('trash')}</button>
        </div>
        ${event.description ? `<p class="timeline-admin-desc">${escapeHtml(event.description)}</p>` : ''}
        ${photos ? `<div class="timeline-admin-photos">${photos}</div>` : ''}
        <button class="btn btn-ghost btn-sm" data-action="timeline-upload" data-id="${event.id}">${ic('upload')} 添加当天照片</button>
        <input type="file" id="timelineInput-${event.id}" data-event="${event.id}" accept="image/*" multiple hidden>
      </div>`;
    })
    .join('');
  return `<div class="admin-panel">
      <h3>添加时间线事件</h3>
      <form id="timelineForm" style="display:grid;gap:2px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <label class="field"><span>日期</span><input class="input" name="event_date" type="date" required></label>
          <label class="field"><span>事件标题</span><input class="input" name="title" required placeholder="例如：第一次一起旅行"></label>
        </div>
        <label class="field"><span>记录当天发生的事</span><textarea class="textarea" name="description" placeholder="写下那天的天气、心情和细节"></textarea></label>
        <button class="btn btn-primary" style="justify-self:start">${ic('plus')} 添加事件</button>
      </form>
    </div>
    <div class="admin-panel" style="margin-top:18px">
      <h3>时间线记录（${state.timeline.length}）</h3>
      ${events || '<p class="empty" style="padding:12px 0">暂无时间线事件</p>'}
    </div>`;
}

function renderMusic(state) {
  const source = state.musicSource || 'local';
  const rows = state.tracks
    .map(
      (t) => `<div class="admin-row">
        <div class="row-main">
          <div class="row-title">${escapeHtml(t.title)}</div>
          <div class="row-sub">${escapeHtml(t.artist || '未知歌手')} · ${t.source === 'netease' ? '网易云音乐' : t.source === 'qq' ? 'QQ音乐' : t.source === 'itunes' ? 'Apple Music 试听' : t.source === 'audius' ? 'Audius' : '本地文件'}</div>
        </div>
        <div class="row-actions"><button class="icon-btn" data-action="delete-track" data-id="${t.id}" title="删除">${ic('trash')}</button></div>
      </div>`
    )
    .join('');
  const tabs = [
    ['local', '本地文件'],
    ['netease', '网易云音乐'],
    ['qq', 'QQ音乐'],
  ]
    .map(
      ([key, label]) => `<button class="source-tab ${source === key ? 'is-active' : ''}" data-action="music-source" data-source="${key}">${label}</button>`
    )
    .join('');

  const localPanel = `<div class="music-source-panel">
    <div class="music-form-grid">
      <label class="field"><span>歌名</span><input class="input" id="trackTitle" placeholder="例如：慢慢喜欢你"></label>
      <label class="field"><span>歌手</span><input class="input" id="trackArtist" placeholder="例如：莫文蔚"></label>
    </div>
    <button class="btn btn-primary" data-action="pick-track">${ic('upload')} 选择音频文件</button>
    <input type="file" id="adminTrackInput" accept="audio/*" hidden>
  </div>`;

  const neteasePanel = `<div class="music-source-panel">
    <label class="field"><span>网易云分享链接</span><input class="input" id="neteaseLink" placeholder="https://music.163.com/song?id=..."></label>
    <div class="music-form-grid">
      <label class="field"><span>歌名（可选）</span><input class="input" id="neteaseTitle" placeholder="自动读取或手动填写"></label>
      <label class="field"><span>歌手（可选）</span><input class="input" id="neteaseArtist" placeholder="自动读取或手动填写"></label>
    </div>
    <p class="music-import-note">保存官方歌曲链接并使用网易云官方播放器，不抓取音频文件。</p>
    <button class="btn btn-primary" data-action="import-track" data-source="netease">${ic('music')} 导入网易云音乐</button>
  </div>`;

  const qqPanel = `<div class="music-source-panel">
    <label class="field"><span>QQ音乐分享链接</span><input class="input" id="qqLink" placeholder="https://y.qq.com/n/ryqq/songDetail/..."></label>
    <div class="music-form-grid">
      <label class="field"><span>歌名（可选）</span><input class="input" id="qqTitle" placeholder="手动填写歌曲名称"></label>
      <label class="field"><span>歌手（可选）</span><input class="input" id="qqArtist" placeholder="手动填写歌手名称"></label>
    </div>
    <p class="music-import-note">QQ音乐仅保存官方分享链接，点击歌曲卡片可前往 QQ 音乐播放。</p>
    <button class="btn btn-primary" data-action="import-track" data-source="qq">${ic('music')} 导入 QQ 音乐</button>
  </div>`;

  return `<div class="admin-panel">
      <h3>添加音乐</h3>
      <div class="music-source-tabs">${tabs}</div>
      ${source === 'local' ? localPanel : source === 'netease' ? neteasePanel : qqPanel}
    </div>
    <div class="admin-panel" style="margin-top:18px">
      <h3>已有音乐（${state.tracks.length}）</h3>
      ${rows || '<p class="empty" style="padding:12px 0">暂无音乐</p>'}
    </div>`;
}

function renderBackground(state) {
  const pages = [
    { key: 'home', label: '首页 / 倒计时' },
    { key: 'album', label: '相册' },
    { key: 'timeline', label: '时间线' },
    { key: 'music', label: '音乐' },
    { key: 'admin', label: '管理后台' },
  ];
  const cards = pages
    .map((pg) => {
      const bg = state.backgrounds[pg.key] || { type: 'color', color: '#F7F4EF' };
      const isImg = bg.type === 'image' && bg.url;
      return `<div class="admin-panel">
        <h3>${pg.label}</h3>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
          ${isImg ? `<img src="${escapeHtml(bg.url)}" alt="" style="width:72px;height:52px;object-fit:cover;border-radius:6px">` : `<span style="width:72px;height:52px;border-radius:6px;background:${escapeHtml(bg.color || '#F7F4EF')};border:1px solid var(--line)"></span>`}
          <span style="color:var(--faint);font-size:13px">${isImg ? '自定义图片背景' : '纯色背景'}</span>
        </div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <input type="color" id="bgColor-${pg.key}" value="${escapeHtml(bg.color || '#F7F4EF')}" style="width:46px;height:40px;border:0;background:none;padding:0">
          <button class="btn btn-ghost btn-sm" data-action="set-bg-color" data-page="${pg.key}">设为纯色</button>
          <button class="btn btn-ghost btn-sm" data-action="pick-bg" data-page="${pg.key}">上传背景图</button>
          <input type="file" id="bgInput-${pg.key}" data-page="${pg.key}" accept="image/*" hidden>
        </div>
      </div>`;
    })
    .join('');
  return `<div class="admin-grid">${cards}</div>`;
}

function renderCopy(state) {
  const groups = [
    ['首页 / 倒计时', 'copy.home.'],
    ['相册', 'copy.album.'],
    ['时间线', 'copy.timeline.'],
    ['音乐', 'copy.music.'],
    ['管理后台', 'copy.admin.'],
  ];
  const sections = groups
    .map(([label, prefix]) => {
      const fields = COPY_FIELDS.filter(([key]) => key.startsWith(prefix))
        .map(([key, name, type]) => {
          const value = state.copy[key] ?? '';
          if (type === 'textarea') {
            return `<label class="field"><span>${escapeHtml(name)}</span><textarea class="textarea" name="${escapeHtml(key)}">${escapeHtml(value)}</textarea></label>`;
          }
          return `<label class="field"><span>${escapeHtml(name)}</span><input class="input" name="${escapeHtml(key)}" value="${escapeHtml(value)}"></label>`;
        })
        .join('');
      return `<div class="admin-panel" style="margin-bottom:18px"><h3>${label}</h3>${fields}</div>`;
    })
    .join('');
  return `<form id="copyForm" style="display:grid;gap:2px">
    <p class="admin-hint">修改后保存，前台页面立即生效。</p>
    ${sections}
    <button class="btn btn-primary" style="justify-self:start">${ic('edit')} 保存文案</button>
  </form>`;
}

function renderSettings(state) {
  const s = state.settings;
  return `<div class="admin-panel">
    <h3>站点信息</h3>
    <form id="settingsForm" style="display:grid;gap:2px">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <label class="field"><span>站点标题</span><input class="input" name="site_title" value="${escapeHtml(s.site_title || '')}"></label>
        <label class="field"><span>两个人的名字</span><input class="input" name="couple_names" value="${escapeHtml(s.couple_names || '')}"></label>
      </div>
      <label class="field"><span>副标题</span><input class="input" name="site_subtitle" value="${escapeHtml(s.site_subtitle || '')}"></label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <label class="field"><span>在一起的第一天</span><input class="input" name="anniversary_date" type="date" value="${escapeHtml(s.anniversary_date || '')}"></label>
        <label class="field"><span>相册密码</span><input class="input" name="album_password" value="${escapeHtml(s.album_password || '')}"></label>
      </div>
      <label class="field"><span>管理员密码</span><input class="input" name="admin_password" value="${escapeHtml(s.admin_password || '')}"></label>
      <button class="btn btn-primary" style="justify-self:start">${ic('edit')} 保存设置</button>
    </form>
  </div>
  <div class="admin-panel" style="margin-top:18px">
    <h3>部署信息</h3>
    <p style="color:var(--muted);margin:0;font-size:14px">当前文件存储驱动：<b>${escapeHtml(state.storageName)}</b>。数据库与上传文件均持久化保存，重启不丢失。</p>
  </div>`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function flashNotice(message) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-on'));
  setTimeout(() => {
    el.classList.remove('is-on');
    setTimeout(() => el.remove(), 300);
  }, 1800);
}

// ---------------- 启动 ----------------
function boot() {
  initSiteMusic();
  initGSAPExperience();
  initTransitions();
  initHearts();
  initGlassHeartExperience();
  initCountdowns();
  initGlassMotion();
  initMotionPolish();
  initLiquidMetalButtons();

  const page = document.body.dataset.page;
  if (page === 'album') initAlbum();
  if (page === 'timeline') initTimeline();
  if (page === 'music') {
    initMusic();
    initMusicSearch();
  }
  if (page === 'pets') {
    import('./pets-page.js')
      .then(({ initPetsPage }) => initPetsPage())
      .catch((error) => console.error('[pets]', error));
  }
  if (page === 'admin') {
    if (document.getElementById('adminBody')) {
      initAdmin();
    } else {
      initAdminLock();
    }
  }
}

boot();



