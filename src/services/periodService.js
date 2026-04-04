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

export function createPeriodService({ storageService } = {}) {
  if (!storageService) {
    throw new Error('createPeriodService requires storageService.');
  }

  function getActivePeriod() {
    const data = storageService.loadData();
    return data.periods.find(period => period.status === 'active') ?? null;
  }

  function getSettings() {
    return storageService.loadData().settings;
  }

  function ensureActivePeriod() {
    const existing = getActivePeriod();
    if (existing) return existing;

    const settings = getSettings();
    const start = todayString();
    const end = addDays(new Date(start), settings.periodLengthDays - 1);

    const period = {
      id: createEntityId('period'),
      startDate: start,
      endDate: end,
      status: 'active',
      paidAt: null,
      createdAt: nowIsoTimestamp()
    };

    storageService.updateData(data => ({
      ...data,
      periods: [...data.periods, period]
    }));

    return period;
  }

  function closePeriod(actorRole) {
    if (actorRole !== 'parent') {
      return { ok: false, message: 'Kun forældrevisning kan afslutte en periode.' };
    }

    const active = getActivePeriod();
    if (!active) {
      return { ok: false, message: 'Ingen aktiv periode fundet.' };
    }

    const paidAt = nowIsoTimestamp();

    storageService.updateData(data => ({
      ...data,
      periods: data.periods.map(period =>
        period.id === active.id ? { ...period, status: 'paid', paidAt } : period
      )
    }));

    ensureActivePeriod();

    return { ok: true, message: 'Periode afsluttet og betalt! Ny periode er startet.' };
  }

  function getPeriodEarnings(periodId) {
    const data = storageService.loadData();
    const earnings = Object.fromEntries(KIDS.map(kid => [kid, 0]));

    const choreMap = new Map(data.chores.map(chore => [chore.id, chore]));

    for (const record of data.records) {
      if (record.periodId !== periodId) continue;
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

  function getPeriodMoneyProgress(periodId) {
    const data = storageService.loadData();
    const period = data.periods.find(item => item.id === periodId) ?? null;
    const earnings = getPeriodEarnings(periodId);

    const byKid = Object.fromEntries(KIDS.map(kid => [
      kid,
      {
        earned: earnings[kid] ?? 0,
        target: 0
      }
    ]));

    const periodDays = period
      ? getDaysInclusive(period.startDate, period.endDate)
      : 0;

    for (const chore of data.chores) {
      const value = typeof chore.value === 'number' && Number.isFinite(chore.value)
        ? chore.value
        : 0;
      const maxPerPeriod = typeof chore.maxPerPeriod === 'number' ? chore.maxPerPeriod : 1;
      const unlimitedDailyCap = Number.isInteger(chore.unlimitedDailyCap) && chore.unlimitedDailyCap >= 1
        ? chore.unlimitedDailyCap
        : 1;
      const completionTarget = maxPerPeriod === 0
        ? periodDays * unlimitedDailyCap
        : Math.max(0, Math.floor(maxPerPeriod));
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

  function getPeriodHistory() {
    const data = storageService.loadData();
    return data.periods
      .filter(period => period.status === 'paid')
      .sort((left, right) => right.startDate.localeCompare(left.startDate))
      .map(period => ({
        ...period,
        earnings: getPeriodEarnings(period.id)
      }));
  }

  function setPeriodLength(days, actorRole) {
    if (actorRole !== 'parent') {
      return { ok: false, message: 'Kun forældrevisning kan ændre periode-længden.' };
    }

    const parsed = parseInt(days, 10);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 365) {
      return { ok: false, message: 'Periode-længden skal være mellem 1 og 365 dage.' };
    }

    storageService.updateData(data => ({
      ...data,
      settings: { ...data.settings, periodLengthDays: parsed }
    }));

    return { ok: true, message: `Periode-længde sat til ${parsed} dage.` };
  }

  return {
    getActivePeriod,
    getSettings,
    ensureActivePeriod,
    closePeriod,
    getPeriodEarnings,
    getPeriodMoneyProgress,
    getPeriodHistory,
    setPeriodLength
  };
}
