import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import { createPetStore } from '../src/pet-store.js';

test('pet store seeds both pets and persists state and events', () => {
  const database = new DatabaseSync(':memory:');
  const store = createPetStore(database);
  const pets = store.listPets();
  assert.deepEqual(
    pets.map((entry) => entry.slug),
    ['tom', 'pipi']
  );

  const tom = store.getPet('tom');
  store.savePet({ ...tom, satiety: 91, cleanliness: 88, current_pose: 'eat' });
  assert.equal(store.getPet('tom').satiety, 91);
  assert.equal(store.getPet('tom').current_pose, 'eat');
  assert.equal(store.getPet('missing'), null);

  store.recordEvent('tom', 'feed', 'TOM 吃得心满意足', '2026-11-15T00:00:00.000Z');
  store.recordEvent('tom', 'bath', 'TOM 被洗得香香的', '2026-11-15T00:01:00.000Z');
  assert.equal(store.listEvents(1)[0].action, 'bath');
  assert.equal(store.lastActionAt('tom'), '2026-11-15T00:01:00.000Z');
  database.close();
});

test('pet state survives closing and reopening a file database', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'hourlight-pets-'));
  const filename = path.join(directory, 'pets.db');
  const firstDatabase = new DatabaseSync(filename);
  const firstStore = createPetStore(firstDatabase);
  const pipi = firstStore.getPet('pipi');
  firstStore.savePet({ ...pipi, affection: 93, current_pose: 'sleep' });
  firstStore.recordEvent('pipi', 'sleep', '皮皮睡着了', '2026-11-15T01:00:00.000Z');
  firstDatabase.close();

  const secondDatabase = new DatabaseSync(filename);
  const secondStore = createPetStore(secondDatabase);
  assert.equal(secondStore.getPet('pipi').affection, 93);
  assert.equal(secondStore.getPet('pipi').current_pose, 'sleep');
  assert.equal(secondStore.listEvents(1)[0].summary, '皮皮睡着了');
  secondDatabase.close();

  for (const entry of fs.readdirSync(directory)) {
    fs.rmSync(path.join(directory, entry), { force: true });
  }
  fs.rmdirSync(directory);
});
