import { isOnOrAfter, isSameLocalDay, nowIsoTimestamp } from '../shared/dateTime.js';
import { createEntityId } from '../shared/id.js';

export const CHORE_MESSAGES = Object.freeze({
  choreAdded: 'Opgave tilføjet! Klar til brug.',
  choreUpdated: 'Opgaven er opdateret.',
  choreCompleted: 'Flot! Opgaven er fuldført.',
  choreUndone: 'Ingen problem — opgaven er markeret som ikke udført.',
  parentOnlyAdd: 'Kun forældrevisning kan tilføje opgaver.',
  kidOnlyActions: 'Kun børnevisning kan fuldføre eller fortryde opgaver.',
  invalidName: 'Indtast venligst et opgavenavn.',
  invalidValue: 'Opgaveværdien skal være et tal (0 eller mere).',
  invalidMax: 'Maks antal gange skal være et helt tal (0 eller mere).',
  invalidUnlimitedDailyCap: 'Dagligt loft for ubegrænset opgave skal være et helt tal (1 eller mere).',
  missingChore: 'Den opgave kunne ikke findes.',
  alreadyCompleted: 'Opgaven er allerede fuldført. Fortryd først for at fuldføre igen.',
  atRepeatLimit: 'Opgaven er nået sit maksimum antal gange i denne periode.',
  missingActiveCompletion: 'Opgaven er ikke markeret som fuldført lige nu.',
  invalidTimestamp: 'Tidsstemplet er ugyldigt for denne handling.',
  collabProposed: 'Forslag sendt — vent på at den anden accepterer!',
  collabAlreadyPending: 'Der er allerede et ventende samarbejdsforslag for denne opgave.',
  collabAccepted: 'Godt samarbejde! Opgaven er klaret sammen.',
  collabDeclined: 'Forslaget er afvist.',
  collabMissing: 'Samarbejdsforslaget kunne ikke findes.',
  notCollab: 'Kun samarbejdsopgaver kan accepteres/afvises via dette flow.',
  notAssigned: 'Du kan kun fuldføre opgaver, du er tildelt.'
});

function normalizeName(name) {
  return typeof name === 'string' ? name.trim() : '';
}

const DEFAULT_ASSIGNEES = Object.freeze(['Hans Jørgen', 'Andrea']);

function sanitizeAssignedTo(assignedTo, fallbackAssignedTo = DEFAULT_ASSIGNEES) {
  const validAssignedTo = Array.isArray(assignedTo)
    ? assignedTo.filter(kid => DEFAULT_ASSIGNEES.includes(kid))
    : [];

  if (validAssignedTo.length > 0) {
    return validAssignedTo;
  }

  const fallback = Array.isArray(fallbackAssignedTo)
    ? fallbackAssignedTo.filter(kid => DEFAULT_ASSIGNEES.includes(kid))
    : [];

  return fallback.length > 0 ? fallback : [...DEFAULT_ASSIGNEES];
}

function sortByCompletedAtDescending(records) {
  return [...records].sort((left, right) => right.completedAt.localeCompare(left.completedAt));
}

function hasOverlap(records, { treatActiveAsInfinite = true } = {}) {
  const sorted = [...records].sort((left, right) => left.completedAt.localeCompare(right.completedAt));
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const current = sorted[index];
    const next = sorted[index + 1];
    if (!treatActiveAsInfinite && current.undoneAt === null) {
      continue;
    }
    const currentEnd = current.undoneAt ?? '9999-12-31T23:59:59.999Z';
    if (isOnOrAfter(currentEnd, next.completedAt)) {
      return true;
    }
  }

  return false;
}

