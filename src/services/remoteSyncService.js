import { hasSectionChanges } from '../shared/sectionDiff.js';

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
  const hasUnsyncedLocalChanges =
    (syncState?.queueLength || 0) > 0 ||
    (syncState?.deadLetterCount || 0) > 0 ||
    (syncState?.failureCount || 0) > 0;

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
    return { action: 'skip-remote', hasRemoteData: true, nextData: null };
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