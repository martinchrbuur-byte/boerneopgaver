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
