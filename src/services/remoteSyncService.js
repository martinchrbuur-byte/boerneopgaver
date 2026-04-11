import { hasSectionChanges } from '../shared/sectionDiff.js';

const REMOTE_SECTION_KEYS = Object.freeze([
  'chores',
  'records',
  'ui',
  'feedback',
  'periods',
  'settings'
]);

function normalizeSyncItemType(type) {
  return REMOTE_SECTION_KEYS.includes(type) ? type : null;
}

function getBlockedSections(syncState) {
  const blockedSections = new Set();
  const pendingItems = Array.isArray(syncState?.pendingItems) ? syncState.pendingItems : [];
  const failedItems = Array.isArray(syncState?.failedItems) ? syncState.failedItems : [];

  for (const item of [...pendingItems, ...failedItems]) {
    const sectionKey = normalizeSyncItemType(item?.type);
    if (sectionKey) {
      blockedSections.add(sectionKey);
    }
  }

  if (blockedSections.size === 0 && ((syncState?.queueLength || 0) > 0 || (syncState?.failureCount || 0) > 0)) {
    for (const sectionKey of REMOTE_SECTION_KEYS) {
      blockedSections.add(sectionKey);
    }
  }

  return blockedSections;
}

export function hasMeaningfulLocalData(data) {
  return (
    (data?.chores || []).length > 0 ||
    (data?.records || []).length > 0 ||
    (data?.feedback || []).length > 0 ||
    (data?.periods || []).length > 0 ||
    (data?.settings?.periodLengthDays || 7) !== 7
  );
}

export function toRemoteStorageShape(supabaseData) {
  return {
    chores: supabaseData.chores,
    records: supabaseData.records,
    ui: { activeRole: supabaseData.ui.activeRole },
    feedback: supabaseData.feedback,
    periods: supabaseData.periods,
    settings: { periodLengthDays: supabaseData.settings.periodLengthDays }
  };
}

export function createRemoteSnapshotKey(supabaseData) {
  return JSON.stringify({
    remoteShape: toRemoteStorageShape(supabaseData),
    userId: supabaseData.userId
  });
}

export function reconcileCloudSnapshot({
  localData,
  syncState,
  supabaseData
}) {
  const blockedSections = getBlockedSections(syncState);
  const hasUnsyncedLocalChanges = blockedSections.size > 0;

  const remoteShape = toRemoteStorageShape(supabaseData);
  const hasRemoteData = hasMeaningfulLocalData(remoteShape);

  if (!hasRemoteData) {
    if (hasMeaningfulLocalData(localData)) {
      return { action: 'claim-local', hasRemoteData: false, nextData: null };
    }

    if (hasUnsyncedLocalChanges) {
      return { action: 'sync-pending', hasRemoteData: false, nextData: null };
    }

    return { action: 'noop', hasRemoteData: false, nextData: null };
  }

  if (hasUnsyncedLocalChanges) {
    const nextData = {
      ...localData
    };

    for (const sectionKey of REMOTE_SECTION_KEYS) {
      nextData[sectionKey] = blockedSections.has(sectionKey)
        ? localData[sectionKey]
        : remoteShape[sectionKey];
    }

    if (!hasSectionChanges(localData, nextData)) {
      return { action: 'skip-remote', hasRemoteData: true, nextData: null, blockedSections: [...blockedSections] };
    }

    return { action: 'apply-remote', hasRemoteData: true, nextData, blockedSections: [...blockedSections] };
  }

  const nextData = {
    ...localData,
    ...remoteShape
  };

  if (!hasSectionChanges(localData, nextData)) {
    return { action: 'noop', hasRemoteData: true, nextData: null };
  }

  return { action: 'apply-remote', hasRemoteData: true, nextData };
}