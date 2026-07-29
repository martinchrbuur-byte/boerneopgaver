import test from 'node:test';
import assert from 'node:assert/strict';

import { createChoreService } from '../../src/services/choreService.js';
import { createRouletteService } from '../../src/services/rouletteService.js';
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
    removeItem(key) {
      store.delete(key);
    }
  };
}

function buildServices() {
  const storageService = createStorageService({ storage: createMemoryStorage() });
  const choreService = createChoreService({
    storageService,
    nowProvider: () => '2026-01-01T08:00:00.000Z'
  });
  const rouletteService = createRouletteService({
    storageService,
    choreService,
    nowProvider: () => '2026-01-01T08:00:00.000Z'
  });

  return { storageService, choreService, rouletteService };
}

test('createWheel snapshots active chore segments and preserves unrelated storage data', () => {
  const { storageService, choreService, rouletteService } = buildServices();

  storageService.updateData(data => ({
    ...data,
    ui: { activeRole: 'Andrea' }
  }));

  choreService.addChore('Andrea task', {
    actorRole: 'parent',
    assignedTo: ['Andrea'],
    nowIso: '2026-01-01T09:00:00.000Z'
  });
  choreService.addChore('Shared task', {
    actorRole: 'parent',
    assignedTo: ['Andrea', 'Hans Jørgen'],
    nowIso: '2026-01-01T09:05:00.000Z'
  });
  const completed = choreService.addChore('Done task', {
    actorRole: 'parent',
    assignedTo: ['Hans Jørgen'],
    nowIso: '2026-01-01T09:10:00.000Z'
  });
  choreService.completeChore(completed.state.chores.find(chore => chore.name === 'Done task').id, {
    actorRole: 'Hans Jørgen',
    nowIso: '2026-01-01T09:15:00.000Z'
  });

  const result = rouletteService.createWheel({
    actorRole: 'parent',
    householdId: 'house-1',
    meta: { source: 'chores' },
    nowIso: '2026-01-01T10:00:00.000Z'
  });

  assert.equal(result.ok, true);
  assert.equal(result.state.wheel.householdId, 'house-1');
  assert.deepEqual(result.state.wheel.segments.map(segment => segment.label), ['Andrea task', 'Shared task']);

  const stored = storageService.loadData();
  assert.equal(stored.ui.activeRole, 'Andrea');
  assert.deepEqual(stored.roulette.wheel.meta, { source: 'chores' });
  assert.equal(stored.roulette.wheel.updatedAt, '2026-01-01T10:00:00.000Z');
  assert.deepEqual(stored.roulette.history, []);

  const kidWheel = rouletteService.getWheel({ actorRole: 'Andrea' });
  assert.deepEqual(kidWheel.state.wheel.segments.map(segment => segment.label), ['Andrea task', 'Shared task']);
});

test('parent-only segment configuration APIs mutate only roulette state', () => {
  const { storageService, rouletteService } = buildServices();

  const created = rouletteService.createWheel({
    actorRole: 'parent',
    householdId: 'house-2',
    segments: [
      { id: 'seg-a', label: 'A', assignedTo: ['Andrea'], weight: 1 },
      { id: 'seg-b', label: 'B', assignedTo: ['Hans Jørgen'], weight: 1 }
    ],
    nowIso: '2026-01-01T11:00:00.000Z'
  });
  assert.equal(created.ok, true);

  assert.equal(rouletteService.addSegment({ label: 'Kid edit' }, { actorRole: 'Andrea' }).ok, false);
  assert.equal(rouletteService.spinWheel({ actorRole: 'parent', randomValue: 0.1 }).ok, false);

  const added = rouletteService.addSegment({
    id: 'seg-c',
    label: 'Shared',
    assignedTo: ['Andrea', 'Hans Jørgen'],
    weight: 2
  }, {
    actorRole: 'parent',
    nowIso: '2026-01-01T11:05:00.000Z'
  });
  assert.equal(added.ok, true);

  const updated = rouletteService.updateSegment('seg-c', { weight: 5 }, {
    actorRole: 'parent',
    nowIso: '2026-01-01T11:06:00.000Z'
  });
  assert.equal(updated.ok, true);

  const reordered = rouletteService.reorderSegments(['seg-c', 'seg-a', 'seg-b'], {
    actorRole: 'parent',
    nowIso: '2026-01-01T11:07:00.000Z'
  });
  assert.equal(reordered.ok, true);
  assert.deepEqual(reordered.state.wheel.segments.map(segment => segment.id), ['seg-c', 'seg-a', 'seg-b']);

  const removed = rouletteService.removeSegment('seg-b', {
    actorRole: 'parent',
    nowIso: '2026-01-01T11:08:00.000Z'
  });
  assert.equal(removed.ok, true);
  assert.deepEqual(removed.state.wheel.segments.map(segment => segment.id), ['seg-c', 'seg-a']);

  const stored = storageService.loadData();
  assert.deepEqual(stored.roulette.wheel.segments.map(segment => ({ id: segment.id, weight: segment.weight })), [
    { id: 'seg-c', weight: 5 },
    { id: 'seg-a', weight: 1 }
  ]);
  assert.equal(stored.ui.activeRole, 'parent');
});

