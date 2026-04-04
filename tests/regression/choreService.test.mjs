import test from 'node:test';
import assert from 'node:assert/strict';

import { createChoreService } from '../../src/services/choreService.js';
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

function buildService() {
  const storageService = createStorageService({ storage: createMemoryStorage() });
  const choreService = createChoreService({
    storageService,
    nowProvider: () => '2026-01-01T10:00:00.000Z'
  });

  return { choreService, storageService };
}

test('addChore trims name and updates state', () => {
  const { choreService } = buildService();

  const result = choreService.addChore('  Feed the dog  ', {
    nowIso: '2026-01-01T08:00:00.000Z',
    actorRole: 'parent'
  });

  assert.equal(result.ok, true);
  assert.equal(result.state.totalChores, 1);
  assert.equal(result.state.chores[0].name, 'Feed the dog');
});

test('addChore preserves assignedTo in state for role-based filtering', () => {
  const { choreService } = buildService();

  const result = choreService.addChore('Sweep floor', {
    nowIso: '2026-01-01T08:00:00.000Z',
    actorRole: 'parent',
    assignedTo: ['Andrea']
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.state.chores[0].assignedTo, ['Andrea']);
});

test('parent can update chore name, value, assignees and limits', () => {
  const { choreService } = buildService();

  const addResult = choreService.addChore('Old name', {
    nowIso: '2026-01-01T08:00:00.000Z',
    actorRole: 'parent',
    assignedTo: ['Andrea'],
    value: 5,
    maxPerPeriod: 1,
    unlimitedDailyCap: 1
  });

  const choreId = addResult.state.chores[0].id;
  const updateResult = choreService.updateChore(choreId, {
    actorRole: 'parent',
    name: 'New name',
    value: 12,
    assignedTo: ['Hans Jørgen'],
    maxPerPeriod: 0,
    unlimitedDailyCap: 3
  });

  assert.equal(updateResult.ok, true);
  assert.equal(updateResult.state.chores[0].name, 'New name');
  assert.equal(updateResult.state.chores[0].value, 12);
  assert.deepEqual(updateResult.state.chores[0].assignedTo, ['Hans Jørgen']);
  assert.equal(updateResult.state.chores[0].maxPerPeriod, 0);
  assert.equal(updateResult.state.chores[0].unlimitedDailyCap, 3);
});

test('kid cannot update chore', () => {
  const { choreService } = buildService();

  const addResult = choreService.addChore('Parent task', {
    nowIso: '2026-01-01T08:00:00.000Z',
    actorRole: 'parent'
  });

  const choreId = addResult.state.chores[0].id;
  const updateResult = choreService.updateChore(choreId, {
    actorRole: 'Andrea',
    name: 'Kid edit attempt'
  });

  assert.equal(updateResult.ok, false);
  assert.match(updateResult.message, /Kun forældrevisning/i);
});

test('cannot complete chore twice without undo, then can complete again after undo', () => {
  const { choreService } = buildService();

  const addResult = choreService.addChore('Tidy room', {
    nowIso: '2026-01-01T08:00:00.000Z',
    actorRole: 'parent'
  });
  const choreId = addResult.state.chores[0].id;

  const firstComplete = choreService.completeChore(choreId, {
    nowIso: '2026-01-01T09:00:00.000Z',
    actorRole: 'Hans Jørgen'
  });
  const secondComplete = choreService.completeChore(choreId, {
    nowIso: '2026-01-01T09:30:00.000Z',
    actorRole: 'Hans Jørgen'
  });
  const undo = choreService.undoChore(choreId, {
    nowIso: '2026-01-01T10:00:00.000Z',
    actorRole: 'Hans Jørgen'
  });
  const thirdComplete = choreService.completeChore(choreId, {
    nowIso: '2026-01-01T10:30:00.000Z',
    actorRole: 'Hans Jørgen'
  });

  assert.equal(firstComplete.ok, true);
  assert.equal(secondComplete.ok, false);
  assert.equal(undo.ok, true);
  assert.equal(thirdComplete.ok, true);
});

test('undo rejects timestamp earlier than completedAt', () => {
  const { choreService } = buildService();

  const addResult = choreService.addChore('Set the table', {
    nowIso: '2026-01-01T08:00:00.000Z',
    actorRole: 'parent'
  });
  const choreId = addResult.state.chores[0].id;

  choreService.completeChore(choreId, { nowIso: '2026-01-01T09:00:00.000Z', actorRole: 'Andrea' });
  const undoResult = choreService.undoChore(choreId, {
    nowIso: '2026-01-01T08:59:59.000Z',
    actorRole: 'Andrea'
  });

  assert.equal(undoResult.ok, false);
});

test('complete rejects overlapping interval for same chore', () => {
  const { choreService } = buildService();

  const addResult = choreService.addChore('Water plants', {
    nowIso: '2026-01-01T08:00:00.000Z',
    actorRole: 'parent'
  });
  const choreId = addResult.state.chores[0].id;

  const firstComplete = choreService.completeChore(choreId, {
    nowIso: '2026-01-01T09:00:00.000Z',
    actorRole: 'Andrea'
  });
  const undoResult = choreService.undoChore(choreId, {
    nowIso: '2026-01-01T10:00:00.000Z',
    actorRole: 'Andrea'
  });
  const overlapAttempt = choreService.completeChore(choreId, {
    nowIso: '2026-01-01T09:30:00.000Z',
    actorRole: 'Andrea'
  });

  assert.equal(firstComplete.ok, true);
  assert.equal(undoResult.ok, true);
  assert.equal(overlapAttempt.ok, false);
});

test('storage payload remains compatible with isChoreRecord shape', () => {
  const { choreService, storageService } = buildService();

  const addResult = choreService.addChore('Take out recycling', {
    nowIso: '2026-01-01T08:00:00.000Z',
    actorRole: 'parent'
  });
  const choreId = addResult.state.chores[0].id;

  choreService.completeChore(choreId, { nowIso: '2026-01-01T09:00:00.000Z', actorRole: 'Andrea' });
  const data = storageService.loadData();

  assert.equal(Array.isArray(data.records), true);
  assert.equal(typeof data.records[0].id, 'string');
  assert.equal(typeof data.records[0].choreId, 'string');
  assert.equal(typeof data.records[0].completedAt, 'string');
  assert.equal(data.records[0].undoneAt, null);
  assert.equal(data.ui.activeRole, 'parent');
});

test('parent cannot complete or undo chores', () => {
  const { choreService } = buildService();

  const addResult = choreService.addChore('Pack school bag', {
    nowIso: '2026-01-01T08:00:00.000Z',
    actorRole: 'parent'
  });
  const choreId = addResult.state.chores[0].id;

  const completeAsParent = choreService.completeChore(choreId, {
    nowIso: '2026-01-01T09:00:00.000Z',
    actorRole: 'parent'
  });
  const undoAsParent = choreService.undoChore(choreId, {
    nowIso: '2026-01-01T09:30:00.000Z',
    actorRole: 'parent'
  });

  assert.equal(completeAsParent.ok, false);
  assert.equal(undoAsParent.ok, false);
});

test('kid cannot add chores', () => {
  const { choreService } = buildService();

  const addAsKid = choreService.addChore('Wipe table', {
    nowIso: '2026-01-01T08:00:00.000Z',
    actorRole: 'kid'
  });

  assert.equal(addAsKid.ok, false);
  assert.equal(addAsKid.state.totalChores, 0);
});

test('unassigned child cannot complete chore', () => {
  const { choreService } = buildService();

  const addResult = choreService.addChore('Only Andrea task', {
    nowIso: '2026-01-01T08:00:00.000Z',
    actorRole: 'parent',
    assignedTo: ['Andrea']
  });
  const choreId = addResult.state.chores[0].id;

  const completeAsUnassigned = choreService.completeChore(choreId, {
    nowIso: '2026-01-01T09:00:00.000Z',
    actorRole: 'Hans Jørgen'
  });

  assert.equal(completeAsUnassigned.ok, false);
  assert.match(completeAsUnassigned.message, /tildelt/i);
});

test('completion record stores completedBy actor', () => {
  const { choreService, storageService } = buildService();

  const addResult = choreService.addChore('Fold laundry', {
    nowIso: '2026-01-01T08:00:00.000Z',
    actorRole: 'parent',
    assignedTo: ['Andrea']
  });
  const choreId = addResult.state.chores[0].id;

  const completeResult = choreService.completeChore(choreId, {
    nowIso: '2026-01-01T09:00:00.000Z',
    actorRole: 'Andrea'
  });

  assert.equal(completeResult.ok, true);

  const data = storageService.loadData();
  assert.equal(data.records[0].completedBy, 'Andrea');
  assert.equal(data.records[0].earnedValue, 0);
});

test('completion snapshots earnedValue even if chore value changes later', () => {
  const { choreService, storageService } = buildService();

  const addResult = choreService.addChore('Snapshot task', {
    nowIso: '2026-01-01T08:00:00.000Z',
    actorRole: 'parent',
    assignedTo: ['Andrea'],
    value: 8
  });
  const choreId = addResult.state.chores[0].id;

  const completeResult = choreService.completeChore(choreId, {
    nowIso: '2026-01-01T09:00:00.000Z',
    actorRole: 'Andrea'
  });
  assert.equal(completeResult.ok, true);

  const updateResult = choreService.updateChore(choreId, {
    actorRole: 'parent',
    value: 20
  });
  assert.equal(updateResult.ok, true);

  const data = storageService.loadData();
  assert.equal(data.records[0].earnedValue, 8);
});

test('unlimited chore stores custom unlimitedDailyCap', () => {
  const { choreService } = buildService();

  const result = choreService.addChore('Unlimited repeat task', {
    nowIso: '2026-01-01T08:00:00.000Z',
    actorRole: 'parent',
    maxPerPeriod: 0,
    unlimitedDailyCap: 4
  });

  assert.equal(result.ok, true);
  assert.equal(result.state.chores[0].maxPerPeriod, 0);
  assert.equal(result.state.chores[0].unlimitedDailyCap, 4);
});

test('invalid unlimitedDailyCap is rejected', () => {
  const { choreService } = buildService();

  const result = choreService.addChore('Invalid unlimited cap', {
    nowIso: '2026-01-01T08:00:00.000Z',
    actorRole: 'parent',
    maxPerPeriod: 0,
    unlimitedDailyCap: 0
  });

  assert.equal(result.ok, false);
  assert.match(result.message, /Dagligt loft/i);
});

test('isCompleted is scoped to active period in state', () => {
  const { choreService } = buildService();

  const addResult = choreService.addChore('Period scoped task', {
    nowIso: '2026-01-01T08:00:00.000Z',
    actorRole: 'parent',
    assignedTo: ['Hans Jørgen']
  });
  const choreId = addResult.state.chores[0].id;

  const completeResult = choreService.completeChore(choreId, {
    nowIso: '2026-01-01T09:00:00.000Z',
    actorRole: 'Hans Jørgen',
    periodId: 'period_A'
  });
  assert.equal(completeResult.ok, true);

  const periodAState = choreService.getState({ activePeriodId: 'period_A' });
  const periodBState = choreService.getState({ activePeriodId: 'period_B' });

  assert.equal(periodAState.chores[0].isCompleted, true);
  assert.equal(periodAState.chores[0].periodCompletionCount, 1);
  assert.equal(periodBState.chores[0].isCompleted, false);
  assert.equal(periodBState.chores[0].periodCompletionCount, 0);
});
