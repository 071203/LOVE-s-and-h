const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const ALLOWED_ACTIONS = {
  tom: new Set(['feed', 'bath', 'sleep', 'wake', 'ball', 'teaser']),
  pipi: new Set(['feed', 'bath', 'sleep', 'wake', 'ball']),
};

const ACTION_SUMMARIES = {
  feed: '吃得心满意足，轻轻舔了舔嘴角。',
  bath: '被洗得香香的，甩了甩身上的水珠。',
  sleep: '找到舒服的位置，安心睡着了。',
  wake: '伸了个懒腰，回到你身边。',
  ball: '追着小球玩了好一会儿。',
  teaser: '盯住逗猫棒，扑上去抓住了它。',
};

function clamp(value) {
  return Math.min(100, Math.max(0, Number(value) || 0));
}

function round(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function isoDate(now) {
  return new Date(now).toISOString();
}

export function settlePet(pet, now = new Date()) {
  const current = new Date(now);
  if (Number.isNaN(current.getTime())) throw new Error('invalid simulation time');
  const previousTime = Date.parse(pet.last_simulated_at || '');
  const last = Number.isFinite(previousTime) ? previousTime : current.getTime();
  const elapsedHours = Math.max(0, (current.getTime() - last) / HOUR);
  const sleeping = Boolean(pet.sleeping_since);

  return {
    ...pet,
    satiety: round(clamp(pet.satiety - elapsedHours * 1.2)),
    cleanliness: round(clamp(pet.cleanliness - elapsedHours * 0.6)),
    energy: round(clamp(pet.energy + elapsedHours * (sleeping ? 6 : -1))),
    affection: round(clamp(pet.affection - elapsedHours * 0.05)),
    care_points: Number(pet.care_points) || 0,
    last_simulated_at: isoDate(current),
  };
}

export function applyPetAction(pet, action, now = new Date()) {
  const allowed = ALLOWED_ACTIONS[pet.slug];
  if (!allowed || !allowed.has(action)) {
    throw new Error(`${action} is not allowed for ${pet.slug}`);
  }

  const settled = settlePet(pet, now);
  const next = {
    ...settled,
    sleeping_since: settled.sleeping_since || null,
    current_pose: 'idle',
  };

  if (action === 'feed') {
    next.satiety = clamp(next.satiety + 22);
    next.cleanliness = clamp(next.cleanliness - 1);
    next.energy = clamp(next.energy + 2);
    next.affection = clamp(next.affection + 3);
    next.care_points += 2;
  } else if (action === 'bath') {
    next.cleanliness = clamp(next.cleanliness + 30);
    next.energy = clamp(next.energy - 5);
    next.affection = clamp(next.affection + 2);
    next.care_points += 2;
  } else if (action === 'sleep') {
    next.sleeping_since = isoDate(now);
    next.current_pose = 'sleep';
  } else if (action === 'wake') {
    next.sleeping_since = null;
  } else if (action === 'ball') {
    next.satiety = clamp(next.satiety - 4);
    next.energy = clamp(next.energy - 12);
    next.affection = clamp(next.affection + 7);
    next.care_points += 3;
  } else if (action === 'teaser') {
    next.energy = clamp(next.energy - 8);
    next.affection = clamp(next.affection + 6);
    next.care_points += 2;
  }

  return {
    pet: next,
    summary: ACTION_SUMMARIES[action],
  };
}

export function growthStage(adoptionDate, now = new Date()) {
  const adopted = new Date(`${String(adoptionDate).slice(0, 10)}T00:00:00.000Z`);
  const current = new Date(now);
  const days =
    Number.isNaN(adopted.getTime()) || Number.isNaN(current.getTime())
      ? 0
      : Math.max(0, Math.floor((current.getTime() - adopted.getTime()) / DAY));

  if (days >= 45) return { key: 'family', label: '长久家人', sizeScale: 1.04, days };
  if (days >= 14) return { key: 'secure', label: '安心相伴', sizeScale: 1.03, days };
  if (days >= 3) return { key: 'familiar', label: '慢慢熟悉', sizeScale: 1.015, days };
  return { key: 'new', label: '来到身边', sizeScale: 1, days };
}
