import { KIDS } from './storageService.js';
import { nowIsoTimestamp } from '../shared/dateTime.js';
import { createEntityId } from '../shared/id.js';

function addDays(fromDate, days) {
  const d = new Date(fromDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function todayString() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getDaysInclusive(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return 0;
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.floor((endUtc - startUtc) / msPerDay) + 1;
}

export function createSprintService({ storageService } = {}) {
  if (!storageService) {
    throw new Error('createSprintService requires storageService.');
  }

  function getActiveSprint() {
    const data = storageService.loadData();
    return data.sprints.find(s => s.status === 'active') ?? null;
  }

  function getSettings() {
    return storageService.loadData().settings;
  }

  function ensureActiveSprint() {
    const existing = getActiveSprint();
    if (existing) return existing;

    const settings = getSettings();
    const start = todayString();
    const end = addDays(new Date(start), settings.sprintLengthDays - 1);

    const sprint = {
      id: createEntityId('sprint'),
      startDate: start,
      endDate: end,
      status: 'active',
      paidAt: null,
      createdAt: nowIsoTimestamp()
    };

    storageService.updateData(data => ({
      ...data,
      sprints: [...data.sprints, sprint]
    }));

    return sprint;
  }

  function closeSprint(actorRole) {
    if (actorRole !== 'parent') {
      return { ok: false, message: 'Kun forældrevisning kan afslutte en sprint.' };
    }

    const active = getActiveSprint();
    if (!active) {
      return { ok: false, message: 'Ingen aktiv sprint fundet.' };
    }

    const paidAt = nowIsoTimestamp();

    storageService.updateData(data => ({
      ...data,
      sprints: data.sprints.map(s =>
        s.id === active.id ? { ...s, status: 'paid', paidAt } : s
      )
    }));

    ensureActiveSprint();

    return { ok: true, message: 'Sprint afsluttet og betalt! Ny sprint er startet.' };
  }

  function getSprintEarnings(sprintId) {
    const data = storageService.loadData();
    const earnings = Object.fromEntries(KIDS.map(k => [k, 0]));

    const choreMap = new Map(data.chores.map(c => [c.id, c]));

    for (const record of data.records) {
      if (record.sprintId !== sprintId) continue;
      if (record.undoneAt !== null) continue;

      const chore = choreMap.get(record.choreId);
      if (!chore) continue;

      const perKidValue = typeof record.earnedValue === 'number'
        ? record.earnedValue
        : (chore.value ?? 0);

      if (typeof record.completedBy === 'string' && record.completedBy in earnings) {
        earnings[record.completedBy] += perKidValue;
        continue;
      }

      const validAssignedKids = Array.isArray(chore.assignedTo)
        ? chore.assignedTo.filter(kid => kid in earnings)
        : [];

      if (validAssignedKids.length === 1) {
        earnings[validAssignedKids[0]] += perKidValue;
        continue;
      }

      if (validAssignedKids.length > 1) {
        const splitValue = perKidValue / validAssignedKids.length;
        for (const kid of validAssignedKids) {
          earnings[kid] += splitValue;
        }
      }
    }

    return earnings;
  }

  function getSprintMoneyProgress(sprintId) {
    const data = storageService.loadData();
    const sprint = data.sprints.find(item => item.id === sprintId) ?? null;
    const earnings = getSprintEarnings(sprintId);

    const byKid = Object.fromEntries(KIDS.map(kid => [
      kid,
      {
        earned: earnings[kid] ?? 0,
        target: 0
      }
    ]));

    const sprintDays = sprint
      ? getDaysInclusive(sprint.startDate, sprint.endDate)
      : 0;

    for (const chore of data.chores) {
      const value = typeof chore.value === 'number' && Number.isFinite(chore.value)
        ? chore.value
        : 0;
      const maxPerSprint = typeof chore.maxPerSprint === 'number' ? chore.maxPerSprint : 1;
      const unlimitedDailyCap = Number.isInteger(chore.unlimitedDailyCap) && chore.unlimitedDailyCap >= 1
        ? chore.unlimitedDailyCap
        : 1;
      const completionTarget = maxPerSprint === 0
        ? sprintDays * unlimitedDailyCap
        : Math.max(0, Math.floor(maxPerSprint));
      const choreTargetValue = value * completionTarget;

      const assignedKids = Array.isArray(chore.assignedTo)
        ? chore.assignedTo.filter(kid => kid in byKid)
        : [];

      for (const kid of assignedKids) {
        byKid[kid].target += choreTargetValue;
      }
    }

    const total = KIDS.reduce(
      (acc, kid) => ({
        earned: acc.earned + (byKid[kid]?.earned ?? 0),
        target: acc.target + (byKid[kid]?.target ?? 0)
      }),
      { earned: 0, target: 0 }
    );

    return { total, byKid };
  }

  /**
   * Returns all closed (paid) sprints, newest first.
   */
  function getSprintHistory() {
    const data = storageService.loadData();
    return data.sprints
      .filter(s => s.status === 'paid')
      .sort((a, b) => b.startDate.localeCompare(a.startDate))
      .map(s => ({
        ...s,
        earnings: getSprintEarnings(s.id)
      }));
  }

  /**
   * Save the sprint length days setting (parent only).
   */
  function setSprintLength(days, actorRole) {
    if (actorRole !== 'parent') {
      return { ok: false, message: 'Kun forældrevisning kan ændre sprint-længden.' };
    }

    const parsed = parseInt(days, 10);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 365) {
      return { ok: false, message: 'Sprint-længden skal være mellem 1 og 365 dage.' };
    }

    storageService.updateData(data => ({
      ...data,
      settings: { ...data.settings, sprintLengthDays: parsed }
    }));

    return { ok: true, message: `Sprint-længde sat til ${parsed} dage.` };
  }

  return {
    getActiveSprint,
    getSettings,
    ensureActiveSprint,
    closeSprint,
    getSprintEarnings,
    getSprintMoneyProgress,
    getSprintHistory,
    setSprintLength
  };
}
