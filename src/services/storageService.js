import { isOnOrAfter, isValidIsoTimestamp, nowIsoTimestamp } from '../shared/dateTime.js';
import { applySectionSyncTimestamps } from '../shared/sectionDiff.js';
import { isSupabaseConfigured } from '../config/supabaseConfig.js';
import { saveChores, saveFeedback, savePeriods, saveRecords, saveSettings, saveUiState } from './supabaseService.js';
import { createSyncQueue } from './syncQueueService.js';

export const STORAGE_KEY = 'kids_chore_tracker_v1';

export const KIDS = ['Hans Jørgen', 'Andrea'];
const ALLOWED_ROLES = new Set(['parent', ...KIDS]);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeRecord(record) {
  if (!record || typeof record !== 'object') {
    return null;
  }

  return {
    id: record.id,
    choreId: record.choreId,
    completedAt: record.completedAt,
    undoneAt: record.undoneAt ?? null,
    periodId: record.periodId ?? record.sprintId ?? null,
    completedBy: record.completedBy,
    earnedValue: record.earnedValue
  };
}

function normalizeChore(chore) {
  if (!chore || typeof chore !== 'object') {
    return null;
  }

  return {
    id: chore.id,
    name: chore.name,
    createdAt: isValidIsoTimestamp(chore.createdAt) ? chore.createdAt : nowIsoTimestamp(),
    assignedTo: Array.isArray(chore.assignedTo) && chore.assignedTo.length > 0 ? chore.assignedTo : KIDS,
    value: typeof chore.value === 'number' ? chore.value : 0,
    maxPerPeriod: typeof chore.maxPerPeriod === 'number'
      ? chore.maxPerPeriod
      : (typeof chore.maxPerSprint === 'number' ? chore.maxPerSprint : 1),
    unlimitedDailyCap: Number.isInteger(chore.unlimitedDailyCap) && chore.unlimitedDailyCap >= 1
      ? chore.unlimitedDailyCap
      : 1
  };
}

function normalizePeriod(period) {
  if (!period || typeof period !== 'object') {
    return null;
  }

  return {
    id: period.id,
    startDate: period.startDate,
    endDate: period.endDate,
    status: period.status,
    paidAt: period.paidAt ?? null,
    createdAt: isValidIsoTimestamp(period.createdAt) ? period.createdAt : nowIsoTimestamp()
  };
}

export function isChoreRecord(value) {
  const record = normalizeRecord(value);
  if (!record) {
    return false;
  }

  const hasValidCore =
    isNonEmptyString(record.id) &&
    isNonEmptyString(record.choreId) &&
    isValidIsoTimestamp(record.completedAt);

  if (!hasValidCore) {
    return false;
  }

  const hasValidCompletedBy =
    record.completedBy === undefined ||
    (typeof record.completedBy === 'string' && KIDS.includes(record.completedBy));
  if (!hasValidCompletedBy) {
    return false;
  }

  const hasValidEarnedValue =
    record.earnedValue === undefined ||
    (typeof record.earnedValue === 'number' && Number.isFinite(record.earnedValue) && record.earnedValue >= 0);
  if (!hasValidEarnedValue) {
    return false;
  }

  const hasValidPeriodId =
    record.periodId === undefined || record.periodId === null || isNonEmptyString(record.periodId);
  if (!hasValidPeriodId) {
    return false;
  }

  if (record.undoneAt === null) {
    return true;
  }

  return isValidIsoTimestamp(record.undoneAt) && isOnOrAfter(record.undoneAt, record.completedAt);
}