function buildViewState(data, { activePeriodId = null } = {}) {
  const recordsByChoreId = new Map();
  for (const record of data.records) {
    if (!recordsByChoreId.has(record.choreId)) {
      recordsByChoreId.set(record.choreId, []);
    }
    recordsByChoreId.get(record.choreId).push(record);
  }

  const chores = data.chores.map((chore) => {
    const records = recordsByChoreId.get(chore.id) ?? [];
    const activeRecords = records.filter((record) => record.undoneAt === null);
    const scopedActiveRecords = activePeriodId
      ? activeRecords.filter((record) => record.periodId === activePeriodId)
      : activeRecords;
    const lastRecord = sortByCompletedAtDescending(records)[0] ?? null;

    const periodCompletionCount = scopedActiveRecords.length;

    const maxPerPeriod = chore.maxPerPeriod ?? 1;
    const isFullyDone = maxPerPeriod > 0 && periodCompletionCount >= maxPerPeriod;

    return {
      id: chore.id,
      name: chore.name,
      createdAt: chore.createdAt,
      assignedTo: chore.assignedTo,
      value: chore.value ?? 0,
      maxPerPeriod,
      unlimitedDailyCap: Number.isInteger(chore.unlimitedDailyCap) && chore.unlimitedDailyCap >= 1
        ? chore.unlimitedDailyCap
        : 1,
      periodCompletionCount,
      isFullyDone,
      isCompleted: scopedActiveRecords.length > 0,
      activeCompletedAt: scopedActiveRecords.length > 0
        ? scopedActiveRecords[scopedActiveRecords.length - 1].completedAt
        : null,
      lastCompletedAt: lastRecord?.completedAt ?? null
    };
  });

  const recentCompletions = sortByCompletedAtDescending(data.records)
    .slice(0, 10)
    .map((record) => {
      const chore = data.chores.find((item) => item.id === record.choreId);
      return {
        id: record.id,
        choreId: record.choreId,
        choreName: chore ? chore.name : 'Ukendt opgave',
        completedAt: record.completedAt,
        undoneAt: record.undoneAt
      };
    });

  const doneTodayCount = chores.filter(
    (chore) => chore.isCompleted && chore.activeCompletedAt && isSameLocalDay(chore.activeCompletedAt)
  ).length;

  return {
    chores,
    records: data.records,
    recentCompletions,
    doneTodayCount,
    totalChores: chores.length,
    pendingCollaborations: data.pendingCollaborations ?? []
  };
}

function asResult(ok, message, state) {
  return { ok, message, state };
}

function getChoreRecords(data, choreId) {
  return data.records.filter((record) => record.choreId === choreId);
}

function isRoleAllowed(role, allowedRoles) {
  return allowedRoles.includes(role);
}

function isKidRole(role) {
  return typeof role === 'string' && role.length > 0 && role !== 'parent';
}

