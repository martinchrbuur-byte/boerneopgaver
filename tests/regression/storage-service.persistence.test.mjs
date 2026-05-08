import test from 'node:test';
import assert from 'node:assert/strict';

import {
  STORAGE_BACKUP_LATEST_SUFFIX,
  STORAGE_JOURNAL_SUFFIX,
  createStorageService
} from '../../src/services/storageService.js';

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
    },
    clear() {
      store.clear();
    }
  };
}

function buildValidPayloadWithChore(choreId, choreName) {
  const nowIso = '2026-05-08T12:00:00.000Z';
  return {
    chores: [
      {
        id: choreId,
        name: choreName,
        createdAt: nowIso,
        assignedTo: ['Andrea'],
        value: 5,
        maxPerPeriod: 1,
        unlimitedDailyCap: 1
      }
    ],
    records: [],
    ui: { activeRole: 'parent' },
    feedback: [],
    periods: [],
    settings: { periodLengthDays: 7 },
    pendingCollaborations: [],
    syncMeta: {
      choresUpdatedAt: nowIso,
      recordsUpdatedAt: nowIso,
      uiUpdatedAt: nowIso,
      feedbackUpdatedAt: nowIso,
      periodsUpdatedAt: nowIso,
      settingsUpdatedAt: nowIso,
      lastLocalWriteAt: nowIso,
      lastRemoteMergeAt: null
    }
  };
}

test('loadData recovers from latest backup when primary storage is corrupted', () => {
  const storage = createMemoryStorage();
  const storageKey = 'kids_chore_tracker_test';
  const storageService = createStorageService({ storage, storageKey });

  const firstPayload = buildValidPayloadWithChore('chore-1', 'Første opgave');
  const secondPayload = buildValidPayloadWithChore('chore-2', 'Anden opgave');

  storageService.saveData(firstPayload);
  storageService.saveData(secondPayload);

  storage.setItem(storageKey, '{invalid-json');

  const recovered = storageService.loadData();

  assert.equal(recovered.chores.length, 1);
  assert.equal(recovered.chores[0].id, 'chore-1');

  const healedMain = JSON.parse(storage.getItem(storageKey));
  assert.equal(healedMain.chores[0].id, 'chore-1');
});

test('loadData recovers from journal and clears journal after self-heal', () => {
  const storage = createMemoryStorage();
  const storageKey = 'kids_chore_tracker_test_journal';
  const storageService = createStorageService({ storage, storageKey });

  const payload = buildValidPayloadWithChore('chore-9', 'Journal-opgave');
  const journalKey = `${storageKey}${STORAGE_JOURNAL_SUFFIX}`;

  storage.setItem(storageKey, '{corrupted-main');
  storage.setItem(journalKey, JSON.stringify(payload));

  const recovered = storageService.loadData();

  assert.equal(recovered.chores.length, 1);
  assert.equal(recovered.chores[0].id, 'chore-9');

  const healedMain = JSON.parse(storage.getItem(storageKey));
  assert.equal(healedMain.chores[0].id, 'chore-9');
  assert.equal(storage.getItem(journalKey), null);
});

test('saveData rotates main snapshot into latest backup before overwrite', () => {
  const storage = createMemoryStorage();
  const storageKey = 'kids_chore_tracker_test_backup';
  const storageService = createStorageService({ storage, storageKey });

  const firstPayload = buildValidPayloadWithChore('chore-a', 'Backup A');
  const secondPayload = buildValidPayloadWithChore('chore-b', 'Backup B');

  storageService.saveData(firstPayload);
  storageService.saveData(secondPayload);

  const latestBackupKey = `${storageKey}${STORAGE_BACKUP_LATEST_SUFFIX}`;
  const latestBackupRaw = storage.getItem(latestBackupKey);

  assert.notEqual(latestBackupRaw, null);
  const latestBackup = JSON.parse(latestBackupRaw);
  assert.equal(latestBackup.chores[0].id, 'chore-a');
});
