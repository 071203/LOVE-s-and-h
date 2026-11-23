import { applyPetAction, growthStage, settlePet } from './pet-sim.js';
import { json, readJson } from './util.js';

const COOLDOWN_MS = 5000;
const SLUGS = new Set(['tom', 'pipi']);

function hydrate(stored, store, now) {
  const settled = settlePet(stored, now);
  const saved = store.savePet(settled);
  return {
    ...saved,
    growth: growthStage(saved.adoption_date, now),
  };
}

function getState(store, now) {
  const pets = store.listPets().map((pet) => hydrate(pet, store, now));
  return {
    pets,
    events: store.listEvents(30),
  };
}

export function createPetApiHandler({
  store,
  auth,
  now = () => new Date(),
}) {
  if (!store) throw new Error('pet API requires a store');
  if (typeof auth !== 'function') throw new Error('pet API requires an auth guard');

  return async function handlePetApi(req, res, pathname) {
    if (pathname === '/api/pets' && req.method === 'GET') {
      if (!auth(req)) {
        json(res, 401, { ok: false, error: '需要相册密码' });
        return true;
      }
      json(res, 200, { ok: true, data: getState(store, now()) });
      return true;
    }

    const match = pathname.match(/^\/api\/pets\/(tom|pipi)\/(action|wake)$/);
    if (!match || req.method !== 'POST') return false;
    if (!auth(req)) {
      json(res, 401, { ok: false, error: '需要相册密码' });
      return true;
    }

    const [, slug, route] = match;
    if (!SLUGS.has(slug) || !store.getPet(slug)) {
      json(res, 404, { ok: false, error: '未找到这只宠物' });
      return true;
    }

    const current = now();
    const previousAction = store.lastActionAt(slug);
    if (previousAction) {
      const elapsed = current.getTime() - Date.parse(previousAction);
      if (Number.isFinite(elapsed) && elapsed >= 0 && elapsed < COOLDOWN_MS) {
        json(res, 429, {
          ok: false,
          error: '它还在回应上一次互动，请稍等几秒',
          retryAfter: Math.ceil((COOLDOWN_MS - elapsed) / 1000),
        });
        return true;
      }
    }

    let action = 'wake';
    if (route === 'action') {
      const body = await readJson(req);
      action = String(body.action || '');
    }

    try {
      const stored = store.getPet(slug);
      const outcome = applyPetAction(stored, action, current);
      const saved = store.savePet(outcome.pet);
      const summary = `${saved.display_name} ${outcome.summary}`;
      const event = store.recordEvent(
        slug,
        action,
        summary,
        current.toISOString()
      );
      json(res, 200, {
        ok: true,
        data: {
          pet: {
            ...saved,
            growth: growthStage(saved.adoption_date, current),
          },
          event,
        },
      });
    } catch (error) {
      const message = String(error && error.message);
      if (message.includes('not allowed')) {
        json(res, 400, {
          ok: false,
          error: slug === 'pipi' ? '皮皮不玩逗猫棒，它更喜欢追球。' : '这个动作不适合它。',
        });
      } else {
        throw error;
      }
    }
    return true;
  };
}
