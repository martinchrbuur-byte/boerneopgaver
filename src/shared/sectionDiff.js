export const STORAGE_SECTION_KEYS = Object.freeze([
  'chores',
  'records',
  'ui',
  'feedback',
  'periods',
  'settings'
]);

export function hasSectionChanges(currentData, nextData, sectionKeys = STORAGE_SECTION_KEYS) {
  return sectionKeys.some(
    sectionKey => JSON.stringify(currentData?.[sectionKey]) !== JSON.stringify(nextData?.[sectionKey])
  );
}

export function applySectionSyncTimestamps({
  priorData,
  nextData,
  syncMeta,
  nowIso,
  sectionKeys = STORAGE_SECTION_KEYS
}) {
  const nextSyncMeta = { ...syncMeta };

  for (const sectionKey of sectionKeys) {
    if (JSON.stringify(priorData?.[sectionKey]) !== JSON.stringify(nextData?.[sectionKey])) {
      nextSyncMeta[`${sectionKey}UpdatedAt`] = nowIso;
    }
  }

  return nextSyncMeta;
}