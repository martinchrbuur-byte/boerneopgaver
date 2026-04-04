import test from 'node:test';
import assert from 'node:assert/strict';

import { createChoreService } from '../../src/services/choreService.js';
import { createPeriodService } from '../../src/services/periodService.js';
import { createStorageService } from '../../src/services/storageService.js';

function createMemoryStorage() {
  const store = new Map();

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, value);
    },
    clear() {
      store.clear();
    }
  };
}

function buildServices() {
  const storageService = createStorageService({ storage: createMemoryStorage() });
  const choreService = createChoreService({
    storageService,
    nowProvider: () => '2026-01-01T10:00:00.000Z'
  });
  const periodService = createPeriodService({ storageService });

  const period = periodService.ensureActivePeriod();

  return { choreService, periodService, periodId: period.id };
}

test('shared assignment pays only completing child', () => {
  const { choreService, periodService, periodId } = buildServices();

  const addResult = choreService.addChore('Shared task', {
    nowIso: '2026-01-01T08:00:00.000Z',
    actorRole: 'parent',
    assignedTo: ['Hans Jørgen', 'Andrea'],
    value: 20
  });

  const choreId = addResult.state.chores[0].id;

  const complete = choreService.completeChore(choreId, {
    nowIso: '2026-01-01T09:00:00.000Z',
    actorRole: 'Andrea',
    periodId
  });

  assert.equal(complete.ok, true);

  const earnings = periodService.getPeriodEarnings(periodId);
  assert.equal(earnings.Andrea, 20);
  assert.equal(earnings['Hans Jørgen'], 0);
});

test('collaboration split totals equal chore value', () => {
  const { choreService, periodService, periodId } = buildServices();

  const addResult = choreService.addChore('Team task', {
    nowIso: '2026-01-01T08:00:00.000Z',
    actorRole: 'parent',
    assignedTo: ['Hans Jørgen', 'Andrea'],
    value: 30
  });

  const choreId = addResult.state.chores[0].id;

  const proposal = choreService.proposeCollaboration(choreId, {
    actorRole: 'Andrea'
  });

  assert.equal(proposal.ok, true);

  const collabId = proposal.state.pendingCollaborations[0].id;
  const accepted = choreService.acceptCollaboration(collabId, {
    actorRole: 'Hans Jørgen',
    periodId,
    nowIso: '2026-01-01T09:00:00.000Z'
  });

  assert.equal(accepted.ok, true);

  const earnings = periodService.getPeriodEarnings(periodId);
  assert.equal(earnings.Andrea, 15);
  assert.equal(earnings['Hans Jørgen'], 15);
  assert.equal(earnings.Andrea + earnings['Hans Jørgen'], 30);
});

test('money progress returns per-kid and total period targets', () => {
  const { choreService, periodService, periodId } = buildServices();

  const limited = choreService.addChore('Limited task', {
    nowIso: '2026-01-01T08:00:00.000Z',
    actorRole: 'parent',
    assignedTo: ['Andrea'],
    value: 10,
    maxPerPeriod: 2
  });
  assert.equal(limited.ok, true);

  const unlimited = choreService.addChore('Unlimited task', {
    nowIso: '2026-01-01T08:00:00.000Z',
    actorRole: 'parent',
    assignedTo: ['Hans Jørgen'],
    value: 5,
    maxPerPeriod: 0,
    unlimitedDailyCap: 3
  });
  assert.equal(unlimited.ok, true);

  const limitedId = limited.state.chores.find(chore => chore.name === 'Limited task').id;
  const unlimitedId = unlimited.state.chores.find(chore => chore.name === 'Unlimited task').id;

  choreService.completeChore(limitedId, {
    nowIso: '2026-01-01T09:00:00.000Z',
    actorRole: 'Andrea',
    periodId
  });
  choreService.completeChore(unlimitedId, {
    nowIso: '2026-01-01T09:30:00.000Z',
    actorRole: 'Hans Jørgen',
    periodId
  });

  const progress = periodService.getPeriodMoneyProgress(periodId);

  assert.equal(progress.byKid.Andrea.earned, 10);
  assert.equal(progress.byKid.Andrea.target, 20);
  assert.equal(progress.byKid['Hans Jørgen'].earned, 5);
  assert.equal(progress.byKid['Hans Jørgen'].target, 105);
  assert.equal(progress.total.earned, 15);
  assert.equal(progress.total.target, 125);
});
