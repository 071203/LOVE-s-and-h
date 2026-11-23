import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import { createPetStore } from '../src/pet-store.js';
import { createPetApiHandler } from '../src/pet-api.js';

function request(method, body) {
  const payload = body === undefined ? '' : JSON.stringify(body);
  return Object.assign(Readable.from(payload ? [Buffer.from(payload)] : []), {
    method,
    headers: {},
  });
}

function response() {
  return {
    status: 0,
    body: null,
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    writeHead(status) {
      this.status = status;
    },
    end(chunk = '') {
      this.body = chunk ? JSON.parse(String(chunk)) : null;
    },
  };
}

function fixture(authed = true) {
  const database = new DatabaseSync(':memory:');
  const store = createPetStore(database);
  let clock = Date.parse('2026-11-15T00:00:00.000Z');
  const handle = createPetApiHandler({
    store,
    auth: () => authed,
    now: () => new Date(clock),
  });
  return {
    database,
    store,
    handle,
    advance(ms) {
      clock += ms;
    },
  };
}

test('pet API rejects unauthenticated reads', async () => {
  const f = fixture(false);
  const res = response();
  const handled = await f.handle(request('GET'), res, '/api/pets', {});
  assert.equal(handled, true);
  assert.equal(res.status, 401);
  f.database.close();
});

test('pet API settles, applies actions and enforces cooldown', async () => {
  const f = fixture();
  const readRes = response();
  await f.handle(request('GET'), readRes, '/api/pets', {});
  assert.equal(readRes.status, 200);
  assert.equal(readRes.body.data.pets.length, 2);

  const feedRes = response();
  await f.handle(request('POST', { action: 'feed' }), feedRes, '/api/pets/tom/action', {});
  assert.equal(feedRes.status, 200);
  assert.equal(feedRes.body.data.event.action, 'feed');
  assert.ok(feedRes.body.data.pet.satiety > readRes.body.data.pets[0].satiety);

  const repeatRes = response();
  await f.handle(request('POST', { action: 'feed' }), repeatRes, '/api/pets/tom/action', {});
  assert.equal(repeatRes.status, 429);

  f.advance(5001);
  const teaserRes = response();
  await f.handle(request('POST', { action: 'teaser' }), teaserRes, '/api/pets/pipi/action', {});
  assert.equal(teaserRes.status, 400);
  f.database.close();
});

test('pet API supports bath, ball, sleep and wake', async () => {
  const f = fixture();
  for (const [index, [slug, action]] of [
    ['tom', 'bath'],
    ['tom', 'ball'],
    ['tom', 'sleep'],
    ['tom', 'wake'],
  ].entries()) {
    f.advance(5001);
    const endpoint =
      action === 'wake'
        ? `/api/pets/${slug}/wake`
        : `/api/pets/${slug}/action`;
    const res = response();
    await f.handle(
      request('POST', action === 'wake' ? undefined : { action }),
      res,
      endpoint,
      {}
    );
    assert.equal(res.status, 200, `${action} failed at iteration ${index}`);
    assert.equal(res.body.data.event.action, action);
  }
  assert.equal(f.store.getPet('tom').current_pose, 'idle');
  f.database.close();
});