function isChoreItem(value) {
  const chore = normalizeChore(value);
  const hasValidUnlimitedDailyCap =
    Number.isInteger(chore?.unlimitedDailyCap) && chore.unlimitedDailyCap >= 1;

  return (
    chore &&
    isNonEmptyString(chore.id) &&
    isNonEmptyString(chore.name) &&
    isValidIsoTimestamp(chore.createdAt) &&
    Array.isArray(chore.assignedTo) &&
    chore.assignedTo.every(kid => KIDS.includes(kid)) &&
    chore.assignedTo.length > 0 &&
    typeof chore.value === 'number' &&
    typeof chore.maxPerPeriod === 'number' &&
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

function isFeedbackItem(value) {
  return (
    value &&
    typeof value === 'object' &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.message) &&
    isValidIsoTimestamp(value.createdAt) &&
    value.createdBy === 'parent' &&
    (value.title === undefined || typeof value.title === 'string') &&
    (value.category === undefined || isNonEmptyString(value.category)) &&
    (value.status === undefined || value.status === 'open')
  );
}

function createDefaultUiState() {
  return {
    activeRole: 'parent'
  };
}

function createDefaultSettings() {
  return { periodLengthDays: 7 };
}

function createDefaultSyncMeta() {
  const now = nowIsoTimestamp();
  return {
    choresUpdatedAt: now,
    recordsUpdatedAt: now,
    uiUpdatedAt: now,
    feedbackUpdatedAt: now,
    periodsUpdatedAt: now,
    settingsUpdatedAt: now,
    lastLocalWriteAt: now,
    lastRemoteMergeAt: null
  };
}

function createEmptyPayload() {
  return {
    chores: [],
    records: [],
    ui: createDefaultUiState(),
    feedback: [],
    periods: [],
    settings: createDefaultSettings(),
    pendingCollaborations: [],
    syncMeta: createDefaultSyncMeta()
  };
}

function isPeriodItem(value) {
  const period = normalizePeriod(value);
  return (
    period &&
    isNonEmptyString(period.id) &&
    isNonEmptyString(period.startDate) &&
    isNonEmptyString(period.endDate) &&
    (period.status === 'active' || period.status === 'paid')
  );
}

function isPayload(value) {
  const hasValidSyncMeta =
    !value.syncMeta ||
    (
      typeof value.syncMeta === 'object' &&
      value.syncMeta !== null &&
      (value.syncMeta.choresUpdatedAt === undefined || isValidIsoTimestamp(value.syncMeta.choresUpdatedAt)) &&
      (value.syncMeta.recordsUpdatedAt === undefined || isValidIsoTimestamp(value.syncMeta.recordsUpdatedAt)) &&
      (value.syncMeta.uiUpdatedAt === undefined || isValidIsoTimestamp(value.syncMeta.uiUpdatedAt)) &&
      (value.syncMeta.feedbackUpdatedAt === undefined || isValidIsoTimestamp(value.syncMeta.feedbackUpdatedAt)) &&
      (value.syncMeta.periodsUpdatedAt === undefined || isValidIsoTimestamp(value.syncMeta.periodsUpdatedAt)) &&
      (value.syncMeta.settingsUpdatedAt === undefined || isValidIsoTimestamp(value.syncMeta.settingsUpdatedAt)) &&
      (value.syncMeta.lastLocalWriteAt === undefined || isValidIsoTimestamp(value.syncMeta.lastLocalWriteAt)) &&
      (value.syncMeta.lastRemoteMergeAt === undefined || value.syncMeta.lastRemoteMergeAt === null || isValidIsoTimestamp(value.syncMeta.lastRemoteMergeAt))
    );

  return (
    value &&
    typeof value === 'object' &&
    Array.isArray(value.chores) &&
    Array.isArray(value.records) &&
    isUiState(value.ui) &&
    Array.isArray(value.feedback) &&
    Array.isArray(value.periods) &&
    value.periods.every(isPeriodItem) &&
    value.settings &&
    typeof value.settings === 'object' &&
    Number.isInteger(value.settings.periodLengthDays) &&
    Array.isArray(value.pendingCollaborations) &&
    value.pendingCollaborations.every(isCollabItem) &&
    value.chores.every(isChoreItem) &&
    value.records.every(isChoreRecord) &&
    value.feedback.every(isFeedbackItem) &&
    hasValidSyncMeta
  );
}

function isLegacyPayload(value) {
  return (
    value &&
    typeof value === 'object' &&
    Array.isArray(value.chores) &&
    Array.isArray(value.records)
  );
}

function normalizePayload(value) {
  const defaultSyncMeta = createDefaultSyncMeta();

  function normalizeSyncMeta(syncMeta) {
    if (!syncMeta || typeof syncMeta !== 'object') {
      return defaultSyncMeta;
    }

    return {
      choresUpdatedAt: isValidIsoTimestamp(syncMeta.choresUpdatedAt)
        ? syncMeta.choresUpdatedAt
        : defaultSyncMeta.choresUpdatedAt,
      recordsUpdatedAt: isValidIsoTimestamp(syncMeta.recordsUpdatedAt)
        ? syncMeta.recordsUpdatedAt
        : defaultSyncMeta.recordsUpdatedAt,
      uiUpdatedAt: isValidIsoTimestamp(syncMeta.uiUpdatedAt)
        ? syncMeta.uiUpdatedAt
        : defaultSyncMeta.uiUpdatedAt,
      feedbackUpdatedAt: isValidIsoTimestamp(syncMeta.feedbackUpdatedAt)
        ? syncMeta.feedbackUpdatedAt
        : defaultSyncMeta.feedbackUpdatedAt,
      periodsUpdatedAt: isValidIsoTimestamp(syncMeta.periodsUpdatedAt)
        ? syncMeta.periodsUpdatedAt
        : (isValidIsoTimestamp(syncMeta.sprintsUpdatedAt)
            ? syncMeta.sprintsUpdatedAt
            : defaultSyncMeta.periodsUpdatedAt),
      settingsUpdatedAt: isValidIsoTimestamp(syncMeta.settingsUpdatedAt)
        ? syncMeta.settingsUpdatedAt
        : defaultSyncMeta.settingsUpdatedAt,
      lastLocalWriteAt: isValidIsoTimestamp(syncMeta.lastLocalWriteAt)
        ? syncMeta.lastLocalWriteAt
        : defaultSyncMeta.lastLocalWriteAt,
      lastRemoteMergeAt:
        syncMeta.lastRemoteMergeAt === null || isValidIsoTimestamp(syncMeta.lastRemoteMergeAt)
          ? syncMeta.lastRemoteMergeAt
          : null
    };
  }

  if (isPayload(value)) {
    return {
      ...value,
      chores: value.chores.map(normalizeChore).filter(isChoreItem),
      records: value.records.map(normalizeRecord).filter(isChoreRecord),
      feedback: Array.isArray(value.feedback) ? value.feedback.filter(isFeedbackItem) : [],
      periods: value.periods.map(normalizePeriod).filter(isPeriodItem),
      settings: { periodLengthDays: value.settings.periodLengthDays },
      syncMeta: normalizeSyncMeta(value.syncMeta)
    };
  }

  if (isLegacyPayload(value)) {
    const migratedChores = value.chores
      .map(normalizeChore)
      .filter(isChoreItem);

    const migratedRecords = value.records
      .map(normalizeRecord)
      .filter(isChoreRecord);

    const rawPeriods = Array.isArray(value.periods)
      ? value.periods
      : (Array.isArray(value.sprints) ? value.sprints : []);
    const rawSettings = value.settings && typeof value.settings === 'object' ? value.settings : {};

    return {
      chores: migratedChores,
      records: migratedRecords,
      ui: isUiState(value.ui) ? value.ui : createDefaultUiState(),
      feedback: Array.isArray(value.feedback) ? value.feedback.filter(isFeedbackItem) : [],
      periods: rawPeriods.map(normalizePeriod).filter(isPeriodItem),
      settings: {
        periodLengthDays: Number.isInteger(rawSettings.periodLengthDays)
          ? rawSettings.periodLengthDays
          : (Number.isInteger(rawSettings.sprintLengthDays) ? rawSettings.sprintLengthDays : 7)
      },
      pendingCollaborations: Array.isArray(value.pendingCollaborations)
        ? value.pendingCollaborations.filter(isCollabItem)
        : [],
      syncMeta: normalizeSyncMeta(value.syncMeta)
    };
  }

  return createEmptyPayload();
}

export function createStorageService({ storage = globalThis.localStorage, storageKey = STORAGE_KEY } = {}) {
  let userId = 'anonymous';
  const syncQueue = createSyncQueue();
  const backupKey = `${storageKey}_backup`;

  syncQueue.registerHandler('chores', data => saveChores(data, userId));
  syncQueue.registerHandler('records', data => saveRecords(data, userId));
  syncQueue.registerHandler('ui', data => saveUiState(data, userId));
  syncQueue.registerHandler('feedback', data => saveFeedback(data, userId));
  syncQueue.registerHandler('periods', data => savePeriods(data, userId));
  syncQueue.registerHandler('settings', data => saveSettings(data, userId));

  const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
  if (isSupabaseConfigured() && isOnline) {
    syncQueue.syncNow().catch(error => {
      console.warn('Initial queued sync failed:', error);
    });
  }

  function loadData() {
    if (!storage) {
      return createEmptyPayload();
    }

    const raw = storage.getItem(storageKey);
    if (!raw) {
      // Try restoring from backup if primary key is empty
      const backupRaw = storage.getItem(backupKey);
      if (backupRaw) {
        try {
          const parsed = JSON.parse(backupRaw);
          const normalized = normalizePayload(parsed);
          if (isPayload(normalized) && hasMeaningfulData(normalized)) {
            console.warn('Restored data from backup key.');
            return normalized;
          }
        } catch {
          // Backup also unreadable
        }
      }
      return createEmptyPayload();
    }

    try {
      const parsed = JSON.parse(raw);
      return normalizePayload(parsed);
    } catch {
      // Primary data corrupted — try backup
      const backupRaw = storage.getItem(backupKey);
      if (backupRaw) {
        try {
          const parsed = JSON.parse(backupRaw);
          const normalized = normalizePayload(parsed);
          if (isPayload(normalized)) {
            console.warn('Primary data corrupted, restored from backup.');
            return normalized;
          }
        } catch {
          // Backup also corrupted
        }
      }
      return createEmptyPayload();
    }
  }

  function hasMeaningfulData(data) {
    return (
      (data?.chores || []).length > 0 ||
      (data?.records || []).length > 0 ||
      (data?.periods || []).length > 0
    );
  }

  function persistToStorage(key, serialized) {
    try {
      storage.setItem(key, serialized);
      return true;
    } catch (error) {
      console.warn(`Failed to write to localStorage key "${key}":`, error);
      return false;
    }
  }

  function saveData(nextData) {
    return saveDataWithOptions(nextData);
  }

  function saveDataWithOptions(nextData, {
    previousData = null,
    source = 'local',
    skipCloudSync = false
  } = {}) {
    const normalizedCandidate = normalizePayload(nextData);
    if (!isPayload(normalizedCandidate)) {
      throw new Error('Storage payload shape is invalid.');
    }

    if (!storage) {
      return;
    }

    const priorData = normalizePayload(previousData || loadData());
    const now = nowIsoTimestamp();
    const syncMeta = applySectionSyncTimestamps({
      priorData,
      nextData: normalizedCandidate,
      syncMeta: priorData.syncMeta || createDefaultSyncMeta(),
      nowIso: now
    });

    if (source === 'remote') {
      syncMeta.lastRemoteMergeAt = now;
    } else {
      syncMeta.lastLocalWriteAt = now;
    }

    const normalizedNextData = {
      ...normalizedCandidate,
      syncMeta
    };

    const serialized = JSON.stringify(normalizedNextData);

    // Write to primary key; on failure attempt to preserve backup
    const primaryOk = persistToStorage(storageKey, serialized);
    if (!primaryOk) {
      console.warn('Primary storage write failed. Data may not be saved.');
    }

    // Keep a rolling backup so corruption of the primary key can be recovered
    if (hasMeaningfulData(normalizedNextData)) {
      persistToStorage(backupKey, serialized);
    }

    if (!skipCloudSync && isSupabaseConfigured()) {
      syncQueue.enqueue('chores', normalizedNextData.chores);
      syncQueue.enqueue('records', normalizedNextData.records);
      syncQueue.enqueue('ui', normalizedNextData.ui.activeRole);
      syncQueue.enqueue('feedback', normalizedNextData.feedback);
      syncQueue.enqueue('periods', normalizedNextData.periods);
      syncQueue.enqueue('settings', normalizedNextData.settings);
    }

    return normalizedNextData;
  }

  function updateData(updater) {
    const currentData = loadData();
    const nextData = updater(currentData);
    return saveDataWithOptions(nextData, { previousData: currentData, source: 'local' });
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

  async function retryFailedSync() {
    return syncQueue.retryFailed();
  }

  return {
    loadData,
    saveData,
    saveDataWithOptions,
    updateData,
    setUserId,
    getSyncState,
    syncNow,
    retryFailedSync
  };
}
