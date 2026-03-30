import { isOnOrAfter, isValidIsoTimestamp } from '../shared/dateTime.js';
import { isSupabaseConfigured } from '../config/supabaseConfig.js';
import { saveChores, saveRecords, saveUiState, saveSprints, saveSettings } from './supabaseService.js';

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

  if (value.undoneAt === null) {
    return true;
  }

  return isValidIsoTimestamp(value.undoneAt) && isOnOrAfter(value.undoneAt, value.completedAt);
}

function isChoreItem(value) {
  return (
    value &&
    typeof value === 'object' &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    isValidIsoTimestamp(value.createdAt) &&
    Array.isArray(value.assignedTo) &&
    value.assignedTo.every(kid => KIDS.includes(kid)) &&
    value.assignedTo.length > 0 &&
    typeof value.value === 'number'
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
    settings: createDefaultSettings()
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
    value.chores.every(isChoreItem) &&
    value.records.every(isChoreRecord)
  );
}

function isLegacyPayload(value) {
  return (
    value &&
    typeof value === 'object' &&
    Array.isArray(value.chores) &&
    Array.isArray(value.records) &&
    value.chores.every(isChoreItem) &&
    value.records.every(isChoreRecord)
  );
}

function normalizePayload(value) {
  if (isPayload(value)) {
    return value;
  }

  if (isLegacyPayload(value)) {
    // Migrate legacy chores to include assignedTo field
    const migratedChores = value.chores.map(chore => ({
      ...chore,
      assignedTo: chore.assignedTo || KIDS,
      value: typeof chore.value === 'number' ? chore.value : 0
    }));
    return {
      chores: migratedChores,
      records: value.records,
      ui: createDefaultUiState(),
      sprints: value.sprints || [],
      settings: value.settings || createDefaultSettings()
    };
  }

  return createEmptyPayload();
}

export function createStorageService({ storage = globalThis.localStorage, storageKey = STORAGE_KEY } = {}) {
  let userId = 'anonymous';

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

    // Save to localStorage
    storage.setItem(storageKey, JSON.stringify(nextData));

    // Also save to Supabase if configured
    if (isSupabaseConfigured()) {
      saveChores(nextData.chores, userId).catch(error => {
        console.warn('Failed to sync chores to Supabase:', error);
      });
      saveRecords(nextData.records, userId).catch(error => {
        console.warn('Failed to sync records to Supabase:', error);
      });
      saveUiState(nextData.ui.activeRole, userId).catch(error => {
        console.warn('Failed to sync UI state to Supabase:', error);
      });
      saveSprints(nextData.sprints, userId).catch(error => {
        console.warn('Failed to sync sprints to Supabase:', error);
      });
      saveSettings(nextData.settings, userId).catch(error => {
        console.warn('Failed to sync settings to Supabase:', error);
      });
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

  return {
    loadData,
    saveData,
    updateData,
    setUserId
  };
}
