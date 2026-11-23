import { initPetRoom } from './pet-room.js';

function pageData() {
  const node = document.getElementById('page-data');
  if (!node) return {};
  try {
    return JSON.parse(node.textContent || '{}');
  } catch {
    return {};
  }
}

async function requestJson(method, url, body) {
  const options = { method, headers: {} };
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  const response = await fetch(url, options);
  let data = {};
  try {
    data = await response.json();
  } catch {
    /* Keep the HTTP status when a non-JSON proxy response is returned. */
  }
  return { ok: response.ok, status: response.status, data };
}

function formatEventTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function moodFor(pet) {
  if (pet.current_pose === 'sleep') return '睡得正香，呼吸轻轻的，梦里也许有你。';
  if (pet.satiety < 35) return '肚子有点空了，正抬头等你添一份好吃的。';
  if (pet.cleanliness < 35) return '毛发有一点乱，洗澡时间到了。';
  if (pet.energy < 30) return '眼皮慢慢垂下来了，想找一个温暖的位置休息。';
  if (pet.affection > 82) return '已经把你当成最亲近的人，总想再靠近一点。';
  if (pet.slug === 'tom') return '它安静地看着你，尾巴慢慢扫过地毯。';
  return '它竖起耳朵等你发话，尾巴已经先开心起来了。';
}

function companionHint(pet) {
  if (pet.current_pose === 'sleep') return '正在睡觉';
  if (Number(pet.satiety) < 35) {
    return `有点饿了 · 亲密 ${Math.round(Number(pet.affection) || 0)}`;
  }
  if (Number(pet.cleanliness) < 35) {
    return `想洗个澡 · 亲密 ${Math.round(Number(pet.affection) || 0)}`;
  }
  if (Number(pet.energy) < 30) return '有点困了';
  if (Number(pet.affection) > 82) return '很想黏着你';
  return pet.slug === 'tom' ? '安静陪在身边' : '等你一起玩';
}

