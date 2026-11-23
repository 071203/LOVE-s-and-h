import assert from 'node:assert/strict';
import test from 'node:test';

import { applyPetAction, growthStage, settlePet } from '../src/pet-sim.js';

const atMidnight = new Date('2026-11-15T00:00:00.000Z');
const twoHoursLater = new Date('2026-11-15T02:00:00.000Z');

function pet(overrides = {}) {
  return {
    slug: 'tom',
    adoption_date: '2026-10-01',
    satiety: 100,
    cleanliness: 100,
    energy: 100,
    affection: 70,
    care_points: 0,
    sleeping_since: null,
    last_simulated_at: atMidnight.toISOString(),
    ...overrides,
  };
}

test('settlePet applies time-based decay at the documented rates', () => {
  const settled = settlePet(pet(), twoHoursLater);
  assert.equal(settled.satiety, 97.6);
  assert.equal(settled.cleanliness, 98.8);
  assert.equal(settled.energy, 98);
});

test('sleep restores energy while the other needs still decay', () => {
  const settled = settlePet(
    pet({ energy: 40, sleeping_since: '2026-11-14T23:00:00.000Z' }),
    twoHoursLater
  );
  assert.equal(settled.energy, 52);
  assert.equal(settled.satiety, 97.6);
  assert.equal(settled.cleanliness, 98.8);
});

test('teaser raises affection for TOM and is rejected for PIPI', () => {
  const cat = applyPetAction(pet(), 'teaser', atMidnight);
  assert.equal(cat.pet.affection, 76);
  assert.throws(
    () => applyPetAction(pet({ slug: 'pipi' }), 'teaser', atMidnight),
    /not allowed/
  );
});

test('sleep and wake update the persisted pose', () => {
  const sleeping = applyPetAction(pet(), 'sleep', atMidnight).pet;
  assert.equal(sleeping.current_pose, 'sleep');
  assert.equal(sleeping.sleeping_since, atMidnight.toISOString());
  const awake = applyPetAction(sleeping, 'wake', atMidnight).pet;
  assert.equal(awake.current_pose, 'idle');
  assert.equal(awake.sleeping_since, null);
});

test('growth caps at the family stage', () => {
  const stage = growthStage('2026-10-01', new Date('2026-11-15T00:00:00.000Z'));
  assert.equal(stage.key, 'family');
  assert.equal(stage.sizeScale, 1.04);
});
