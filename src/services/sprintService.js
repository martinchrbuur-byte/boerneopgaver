import { KIDS } from './storageService.js';

function createId(prefix) {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}_${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}

/**
 * Returns a YYYY-MM-DD string for a date offset by `days` from `fromDate`.
 * @param {Date} fromDate
 * @param {number} days
 * @returns {string}
 */
function addDays(fromDate, days) {
  const d = new Date(fromDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Today as YYYY-MM-DD in local time */
function todayString() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function createSprintService({ storageService } = {}) {
  if (!storageService) {
    throw new Error('createSprintService requires storageService.');
  }

  /** @returns {object|null} The single active sprint, or null. */
  function getActiveSprint() {
    const data = storageService.loadData();
    return data.sprints.find(s => s.status === 'active') ?? null;
  }

  /** @returns {object} Current app settings. */
  function getSettings() {
    return storageService.loadData().settings;
  }

  /**
   * Create a new active sprint starting today (if none exists).
   * Returns the sprint (existing or newly created).
   */
  function ensureActiveSprint() {
    const existing = getActiveSprint();
    if (existing) return existing;

    const settings = getSettings();
    const start = todayString();
    const end = addDays(new Date(start), settings.sprintLengthDays - 1);

    const sprint = {
      id: createId('sprint'),
      startDate: start,
      endDate: end,
      status: 'active',
      paidAt: null,
      createdAt: new Date().toISOString()
    };

    storageService.updateData(data => ({
      ...data,
      sprints: [...data.sprints, sprint]
    }));

    return sprint;
  }

  /**
   * Close the active sprint (mark as paid) and auto-start a new one.
   * @param {string} actorRole
   * @returns {{ ok: boolean, message: string }}
   */
  function closeSprint(actorRole) {
    if (actorRole !== 'parent') {
      return { ok: false, message: 'Kun forældrevisning kan afslutte en sprint.' };
    }

    const active = getActiveSprint();
    if (!active) {
      return { ok: false, message: 'Ingen aktiv sprint fundet.' };
    }

    const paidAt = new Date().toISOString();

    storageService.updateData(data => ({
      ...data,
      sprints: data.sprints.map(s =>
        s.id === active.id ? { ...s, status: 'paid', paidAt } : s
      )
    }));

    // Auto-start next sprint
    ensureActiveSprint();

    return { ok: true, message: 'Sprint afsluttet og betalt! Ny sprint er startet.' };
  }

  /**
   * Get earnings per kid for a sprint.
   * Only counts records where undoneAt === null (undo removes earnings).
   * @param {string} sprintId
   * @returns {{ [kid: string]: number }}
   */
  function getSprintEarnings(sprintId) {
    const data = storageService.loadData();
    const earnings = Object.fromEntries(KIDS.map(k => [k, 0]));

    const choreMap = new Map(data.chores.map(c => [c.id, c]));

    for (const record of data.records) {
      if (record.sprintId !== sprintId) continue;
      if (record.undoneAt !== null) continue; // undone = not earned

      const chore = choreMap.get(record.choreId);
      if (!chore) continue;

      for (const kid of chore.assignedTo) {
        if (kid in earnings) {
          earnings[kid] += chore.value ?? 0;
        }
      }
    }

    return earnings;
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
    getSprintHistory,
    setSprintLength
  };
}
