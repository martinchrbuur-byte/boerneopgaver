import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createRemoteSnapshotKey,
  hasMeaningfulLocalData,
  reconcileCloudSnapshot,
  toRemoteStorageShape
} from '../../src/services/remoteSyncService.js';
import { findMissingEntityIds } from '../../src/services/supabaseService.js';

test('reconcileCloudSnapshot applies remote edits and deletions when local queue is clean', () => {
  const localData = {
    chores: [
      { id: 'chore-1', name: 'Old name', createdAt: '2026-04-10T10:00:00.000Z', assignedTo: ['Andrea'], value: 10, maxPerPeriod: 1, unlimitedDailyCap: 1 },
      { id: 'chore-2', name: 'To delete', createdAt: '2026-04-10T11:00:00.000Z', assignedTo: ['Hans Jørgen'], value: 5, maxPerPeriod: 1, unlimitedDailyCap: 1 }
    ],
    records: [
      { id: 'record-1', choreId: 'chore-2', completedAt: '2026-04-10T12:00:00.000Z', undoneAt: null, periodId: null }
    ],
    ui: { activeRole: 'parent' },
    feedback: [],
    periods: [],
    settings: { periodLengthDays: 7 },
    pendingCollaborations: [],
    syncMeta: {}
  };

  const supabaseData = {
    chores: [
      { id: 'chore-1', name: 'New name', createdAt: '2026-04-10T10:00:00.000Z', assignedTo: ['Andrea'], value: 15, maxPerPeriod: 1, unlimitedDailyCap: 1 }
    ],
    records: [],
    ui: { activeRole: 'Andrea', updatedAt: '2026-04-11T09:00:00.000Z' },
    feedback: [],
    periods: [],
    settings: { periodLengthDays: 7, updatedAt: '2026-04-11T09:00:00.000Z' },
    userId: 'user-1'
  };

  const result = reconcileCloudSnapshot({
    localData,
    syncState: { queueLength: 0, deadLetterCount: 0, failureCount: 0 },
    supabaseData
  });

  assert.equal(result.action, 'apply-remote');
  assert.deepEqual(result.nextData.chores, toRemoteStorageShape(supabaseData).chores);
  assert.deepEqual(result.nextData.records, []);
  assert.equal(result.nextData.ui.activeRole, 'Andrea');
});

test('reconcileCloudSnapshot claims local data when remote is empty', () => {
  const result = reconcileCloudSnapshot({
    localData: {
      chores: [{ id: 'chore-1' }],
      records: [],
      feedback: [],
      periods: [],
      settings: { periodLengthDays: 7 }
    },
    syncState: { queueLength: 0, deadLetterCount: 0, failureCount: 0 },
    supabaseData: {
      chores: [],
      records: [],
      ui: { activeRole: 'parent' },
      feedback: [],
      periods: [],
      settings: { periodLengthDays: 7 },
      userId: 'user-1'
    }
  });

  assert.equal(result.action, 'claim-local');
});

test('reconcileCloudSnapshot skips remote overwrite when local sync is pending', () => {
  const result = reconcileCloudSnapshot({
    localData: {
      chores: [{ id: 'chore-1' }],
      records: [],
      feedback: [],
      periods: [],
      settings: { periodLengthDays: 7 }
    },
    syncState: { queueLength: 1, deadLetterCount: 0, failureCount: 0 },
    supabaseData: {
      chores: [{ id: 'remote-1' }],
      records: [],
      ui: { activeRole: 'parent' },
      feedback: [],
      periods: [],
      settings: { periodLengthDays: 7 },
      userId: 'user-1'
    }
  });

  assert.equal(result.action, 'skip-remote');
});

test('createRemoteSnapshotKey changes when remote shape changes', () => {
  const base = createRemoteSnapshotKey({
    chores: [{ id: 'chore-1', name: 'A' }],
    records: [],
    ui: { activeRole: 'parent' },
    feedback: [],
    periods: [],
    settings: { periodLengthDays: 7 },
    userId: 'user-1'
  });

  const next = createRemoteSnapshotKey({
    chores: [{ id: 'chore-1', name: 'B' }],
    records: [],
    ui: { activeRole: 'parent' },
    feedback: [],
    periods: [],
    settings: { periodLengthDays: 7 },
    userId: 'user-1'
  });

  assert.notEqual(base, next);
  assert.equal(hasMeaningfulLocalData({ chores: [], records: [], feedback: [], periods: [], settings: { periodLengthDays: 7 } }), false);
});

test('findMissingEntityIds identifies rows deleted on another device', () => {
  const missingIds = findMissingEntityIds(
    [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    [{ id: 'a' }, { id: 'c' }]
  );

  assert.deepEqual(missingIds, ['b']);
});