export async function initPetsPage() {
  const unlockForm = document.getElementById('petsUnlockForm');
  if (unlockForm) {
    unlockForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const input = document.getElementById('petsPassword');
      const message = document.getElementById('petsUnlockMsg');
      const result = await requestJson('POST', '/api/auth/album', {
        password: input?.value || '',
      });
      if (result.ok && result.data.ok) {
        window.location.reload();
      } else if (message) {
        message.textContent = result.data.error || '解锁失败，请重试';
      }
    });
    return;
  }

  const root = document.querySelector('[data-pet-room]');
  if (!root) return;

  const data = pageData();
  const state = {
    pets: new Map((data.pets || []).map((pet) => [pet.slug, pet])),
    events: Array.isArray(data.events) ? data.events : [],
    active: root.dataset.activePet || 'tom',
    busy: false,
  };

  if (!state.pets.size) {
    const result = await requestJson('GET', '/api/pets');
    if (result.ok) {
      for (const pet of result.data.data.pets || []) state.pets.set(pet.slug, pet);
      state.events = result.data.data.events || [];
    }
  }

  const selectButtons = Array.from(document.querySelectorAll('[data-pet-select]'));
  const actionButtons = Array.from(document.querySelectorAll('[data-pet-action]'));
  const wakeButton = document.querySelector('[data-pet-wake]');
  const reaction = document.querySelector('[data-pet-reaction]');
  const nameNode = document.querySelector('[data-pet-name]');
  const growthNode = document.querySelector('[data-pet-growth]');
  const moodNode = document.querySelector('[data-pet-mood]');
  const eventsNode = document.querySelector('[data-pet-events]');
  const fallbackImage = document.querySelector('[data-fallback-image]');
  let reactionTimer = 0;
  let busyTimer = 0;

  const labels = {
    feed: '喂食',
    bath: '洗澡',
    sleep: '睡觉',
    wake: '叫醒',
    ball: '玩球',
    teaser: '逗猫棒',
  };

  function toast(message) {
    let node = document.querySelector('.pet-toast');
    if (!node) {
      node = document.createElement('div');
      node.className = 'toast pet-toast';
      document.body.appendChild(node);
    }
    node.textContent = message;
    requestAnimationFrame(() => node.classList.add('is-on'));
    clearTimeout(node._timer);
    node._timer = window.setTimeout(() => node.classList.remove('is-on'), 2200);
  }

  function react(message) {
    if (!reaction) return;
    reaction.textContent = message;
    reaction.classList.add('is-on');
    clearTimeout(reactionTimer);
    reactionTimer = window.setTimeout(() => reaction.classList.remove('is-on'), 3300);
  }

  function updateMeter(key, value) {
    const meter = document.querySelector(`[data-meter="${key}"]`);
    if (!meter) return;
    const safe = Math.max(0, Math.min(100, Number(value) || 0));
    const bar = meter.querySelector('.pet-meter-track i');
    const label = meter.querySelector('[data-meter-value]');
    if (bar) bar.style.setProperty('--value', `${safe}%`);
    if (label) label.textContent = String(Math.round(safe));
  }

  function renderEvents() {
    if (!eventsNode) return;
    eventsNode.replaceChildren();
    if (!state.events.length) {
      const item = document.createElement('li');
      item.className = 'pet-event is-empty';
      const dot = document.createElement('span');
      dot.className = 'pet-event-dot';
      const body = document.createElement('div');
      const text = document.createElement('p');
      text.textContent = '还没有记录，从喂食或玩球开始吧。';
      body.appendChild(text);
      item.append(dot, body);
      eventsNode.appendChild(item);
      return;
    }

    for (const event of state.events.slice(0, 8)) {
      const item = document.createElement('li');
      item.className = 'pet-event';
      item.dataset.eventId = String(event.id);
      const dot = document.createElement('span');
      dot.className = 'pet-event-dot';
      const body = document.createElement('div');
      const text = document.createElement('p');
      text.textContent = event.summary;
      const time = document.createElement('time');
      time.textContent = formatEventTime(event.created_at);
      body.append(text, time);
      item.append(dot, body);
      eventsNode.appendChild(item);
    }
  }

  function updatePanel() {
    const pet = state.pets.get(state.active);
    if (!pet) return;
    if (nameNode) nameNode.textContent = pet.display_name || (pet.slug === 'tom' ? 'TOM' : '皮皮');
    if (growthNode) growthNode.textContent = pet.growth?.label || '来到身边';
    if (moodNode) moodNode.textContent = moodFor(pet);
    updateMeter('satiety', pet.satiety);
    updateMeter('cleanliness', pet.cleanliness);
    updateMeter('energy', pet.energy);
    updateMeter('affection', pet.affection);
    for (const [slug, companion] of state.pets) {
      const summary = document.querySelector(`[data-pet-summary="${slug}"]`);
      if (summary) summary.textContent = companionHint(companion);
    }

    const sleeping = pet.current_pose === 'sleep';
    for (const button of selectButtons) {
      const active = button.dataset.petSelect === state.active;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    }
    for (const button of actionButtons) {
      const action = button.dataset.petAction;
      const unsupported = pet.slug === 'pipi' && action === 'teaser';
      button.hidden = unsupported;
      if (action === 'sleep') {
        button.disabled = sleeping || state.busy;
        button.querySelector('span:last-child').textContent = sleeping ? '已睡着' : '睡觉';
      } else {
        button.disabled = state.busy;
      }
    }
    if (wakeButton) wakeButton.hidden = !sleeping;
    if (fallbackImage) {
      fallbackImage.src = `/pets/fallback/${pet.slug}.webp`;
      fallbackImage.alt = `${pet.display_name || pet.slug} 的 3D 转台预览`;
    }
  }

  let room;
  let pendingSleep = false;
  room = initPetRoom(root, {
    initialState: data,
    onSelect(slug) {
      state.active = slug;
      updatePanel();
      react(slug === 'tom' ? 'TOM 抬头看向你。' : '皮皮朝你跑了过来。');
    },
    onAffection(slug) {
      if (state.busy) return;
      const pet = state.pets.get(slug);
      if (pet?.current_pose === 'sleep') return;
      react(slug === 'tom' ? 'TOM 眯起眼睛，轻轻蹭了蹭你的手。' : '皮皮凑近你，尾巴摇成了一朵花。');
    },
    onReady() {
      const pet = state.pets.get(state.active);
      room.selectPet(state.active, false);
      if (pet?.current_pose === 'sleep') room.setSleeping(state.active, true);
    },
    onFallback() {
      if (fallbackImage) fallbackImage.src = `/pets/fallback/${state.active}.webp`;
    },
  });

  function markBusy(busy, cooldownSeconds = 0) {
    clearTimeout(busyTimer);
    state.busy = busy || cooldownSeconds > 0;
    updatePanel();
    if (cooldownSeconds > 0) {
      busyTimer = window.setTimeout(() => {
        state.busy = false;
        updatePanel();
      }, cooldownSeconds * 1000);
    }
  }

  async function submitAction(action) {
    if (state.busy) return;
    const pet = state.pets.get(state.active);
    if (!pet) return;
    if (pet.slug === 'pipi' && action === 'teaser') return;
    if (pet.current_pose === 'sleep' && action !== 'wake') {
      toast('先叫醒它，再一起玩吧');
      return;
    }

    markBusy(true);
    react(labels[action] ? `正在${labels[action]}…` : '正在回应你…');
    const endpoint =
      action === 'wake'
        ? `/api/pets/${pet.slug}/wake`
        : `/api/pets/${pet.slug}/action`;
    const result = await requestJson(
      'POST',
      endpoint,
      action === 'wake' ? undefined : { action }
    );

    if (!result.ok) {
      markBusy(false);
      if (result.status === 429) {
        markBusy(false, Number(result.data.retryAfter) || 4);
      }
      toast(result.data.error || '互动没有送达，请稍后再试');
      return;
    }

    const next = result.data.data.pet;
    const event = result.data.data.event;
    state.pets.set(next.slug, next);
    state.events = [event, ...state.events.filter((entry) => entry.id !== event.id)].slice(0, 30);
    updatePanel();
    renderEvents();
    react(event.summary);
    room.playAction(next.slug, action);
    if (action === 'sleep') {
      pendingSleep = true;
      room.setSleeping(next.slug, true);
    }
    if (action === 'wake') {
      pendingSleep = false;
      room.setSleeping(next.slug, false);
    }
    markBusy(false, 5);
  }

  for (const button of selectButtons) {
    button.addEventListener('click', () => {
      state.active = button.dataset.petSelect;
      room.selectPet(state.active, false);
      updatePanel();
      react(state.active === 'tom' ? 'TOM 安静地坐在你面前。' : '皮皮开心地摇起了尾巴。');
      const pet = state.pets.get(state.active);
      if (!state.busy && pet?.current_pose !== 'sleep') {
        room.playAction(state.active, 'affection', 2.1);
      }
    });
  }

  for (const button of actionButtons) {
    button.addEventListener('click', () => submitAction(button.dataset.petAction));
  }
  wakeButton?.addEventListener('click', () => submitAction('wake'));

  updatePanel();
  renderEvents();
}
