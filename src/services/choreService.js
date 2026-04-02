import { isOnOrAfter, isSameLocalDay, nowIsoTimestamp } from '../shared/dateTime.js';

export const CHORE_MESSAGES = Object.freeze({
  choreAdded: 'Opgave tilføjet! Klar til brug.',
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
  atRepeatLimit: 'Opgaven er nået sit maksimum antal gange i dette sprint.',
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

function createId(prefix) {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}_${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}

function sortByCompletedAtDescending(records) {
  return [...records].sort((left, right) => right.completedAt.localeCompare(left.completedAt));
}

function hasOverlap(records, { treatActiveAsInfinite = true } = {}) {
  const sorted = [...records].sort((left, right) => left.completedAt.localeCompare(right.completedAt));
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const current = sorted[index];
    const next = sorted[index + 1];
    // When treatActiveAsInfinite is false (multi-repeat chores), an open-ended
    // record does NOT block another simultaneous active record.
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

function buildViewState(data, { activeSprintId = null } = {}) {
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
    const scopedActiveRecords = activeSprintId
      ? activeRecords.filter((record) => record.sprintId === activeSprintId)
      : activeRecords;
    const lastRecord = sortByCompletedAtDescending(records)[0] ?? null;

    // Count completions within the active sprint (or all-time if no sprint)
    const sprintCompletionCount = activeSprintId
      ? activeRecords.filter((r) => r.sprintId === activeSprintId).length
      : activeRecords.length;

    const maxPerSprint = chore.maxPerSprint ?? 1;
    const isFullyDone = maxPerSprint > 0 && sprintCompletionCount >= maxPerSprint;

    return {
      id: chore.id,
      name: chore.name,
      createdAt: chore.createdAt,
      assignedTo: chore.assignedTo,
      value: chore.value ?? 0,
      maxPerSprint,
      unlimitedDailyCap: Number.isInteger(chore.unlimitedDailyCap) && chore.unlimitedDailyCap >= 1
        ? chore.unlimitedDailyCap
        : 1,
      sprintCompletionCount,
      isFullyDone,
      // Active completion reflects the current sprint scope when provided.
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

  function getState({ activeSprintId = null } = {}) {
    const data = storageService.loadData();
    return buildViewState(data, { activeSprintId });
  }

  function addChore(name, {
    nowIso = nowProvider(),
    actorRole,
    assignedTo,
    value = 0,
    maxPerSprint = 1,
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

    const parsedMax = parseInt(maxPerSprint, 10);
    if (!Number.isInteger(parsedMax) || parsedMax < 0) {
      return asResult(false, CHORE_MESSAGES.invalidMax, getState());
    }

    const parsedUnlimitedDailyCap = parseInt(unlimitedDailyCap, 10);
    if (!Number.isInteger(parsedUnlimitedDailyCap) || parsedUnlimitedDailyCap < 1) {
      return asResult(false, CHORE_MESSAGES.invalidUnlimitedDailyCap, getState());
    }

    const validAssignedTo = Array.isArray(assignedTo) ? assignedTo.filter(k => typeof k === 'string') : [];
    if (validAssignedTo.length === 0) {
      validAssignedTo.push('Hans Jørgen', 'Andrea');
    }

    storageService.updateData((data) => ({
      ...data,
      chores: [
        ...data.chores,
        {
          id: createId('chore'),
          name: nextName,
          createdAt: nowIso,
          assignedTo: validAssignedTo,
          value: parsedValue,
          maxPerSprint: parsedMax,
          unlimitedDailyCap: parsedUnlimitedDailyCap
        }
      ]
    }));

    return asResult(true, CHORE_MESSAGES.choreAdded, getState());
  }

  function completeChore(choreId, { nowIso = nowProvider(), actorRole, sprintId = null } = {}) {
    if (!isKidRole(actorRole)) {
      return asResult(false, CHORE_MESSAGES.kidOnlyActions, getState());
    }

    const data = storageService.loadData();
    const chore = data.chores.find((item) => item.id === choreId);
    if (!chore) {
      return asResult(false, CHORE_MESSAGES.missingChore, buildViewState(data));
    }

    if (!Array.isArray(chore.assignedTo) || !chore.assignedTo.includes(actorRole)) {
      return asResult(false, CHORE_MESSAGES.notAssigned, buildViewState(data, { activeSprintId: sprintId }));
    }

    const maxPerSprint = chore.maxPerSprint ?? 1;
    const records = getChoreRecords(data, choreId);

    // Count active completions in current sprint (or all-time if no sprint)
    const activeRecords = records.filter((r) => r.undoneAt === null);
    const sprintCount = sprintId
      ? activeRecords.filter((r) => r.sprintId === sprintId).length
      : activeRecords.length;

    if (maxPerSprint > 0 && sprintCount >= maxPerSprint) {
      // For maxPerSprint === 1 use legacy message; otherwise use limit message
      const msg = maxPerSprint === 1 ? CHORE_MESSAGES.alreadyCompleted : CHORE_MESSAGES.atRepeatLimit;
      return asResult(false, msg, buildViewState(data, { activeSprintId: sprintId }));
    }

    const nextRecord = {
      id: createId('record'),
      choreId,
      completedAt: nowIso,
      undoneAt: null,
      sprintId,
      completedBy: actorRole
    };

    const withNewRecord = [...records, nextRecord];

    // For single-completion chores treat open records as infinite (blocks overlap).
    // For multi-completion chores allow simultaneous active records.
    const treatActiveAsInfinite = maxPerSprint <= 1;
    if (hasOverlap(withNewRecord, { treatActiveAsInfinite })) {
      return asResult(false, CHORE_MESSAGES.invalidTimestamp, buildViewState(data, { activeSprintId: sprintId }));
    }

    storageService.saveData({
      ...data,
      records: [...data.records, nextRecord]
    });

    return asResult(true, CHORE_MESSAGES.choreCompleted, getState({ activeSprintId: sprintId }));
  }

  function undoChore(choreId, { nowIso = nowProvider(), actorRole, sprintId = null } = {}) {
    if (!isKidRole(actorRole)) {
      return asResult(false, CHORE_MESSAGES.kidOnlyActions, getState());
    }

    const data = storageService.loadData();
    const chore = data.chores.find((item) => item.id === choreId);
    if (!chore) {
      return asResult(false, CHORE_MESSAGES.missingChore, buildViewState(data));
    }

    // Target the MOST RECENT active record (supports multi-repeat chores)
    const activeRecords = data.records.filter((r) => r.choreId === choreId && r.undoneAt === null);
    const sortedActive = sortByCompletedAtDescending(activeRecords);
    const activeRecord = sortedActive[0] ?? null;

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

    const maxPerSprint = chore.maxPerSprint ?? 1;
    const treatActiveAsInfinite = maxPerSprint <= 1;
    if (hasOverlap(getChoreRecords({ ...data, records: nextRecords }, choreId), { treatActiveAsInfinite })) {
      return asResult(false, CHORE_MESSAGES.invalidTimestamp, buildViewState(data));
    }

    storageService.saveData({ ...data, records: nextRecords });

    return asResult(true, CHORE_MESSAGES.choreUndone, getState({ activeSprintId: sprintId }));
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

  // ─── Collaborative chore flow ────────────────────────────────────────────

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
      id: createId('collab'),
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

  function acceptCollaboration(collabId, { actorRole, sprintId = null, nowIso = nowProvider() } = {}) {
    if (!isKidRole(actorRole)) {
      return asResult(false, CHORE_MESSAGES.kidOnlyActions, getState());
    }

    const data = storageService.loadData();
    const pending = data.pendingCollaborations ?? [];
    const collab = pending.find((c) => c.id === collabId);
    if (!collab) {
      return asResult(false, CHORE_MESSAGES.collabMissing, buildViewState(data));
    }

    // Acceptor must be a different kid than proposer
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

    // Create one record per participant
    const record1 = {
      id: createId('record'),
      choreId: chore.id,
      completedAt: nowIso,
      undoneAt: null,
      sprintId,
      completedBy: collab.proposedBy,
      earnedValue: splitValue
    };
    const record2 = {
      id: createId('record'),
      choreId: chore.id,
      completedAt: nowIso,
      undoneAt: null,
      sprintId,
      completedBy: actorRole,
      earnedValue: splitValue
    };

    storageService.saveData({
      ...data,
      records: [...data.records, record1, record2],
      pendingCollaborations: pending.filter((c) => c.id !== collabId)
    });

    return asResult(true, CHORE_MESSAGES.collabAccepted, getState({ activeSprintId: sprintId }));
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
    completeChore,
    undoChore,
    deleteChore,
    proposeCollaboration,
    acceptCollaboration,
    declineCollaboration
  };
}