test('spinWheel uses deterministic weights, kid permissions, and filtered history', () => {
  const { rouletteService } = buildServices();

  rouletteService.createWheel({
    actorRole: 'parent',
    householdId: 'house-3',
    segments: [
      { id: 'andrea', label: 'Andrea task', assignedTo: ['Andrea'], weight: 1 },
      { id: 'shared', label: 'Shared task', assignedTo: ['Andrea', 'Hans Jørgen'], weight: 3 },
      { id: 'hans', label: 'Hans task', assignedTo: ['Hans Jørgen'], weight: 1 }
    ],
    nowIso: '2026-01-01T12:00:00.000Z'
  });

  const andreaSpin = rouletteService.spinWheel({
    actorRole: 'Andrea',
    randomValue: 0.3,
    nowIso: '2026-01-01T12:05:00.000Z',
    fullRotations: 1
  });
  const hansSpin = rouletteService.spinWheel({
    actorRole: 'Hans Jørgen',
    randomValue: 0.95,
    nowIso: '2026-01-01T12:06:00.000Z',
    fullRotations: 1
  });

  assert.equal(andreaSpin.ok, true);
  assert.equal(hansSpin.ok, true);
  assert.equal(andreaSpin.state.history[0].label, 'Shared task');
  assert.equal(andreaSpin.state.history[0].targetKid, 'Andrea');
  assert.deepEqual(andreaSpin.state.history[0].assignedTo, ['Andrea']);
  assert.equal(andreaSpin.state.history[0].createdAt, '2026-01-01T12:05:00.000Z');
  assert.equal(andreaSpin.state.history[0].angle, 495);

  const andreaHistory = rouletteService.getSpinHistory({ actorRole: 'Andrea' });
  const parentHistory = rouletteService.getSpinHistory({ actorRole: 'parent' });

  assert.deepEqual(andreaHistory.state.history.map(entry => entry.label), ['Shared task']);
  assert.deepEqual(parentHistory.state.history.map(entry => entry.label), ['Hans task', 'Shared task']);
});

test('service can generate wheel from storage chores without injected choreService', () => {
  const storageService = createStorageService({ storage: createMemoryStorage() });
  storageService.updateData(data => ({
    ...data,
    chores: [
      {
        id: 'chore-1',
        name: 'Storage chore',
        createdAt: '2026-01-01T08:00:00.000Z',
        assignedTo: ['Andrea'],
        value: 0,
        maxPerPeriod: 1,
        unlimitedDailyCap: 1
      }
    ]
  }));

  const rouletteService = createRouletteService({
    storageService,
    nowProvider: () => '2026-01-01T13:00:00.000Z'
  });

  const result = rouletteService.getWheel({ actorRole: 'parent' });

  assert.equal(result.ok, true);
  assert.deepEqual(result.state.wheel.segments.map(segment => ({
    label: segment.label,
    sourceId: segment.sourceId
  })), [
    { label: 'Storage chore', sourceId: 'chore-1' }
  ]);
});