export function createChoreService({ storageService, nowProvider = nowIsoTimestamp } = {}) {
  if (!storageService) {
    throw new Error('createChoreService requires storageService.');
  }

  function getState({ activePeriodId = null } = {}) {
    const data = storageService.loadData();
    return buildViewState(data, { activePeriodId });
  }

  function addChore(name, {
    nowIso = nowProvider(),
    actorRole,
    assignedTo,
    value = 0,
    maxPerPeriod = 1,
    unlimitedDailyCap = 1
  } = {}) {
    if (!isRoleAllowed(actorRole, ['parent'])) {
      return asResult(false, CHORE_MESSAGES.parentOnlyAdd, getState());
    }

    const nextName = normalizeName(name);
    if (!nextName) {
      return asResult(false, CHORE_MESSAGES.invalidName, getState());
    }

    const parsedValue = parseFloat(value);
    if (!Number.isFinite(parsedValue) || parsedValue < 0) {
      return asResult(false, CHORE_MESSAGES.invalidValue, getState());
    }

    const parsedMax = parseInt(maxPerPeriod, 10);
    if (!Number.isInteger(parsedMax) || parsedMax < 0) {
      return asResult(false, CHORE_MESSAGES.invalidMax, getState());
    }

    const parsedUnlimitedDailyCap = parseInt(unlimitedDailyCap, 10);
    if (!Number.isInteger(parsedUnlimitedDailyCap) || parsedUnlimitedDailyCap < 1) {
      return asResult(false, CHORE_MESSAGES.invalidUnlimitedDailyCap, getState());
    }

    const validAssignedTo = sanitizeAssignedTo(assignedTo);

    storageService.updateData((data) => ({
      ...data,
      chores: [
        ...data.chores,
        {
          id: createEntityId('chore'),
          name: nextName,
          createdAt: nowIso,
          assignedTo: validAssignedTo,
          value: parsedValue,
          maxPerPeriod: parsedMax,
          unlimitedDailyCap: parsedUnlimitedDailyCap
        }
      ]
    }));

    return asResult(true, CHORE_MESSAGES.choreAdded, getState());
  }

  function updateChore(choreId, {
    actorRole,
    name,
    value,
    assignedTo,
    maxPerPeriod,
    unlimitedDailyCap
  } = {}) {
    if (!isRoleAllowed(actorRole, ['parent'])) {
      return asResult(false, CHORE_MESSAGES.parentOnlyAdd, getState());
    }

    const data = storageService.loadData();
    const chore = data.chores.find((item) => item.id === choreId);
    if (!chore) {
      return asResult(false, CHORE_MESSAGES.missingChore, buildViewState(data));
    }

    const nextName = name === undefined ? chore.name : normalizeName(name);
    if (!nextName) {
      return asResult(false, CHORE_MESSAGES.invalidName, buildViewState(data));
    }

    const parsedValue = value === undefined ? chore.value : parseFloat(value);
    if (!Number.isFinite(parsedValue) || parsedValue < 0) {
      return asResult(false, CHORE_MESSAGES.invalidValue, buildViewState(data));
    }

    const parsedMax = maxPerPeriod === undefined ? chore.maxPerPeriod : parseInt(maxPerPeriod, 10);
    if (!Number.isInteger(parsedMax) || parsedMax < 0) {
      return asResult(false, CHORE_MESSAGES.invalidMax, buildViewState(data));
    }

    const parsedUnlimitedDailyCap = unlimitedDailyCap === undefined
      ? chore.unlimitedDailyCap
      : parseInt(unlimitedDailyCap, 10);
    if (!Number.isInteger(parsedUnlimitedDailyCap) || parsedUnlimitedDailyCap < 1) {
      return asResult(false, CHORE_MESSAGES.invalidUnlimitedDailyCap, buildViewState(data));
    }

    const nextAssignedTo = assignedTo === undefined
      ? sanitizeAssignedTo(chore.assignedTo)
      : sanitizeAssignedTo(assignedTo, chore.assignedTo);

    storageService.saveData({
      ...data,
      chores: data.chores.map((item) => {
        if (item.id !== choreId) {
          return item;
        }

        return {
          ...item,
          name: nextName,
          assignedTo: nextAssignedTo,
          value: parsedValue,
          maxPerPeriod: parsedMax,
          unlimitedDailyCap: parsedUnlimitedDailyCap
        };
      })
    });

    return asResult(true, CHORE_MESSAGES.choreUpdated, getState());
  }

  function completeChore(choreId, { nowIso = nowProvider(), actorRole, periodId = null, sprintId = undefined } = {}) {
    const activePeriodId = periodId ?? sprintId ?? null;
    if (!isKidRole(actorRole)) {
      return asResult(false, CHORE_MESSAGES.kidOnlyActions, getState());
    }

    const data = storageService.loadData();
    const chore = data.chores.find((item) => item.id === choreId);
    if (!chore) {
      return asResult(false, CHORE_MESSAGES.missingChore, buildViewState(data));
    }

    if (!Array.isArray(chore.assignedTo) || !chore.assignedTo.includes(actorRole)) {
      return asResult(false, CHORE_MESSAGES.notAssigned, buildViewState(data, { activePeriodId }));
    }

    const maxPerPeriod = chore.maxPerPeriod ?? 1;
    const records = getChoreRecords(data, choreId);

    const activeRecords = records.filter((r) => r.undoneAt === null);
    const periodCount = activePeriodId
      ? activeRecords.filter((r) => r.periodId === activePeriodId).length
      : activeRecords.length;

    if (maxPerPeriod > 0 && periodCount >= maxPerPeriod) {
      const msg = maxPerPeriod === 1 ? CHORE_MESSAGES.alreadyCompleted : CHORE_MESSAGES.atRepeatLimit;
      return asResult(false, msg, buildViewState(data, { activePeriodId }));
    }

    const nextRecord = {
      id: createEntityId('record'),
      choreId,
      completedAt: nowIso,
      undoneAt: null,
      periodId: activePeriodId,
      completedBy: actorRole,
      earnedValue: chore.value ?? 0
    };

    const withNewRecord = [...records, nextRecord];

    const treatActiveAsInfinite = maxPerPeriod <= 1;
    if (hasOverlap(withNewRecord, { treatActiveAsInfinite })) {
      return asResult(false, CHORE_MESSAGES.invalidTimestamp, buildViewState(data, { activePeriodId }));
    }

    storageService.saveData({
      ...data,
      records: [...data.records, nextRecord]
    });

    return asResult(true, CHORE_MESSAGES.choreCompleted, getState({ activePeriodId }));
  }

  function undoChore(choreId, { nowIso = nowProvider(), actorRole, periodId = null, sprintId = undefined } = {}) {
    const activePeriodId = periodId ?? sprintId ?? null;
    if (!isKidRole(actorRole)) {
      return asResult(false, CHORE_MESSAGES.kidOnlyActions, getState());
    }

    const data = storageService.loadData();
    const chore = data.chores.find((item) => item.id === choreId);
    if (!chore) {
      return asResult(false, CHORE_MESSAGES.missingChore, buildViewState(data));
    }

    const activeRecords = data.records.filter((r) => r.choreId === choreId && r.undoneAt === null);
    const activeRecord = sortByCompletedAtDescending(activeRecords)[0] ?? null;

    if (!activeRecord) {
      return asResult(false, CHORE_MESSAGES.missingActiveCompletion, buildViewState(data));
    }

    if (!isOnOrAfter(nowIso, activeRecord.completedAt)) {
      return asResult(false, CHORE_MESSAGES.invalidTimestamp, buildViewState(data));
    }

    const nextRecords = data.records.map((record) => {
      if (record.id !== activeRecord.id) {
        return record;
      }
      return { ...record, undoneAt: nowIso };
    });

    const maxPerPeriod = chore.maxPerPeriod ?? 1;
    const treatActiveAsInfinite = maxPerPeriod <= 1;
    if (hasOverlap(getChoreRecords({ ...data, records: nextRecords }, choreId), { treatActiveAsInfinite })) {
      return asResult(false, CHORE_MESSAGES.invalidTimestamp, buildViewState(data));
    }

    storageService.saveData({ ...data, records: nextRecords });

    return asResult(true, CHORE_MESSAGES.choreUndone, getState({ activePeriodId }));
  }

  function deleteChore(choreId, { actorRole } = {}) {
    if (!isRoleAllowed(actorRole, ['parent'])) {
      return asResult(false, CHORE_MESSAGES.parentOnlyAdd, getState());
    }

    const data = storageService.loadData();
    const chore = data.chores.find((item) => item.id === choreId);
    if (!chore) {
      return asResult(false, CHORE_MESSAGES.missingChore, buildViewState(data));
    }

    storageService.saveData({
      ...data,
      chores: data.chores.filter((item) => item.id !== choreId),
      records: data.records.filter((record) => record.choreId !== choreId),
      pendingCollaborations: (data.pendingCollaborations ?? []).filter((c) => c.choreId !== choreId)
    });

    return asResult(true, `Opgaven "${chore.name}" er slettet.`, getState());
  }

  function proposeCollaboration(choreId, { actorRole } = {}) {
    if (!isKidRole(actorRole)) {
      return asResult(false, CHORE_MESSAGES.kidOnlyActions, getState());
    }

    const data = storageService.loadData();
    const chore = data.chores.find((item) => item.id === choreId);
    if (!chore) {
      return asResult(false, CHORE_MESSAGES.missingChore, buildViewState(data));
    }

    if (!Array.isArray(chore.assignedTo) || !chore.assignedTo.includes(actorRole)) {
      return asResult(false, CHORE_MESSAGES.notAssigned, buildViewState(data));
    }

    const pending = data.pendingCollaborations ?? [];
    const alreadyPending = pending.some((c) => c.choreId === choreId);
    if (alreadyPending) {
      return asResult(false, CHORE_MESSAGES.collabAlreadyPending, buildViewState(data));
    }

    const newCollab = {
      id: createEntityId('collab'),
      choreId,
      proposedBy: actorRole,
      proposedAt: nowProvider()
    };

    storageService.saveData({
      ...data,
      pendingCollaborations: [...pending, newCollab]
    });

    return asResult(true, CHORE_MESSAGES.collabProposed, getState());
  }

  function acceptCollaboration(collabId, { actorRole, periodId = null, sprintId = undefined, nowIso = nowProvider() } = {}) {
    const activePeriodId = periodId ?? sprintId ?? null;
    if (!isKidRole(actorRole)) {
      return asResult(false, CHORE_MESSAGES.kidOnlyActions, getState());
    }

    const data = storageService.loadData();
    const pending = data.pendingCollaborations ?? [];
    const collab = pending.find((c) => c.id === collabId);
    if (!collab) {
      return asResult(false, CHORE_MESSAGES.collabMissing, buildViewState(data));
    }

    if (collab.proposedBy === actorRole) {
      return asResult(false, CHORE_MESSAGES.notCollab, buildViewState(data));
    }

    const chore = data.chores.find((item) => item.id === collab.choreId);
    if (!chore) {
      return asResult(false, CHORE_MESSAGES.missingChore, buildViewState(data));
    }

    const assignedKids = Array.isArray(chore.assignedTo) ? chore.assignedTo : [];
    const bothAssigned = assignedKids.includes(collab.proposedBy) && assignedKids.includes(actorRole);
    if (!bothAssigned) {
      return asResult(false, CHORE_MESSAGES.notAssigned, buildViewState(data));
    }

    const splitValue = (chore.value ?? 0) / 2;

    const record1 = {
      id: createEntityId('record'),
      choreId: chore.id,
      completedAt: nowIso,
      undoneAt: null,
      periodId: activePeriodId,
      completedBy: collab.proposedBy,
      earnedValue: splitValue
    };
    const record2 = {
      id: createEntityId('record'),
      choreId: chore.id,
      completedAt: nowIso,
      undoneAt: null,
      periodId: activePeriodId,
      completedBy: actorRole,
      earnedValue: splitValue
    };

    storageService.saveData({
      ...data,
      records: [...data.records, record1, record2],
      pendingCollaborations: pending.filter((c) => c.id !== collabId)
    });

    return asResult(true, CHORE_MESSAGES.collabAccepted, getState({ activePeriodId }));
  }

  function declineCollaboration(collabId, { actorRole } = {}) {
    if (!isKidRole(actorRole)) {
      return asResult(false, CHORE_MESSAGES.kidOnlyActions, getState());
    }

    const data = storageService.loadData();
    const pending = data.pendingCollaborations ?? [];
    const collab = pending.find((c) => c.id === collabId);
    if (!collab) {
      return asResult(false, CHORE_MESSAGES.collabMissing, buildViewState(data));
    }

    storageService.saveData({
      ...data,
      pendingCollaborations: pending.filter((c) => c.id !== collabId)
    });

    return asResult(true, CHORE_MESSAGES.collabDeclined, getState());
  }

  return {
    getState,
    addChore,
    updateChore,
    completeChore,
    undoChore,
    deleteChore,
    proposeCollaboration,
    acceptCollaboration,
    declineCollaboration
  };
}
