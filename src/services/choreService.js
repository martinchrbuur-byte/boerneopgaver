import { isOnOrAfter, isSameLocalDay, nowIsoTimestamp } from '../shared/dateTime.js';

export const CHORE_MESSAGES = Object.freeze({
  choreAdded: 'Opgave tilføjet! Klar til brug.',
  choreCompleted: 'Flot! Opgaven er fuldført.',
  choreUndone: 'Ingen problem — opgaven er markeret som ikke udført.',
  parentOnlyAdd: 'Kun forældrevisning kan tilføje opgaver.',
  kidOnlyActions: 'Kun børnevisning kan fuldføre eller fortryde opgaver.',
  invalidName: 'Indtast venligst et opgavenavn.',
  missingChore: 'Den opgave kunne ikke findes.',
  alreadyCompleted: 'Opgaven er allerede fuldført. Fortryd først for at fuldføre igen.',
  missingActiveCompletion: 'Opgaven er ikke markeret som fuldført lige nu.',
  invalidTimestamp: 'Tidsstemplet er ugyldigt for denne handling.'
});

function normalizeName(name) {
  return typeof name === 'string' ? name.trim() : '';
}

function createId(prefix) {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}_${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}

function sortByCompletedAtDescending(records) {
  return [...records].sort((left, right) => right.completedAt.localeCompare(left.completedAt));
}

function hasOverlap(records) {
  const sorted = [...records].sort((left, right) => left.completedAt.localeCompare(right.completedAt));
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const current = sorted[index];
    const next = sorted[index + 1];
    const currentEnd = current.undoneAt ?? '9999-12-31T23:59:59.999Z';
    if (isOnOrAfter(currentEnd, next.completedAt)) {
      return true;
    }
  }

  return false;
}

function buildViewState(data) {
  const recordsByChoreId = new Map();
  for (const record of data.records) {
    if (!recordsByChoreId.has(record.choreId)) {
      recordsByChoreId.set(record.choreId, []);
    }
    recordsByChoreId.get(record.choreId).push(record);
  }

  const chores = data.chores.map((chore) => {
    const records = recordsByChoreId.get(chore.id) ?? [];
    const activeRecord = records.find((record) => record.undoneAt === null) ?? null;
    const lastRecord = sortByCompletedAtDescending(records)[0] ?? null;

    return {
      id: chore.id,
      name: chore.name,
      createdAt: chore.createdAt,
      assignedTo: chore.assignedTo,
      isCompleted: activeRecord !== null,
      activeCompletedAt: activeRecord?.completedAt ?? null,
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
    recentCompletions,
    doneTodayCount,
    totalChores: chores.length
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

  function getState() {
    const data = storageService.loadData();
    return buildViewState(data);
  }

  function addChore(name, { nowIso = nowProvider(), actorRole, assignedTo } = {}) {
    if (!isRoleAllowed(actorRole, ['parent'])) {
      return asResult(false, CHORE_MESSAGES.parentOnlyAdd, getState());
    }

    const nextName = normalizeName(name);
    if (!nextName) {
      return asResult(false, CHORE_MESSAGES.invalidName, getState());
    }

    const validAssignedTo = Array.isArray(assignedTo) ? assignedTo.filter(k => typeof k === 'string') : [];
    if (validAssignedTo.length === 0) {
      validAssignedTo.push('Hans Jørgen', 'Andrea');
    }

    storageService.updateData((data) => ({
      chores: [
        ...data.chores,
        {
          id: createId('chore'),
          name: nextName,
          createdAt: nowIso,
          assignedTo: validAssignedTo
        }
      ],
      records: data.records,
      ui: data.ui
    }));

    return asResult(true, CHORE_MESSAGES.choreAdded, getState());
  }

  function completeChore(choreId, { nowIso = nowProvider(), actorRole } = {}) {
    if (!isKidRole(actorRole)) {
      return asResult(false, CHORE_MESSAGES.kidOnlyActions, getState());
    }

    const data = storageService.loadData();
    const chore = data.chores.find((item) => item.id === choreId);
    if (!chore) {
      return asResult(false, CHORE_MESSAGES.missingChore, buildViewState(data));
    }

    const records = getChoreRecords(data, choreId);
    const hasActiveRecord = records.some((record) => record.undoneAt === null);
    if (hasActiveRecord) {
      return asResult(false, CHORE_MESSAGES.alreadyCompleted, buildViewState(data));
    }

    const nextRecord = {
      id: createId('record'),
      choreId,
      completedAt: nowIso,
      undoneAt: null
    };

    const withNewRecord = [...records, nextRecord];

    if (hasOverlap(withNewRecord)) {
      return asResult(false, CHORE_MESSAGES.invalidTimestamp, buildViewState(data));
    }

    storageService.saveData({
      chores: data.chores,
      records: [...data.records, nextRecord],
      ui: data.ui
    });

    return asResult(true, CHORE_MESSAGES.choreCompleted, getState());
  }

  function undoChore(choreId, { nowIso = nowProvider(), actorRole } = {}) {
    if (!isKidRole(actorRole)) {
      return asResult(false, CHORE_MESSAGES.kidOnlyActions, getState());
    }

    const data = storageService.loadData();
    const chore = data.chores.find((item) => item.id === choreId);
    if (!chore) {
      return asResult(false, CHORE_MESSAGES.missingChore, buildViewState(data));
    }

    const activeRecord = data.records.find((record) => record.choreId === choreId && record.undoneAt === null);
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

      return {
        ...record,
        undoneAt: nowIso
      };
    });

    if (hasOverlap(getChoreRecords({ ...data, records: nextRecords }, choreId))) {
      return asResult(false, CHORE_MESSAGES.invalidTimestamp, buildViewState(data));
    }

    storageService.saveData({
      chores: data.chores,
      records: nextRecords,
      ui: data.ui
    });

    return asResult(true, CHORE_MESSAGES.choreUndone, getState());
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
      chores: data.chores.filter((item) => item.id !== choreId),
      records: data.records.filter((record) => record.choreId !== choreId),
      ui: data.ui
    });

    return asResult(true, `Opgaven "${chore.name}" er slettet.`, getState());
  }

  return {
    getState,
    addChore,
    completeChore,
    undoChore,
    deleteChore
  };
}
