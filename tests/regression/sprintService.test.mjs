import test from 'node:test';
import assert from 'node:assert/strict';

import { createChoreService } from '../../src/services/choreService.js';
import { createSprintService } from '../../src/services/sprintService.js';
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
  const sprintService = createSprintService({ storageService });

  const sprint = sprintService.ensureActiveSprint();

  return { choreService, sprintService, sprintId: sprint.id };
}

test('shared assignment pays only completing child', () => {
  const { choreService, sprintService, sprintId } = buildServices();

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
    sprintId
  });

  assert.equal(complete.ok, true);

  const earnings = sprintService.getSprintEarnings(sprintId);
  assert.equal(earnings.Andrea, 20);
  assert.equal(earnings['Hans Jørgen'], 0);
});

test('collaboration split totals equal chore value', () => {
  const { choreService, sprintService, sprintId } = buildServices();

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
    sprintId,
    nowIso: '2026-01-01T09:00:00.000Z'
  });

  assert.equal(accepted.ok, true);

  const earnings = sprintService.getSprintEarnings(sprintId);
  assert.equal(earnings.Andrea, 15);
  assert.equal(earnings['Hans Jørgen'], 15);
  assert.equal(earnings.Andrea + earnings['Hans Jørgen'], 30);
});
