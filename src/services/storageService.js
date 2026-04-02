import { isOnOrAfter, isValidIsoTimestamp } from '../shared/dateTime.js';
import { isSupabaseConfigured } from '../config/supabaseConfig.js';
import { saveChores, saveRecords, saveUiState, saveSprints, saveSettings } from './supabaseService.js';
import { createSyncQueue } from './syncQueueService.js';

export const STORAGE_KEY = 'kids_chore_tracker_v1';

export const KIDS = ['Hans Jørgen', 'Andrea'];
const ALLOWED_ROLES = new Set(['parent', ...KIDS]);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isChoreRecord(value) {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const hasValidCore =
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.choreId) &&
    isValidIsoTimestamp(value.completedAt);

  if (!hasValidCore) {
    return false;
  }

  const hasValidCompletedBy =
    value.completedBy === undefined ||
    (typeof value.completedBy === 'string' && KIDS.includes(value.completedBy));
  if (!hasValidCompletedBy) {
    return false;
  }

  const hasValidEarnedValue =
    value.earnedValue === undefined ||
    (typeof value.earnedValue === 'number' && Number.isFinite(value.earnedValue) && value.earnedValue >= 0);
  if (!hasValidEarnedValue) {
    return false;
  }

  const hasValidSprintId =
    value.sprintId === undefined || value.sprintId === null || isNonEmptyString(value.sprintId);
  if (!hasValidSprintId) {
    return false;
  }

  if (value.undoneAt === null) {
    return true;
  }

  return isValidIsoTimestamp(value.undoneAt) && isOnOrAfter(value.undoneAt, value.completedAt);
}

function isChoreItem(value) {
  const hasValidUnlimitedDailyCap =
    Number.isInteger(value.unlimitedDailyCap) && value.unlimitedDailyCap >= 1;

  return (
    value &&
    typeof value === 'object' &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    isValidIsoTimestamp(value.createdAt) &&
    Array.isArray(value.assignedTo) &&
    value.assignedTo.every(kid => KIDS.includes(kid)) &&
    value.assignedTo.length > 0 &&
    typeof value.value === 'number' &&
    typeof value.maxPerSprint === 'number' &&
    hasValidUnlimitedDailyCap
  );
}

function isCollabItem(value) {
  return (
    value &&
    typeof value === 'object' &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.choreId) &&
    isNonEmptyString(value.proposedBy)
  );
}

function isUiState(value) {
  return (
    value &&
    typeof value === 'object' &&
    typeof value.activeRole === 'string' &&
    ALLOWED_ROLES.has(value.activeRole)
  );
}

function createDefaultUiState() {
  return {
    activeRole: 'parent'
  };
}

function createDefaultSettings() {
  return { sprintLengthDays: 7 };
}

function createEmptyPayload() {
  return {
    chores: [],
    records: [],
    ui: createDefaultUiState(),
    sprints: [],
    settings: createDefaultSettings(),
    pendingCollaborations: []
  };
}

function isSprintItem(value) {
  return (
    value &&
    typeof value === 'object' &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.startDate) &&
    isNonEmptyString(value.endDate) &&
    (value.status === 'active' || value.status === 'paid')
  );
}

function isPayload(value) {
  return (
    value &&
    typeof value === 'object' &&
    Array.isArray(value.chores) &&
    Array.isArray(value.records) &&
    isUiState(value.ui) &&
    Array.isArray(value.sprints) &&
    value.sprints.every(isSprintItem) &&
    value.settings &&
    typeof value.settings === 'object' &&
    Number.isInteger(value.settings.sprintLengthDays) &&
    Array.isArray(value.pendingCollaborations) &&
    value.pendingCollaborations.every(isCollabItem) &&
    value.chores.every(isChoreItem) &&
    value.records.every(isChoreRecord)
  );
}

function isLegacyPayload(value) {
  // Lenient check — individual items are migrated in normalizePayload
  return (
    value &&
    typeof value === 'object' &&
    Array.isArray(value.chores) &&
    Array.isArray(value.records)
  );
}

function normalizePayload(value) {
  if (isPayload(value)) {
    return value;
  }

  if (isLegacyPayload(value)) {
    const migratedChores = value.chores
      .filter(c => c && isNonEmptyString(c.id) && isNonEmptyString(c.name))
      .map(chore => ({
        id: chore.id,
        name: chore.name,
        createdAt: isValidIsoTimestamp(chore.createdAt) ? chore.createdAt : new Date().toISOString(),
        assignedTo: Array.isArray(chore.assignedTo) && chore.assignedTo.length > 0 ? chore.assignedTo : KIDS,
        value: typeof chore.value === 'number' ? chore.value : 0,
        maxPerSprint: typeof chore.maxPerSprint === 'number' ? chore.maxPerSprint : 1,
        unlimitedDailyCap: Number.isInteger(chore.unlimitedDailyCap) && chore.unlimitedDailyCap >= 1
          ? chore.unlimitedDailyCap
          : 1
      }));

    const migratedRecords = value.records.filter(r => isChoreRecord(r));

    return {
      chores: migratedChores,
      records: migratedRecords,
      ui: isUiState(value.ui) ? value.ui : createDefaultUiState(),
      sprints: Array.isArray(value.sprints) ? value.sprints.filter(isSprintItem) : [],
      settings: value.settings && Number.isInteger(value.settings.sprintLengthDays)
        ? value.settings
        : createDefaultSettings(),
      pendingCollaborations: Array.isArray(value.pendingCollaborations)
        ? value.pendingCollaborations.filter(isCollabItem)
        : []
    };
  }

  return createEmptyPayload();
}

export function createStorageService({ storage = globalThis.localStorage, storageKey = STORAGE_KEY } = {}) {
  let userId = 'anonymous';
  const syncQueue = createSyncQueue();

  function loadData() {
    if (!storage) {
      return createEmptyPayload();
    }

    const raw = storage.getItem(storageKey);
    if (!raw) {
      return createEmptyPayload();
    }

    try {
      const parsed = JSON.parse(raw);
      return normalizePayload(parsed);
    } catch {
      return createEmptyPayload();
    }
  }

  function saveData(nextData) {
    if (!isPayload(nextData)) {
      throw new Error('Storage payload shape is invalid.');
    }

    if (!storage) {
      return;
    }

    // Save to localStorage immediately (synchronous)
    storage.setItem(storageKey, JSON.stringify(nextData));

    // Queue Supabase syncs (serialized, not parallel)
    if (isSupabaseConfigured()) {
      syncQueue.enqueue('chores', nextData.chores, data => 
        saveChores(data, userId)
      );
      syncQueue.enqueue('records', nextData.records, data => 
        saveRecords(data, userId)
      );
      syncQueue.enqueue('ui', nextData.ui.activeRole, data => 
        saveUiState(data, userId)
      );
      syncQueue.enqueue('sprints', nextData.sprints, data => 
        saveSprints(data, userId)
      );
      syncQueue.enqueue('settings', nextData.settings, data => 
        saveSettings(data, userId)
      );
    }
  }

  function updateData(updater) {
    const currentData = loadData();
    const nextData = updater(currentData);
    saveData(nextData);
    return nextData;
  }

  function setUserId(newUserId) {
    userId = newUserId;
  }

  function getSyncState() {
    return syncQueue.getSyncState();
  }

  async function syncNow() {
    return syncQueue.syncNow();
  }

  return {
    loadData,
    saveData,
    updateData,
    setUserId,
    getSyncState,
    syncNow
  };
}
