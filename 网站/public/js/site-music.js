const BACKGROUND_TITLE = '特别的人';
const BACKGROUND_ARTIST = '方大同';
const MUTED_KEY = 'ut-site-music-muted';

const noteIcon = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;

export function selectBackgroundMusic(tracks) {
  const list = Array.isArray(tracks) ? tracks : [];
  const byTitle = list.filter((track) => String(track?.title || '').trim() === BACKGROUND_TITLE);
  return (
    byTitle.find(
      (track) =>
        track.source === 'local' &&
        String(track.artist || '').includes(BACKGROUND_ARTIST)
    ) ||
    byTitle.find((track) => String(track.artist || '').includes(BACKGROUND_ARTIST)) ||
    byTitle[0] ||
    null
  );
}

export function musicEmbedUrl(track) {
  if (!track) return '';
  if (track.source === 'local' && track.url) return track.url;
  if (track.source !== 'netease' || !track.embed_url) return '';
  try {
    const url = new URL(track.embed_url);
    url.searchParams.set('auto', '1');
    url.searchParams.set('height', '66');
    return url.href;
  } catch {
    return '';
  }
}

async function fetchTracks() {
  const response = await fetch('/api/tracks', {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) return [];
  const payload = await response.json();
  return Array.isArray(payload?.data) ? payload.data : [];
}

function createMusicDock(track, doc) {
  const dock = doc.createElement('aside');
  dock.className = 'site-music';
  dock.dataset.siteMusic = '';
  dock.dataset.musicAutoplay = 'attempted';
  dock.setAttribute('aria-label', '网站背景音乐');
  dock.innerHTML = `<button class="site-music-toggle" type="button" aria-expanded="false">
      <span class="site-music-note">${noteIcon}</span>
      <span class="site-music-copy">
        <b>${String(track.title || BACKGROUND_TITLE)}</b>
        <small>${String(track.artist || BACKGROUND_ARTIST)} · 背景音乐</small>
      </span>
      <span class="site-music-wave" aria-hidden="true"><i></i><i></i><i></i></span>
    </button>
    <div class="site-music-panel"></div>`;
  return dock;
}

function createExternalPlayer(track, doc, panel) {
  const src = musicEmbedUrl(track);
  if (!src) return;
  panel.replaceChildren();
  const iframe = doc.createElement('iframe');
  iframe.className = 'site-music-frame';
  iframe.src = src;
  iframe.title = `${track.title} ${track.artist} 官方播放器`;
  iframe.loading = 'eager';
  iframe.allow = 'autoplay';
  iframe.referrerPolicy = 'strict-origin-when-cross-origin';
  panel.appendChild(iframe);
}

export async function initSiteMusic(options = {}) {
  const doc = options.document || document;
  const win = options.window || window;
  if (doc.querySelector('[data-site-music]')) return null;

  let tracks;
  try {
    tracks = await (options.loadTracks || fetchTracks)();
  } catch {
    return null;
  }
  const track = selectBackgroundMusic(tracks);
  if (!track) return null;

  const dock = createMusicDock(track, doc);
  const toggle = dock.querySelector('.site-music-toggle');
  const panel = dock.querySelector('.site-music-panel');
  const isLocal = track.source === 'local' && Boolean(track.url);
  let muted = false;
  try {
    muted = win.localStorage.getItem(MUTED_KEY) === 'true';
  } catch {
    /* storage can be unavailable in private contexts */
  }

  doc.body.appendChild(dock);

  if (isLocal) {
    const audio = new win.Audio();
    audio.src = track.url;
    audio.loop = true;
    audio.autoplay = !muted;
    audio.preload = 'auto';
    audio.playsInline = true;
    panel.appendChild(audio);
    dock.dataset.musicSource = 'local';

    const sync = (playing) => {
      dock.classList.toggle('is-playing', playing);
      dock.dataset.musicPlaying = playing ? 'true' : 'false';
      toggle.setAttribute('aria-label', playing ? '暂停背景音乐' : '播放背景音乐');
    };
    audio.addEventListener('play', () => sync(true));
    audio.addEventListener('pause', () => sync(false));
    dock.dataset.musicPlaying = 'false';

    if (!muted) {
      audio.play().catch(() => {
        dock.classList.add('needs-gesture');
      });
      const retry = () => {
        audio.play().then(() => dock.classList.remove('needs-gesture')).catch(() => {});
      };
      doc.addEventListener('pointerdown', retry, { once: true, passive: true });
      doc.addEventListener('keydown', retry, { once: true });
    }

    toggle.addEventListener('click', () => {
      if (audio.paused) {
        muted = false;
        audio.play().catch(() => {});
      } else {
        muted = true;
        audio.pause();
      }
      try {
        win.localStorage.setItem(MUTED_KEY, muted ? 'true' : 'false');
      } catch {
        /* ignore */
      }
    });
  } else {
    dock.dataset.musicSource = track.source || 'embed';
    createExternalPlayer(track, doc, panel);
    toggle.addEventListener('click', () => {
      const open = !dock.classList.contains('is-open');
      dock.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) createExternalPlayer(track, doc, panel);
    });
  }

  return dock;
}
