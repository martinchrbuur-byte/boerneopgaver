import { isValidIsoTimestamp, nowIsoTimestamp } from './dateTime.js';

export const KIDS = Object.freeze(['Hans Jørgen', 'Andrea']);
const KID_SET = new Set(KIDS);
export const ROULETTE_TARGET_BOTH = 'both';

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function isParentRole(role) {
  return role === 'parent';
}

export function isKidRole(role) {
  return KID_SET.has(role);
}

export function canConfigureRoulette(actorRole) {
  return isParentRole(actorRole);
}

export function canSpinRoulette(actorRole, targetKid = actorRole) {
  return isKidRole(actorRole) && (!targetKid || targetKid === actorRole || targetKid === ROULETTE_TARGET_BOTH);
}

export function normalizeAssignedTo(assignedTo, fallback = KIDS) {
  const candidates = Array.isArray(assignedTo) ? assignedTo : [];
  const next = [...new Set(candidates.filter(kid => KID_SET.has(kid)))];
  if (next.length > 0) {
    return next;
  }
  const fallbackList = Array.isArray(fallback) ? fallback.filter(kid => KID_SET.has(kid)) : [];
  return fallbackList.length > 0 ? [...new Set(fallbackList)] : [...KIDS];
}

export function normalizeTargetKid(targetKid) {
  if (targetKid === null || targetKid === undefined || cleanString(targetKid) === '') return null;
  if (targetKid === ROULETTE_TARGET_BOTH) return ROULETTE_TARGET_BOTH;
  return KID_SET.has(targetKid) ? targetKid : null;
}

export function resolveRouletteTarget(actorRole, requestedTargetKid = null) {
  if (isKidRole(actorRole) && requestedTargetKid === ROULETTE_TARGET_BOTH) return ROULETTE_TARGET_BOTH;
  if (isKidRole(actorRole)) return actorRole;
  return normalizeTargetKid(requestedTargetKid);
}

export function segmentMatchesTarget(segment, targetKid = null) {
  const assignedTo = normalizeAssignedTo(segment?.assignedTo);
  const normalizedTarget = normalizeTargetKid(targetKid);
  if (!normalizedTarget) return true;
  if (normalizedTarget === ROULETTE_TARGET_BOTH) return KIDS.every(kid => assignedTo.includes(kid));
  return assignedTo.includes(normalizedTarget);
}

export function filterSegmentsByTarget(segments, targetKid = null) {
  return normalizeRouletteSegments(segments).filter(segment => segmentMatchesTarget(segment, targetKid));
}

export function filterEligibleSegments(segments, actorId, target = 'self') {
  const normalized = normalizeRouletteSegments(segments);
  if (target === 'both') {
    const shared = normalized.filter(segment => KIDS.every(kid => segment.assignedTo.includes(kid)));
    return shared.length > 0
      ? { segments: shared, sharedSuggestion: false }
      : { segments: normalized.filter(segment => segment.assignedTo.includes(actorId)), sharedSuggestion: true };
  }
  return {
    segments: normalized.filter(segment => segment.assignedTo.includes(actorId)),
    sharedSuggestion: false
  };
}

export function normalizeRouletteSegment(segment, index = 0, { nowIso = nowIsoTimestamp() } = {}) {
  if (!segment || typeof segment !== 'object') return null;
  const label = cleanString(segment.label ?? segment.name ?? segment.title);
  const weight = Number(segment.weight);
  return {
    id: cleanString(segment.id),
    label,
    weight: Number.isFinite(weight) && weight > 0 ? weight : 1,
    assignedTo: normalizeAssignedTo(segment.assignedTo),
    iconKey: cleanString(segment.iconKey) || null,
    requiredRole: cleanString(segment.requiredRole) || null,
    sourceType: cleanString(segment.sourceType) || 'manual',
    sourceId: cleanString(segment.sourceId) || null,
    color: cleanString(segment.color) || null,
    orderIndex: Number.isInteger(segment.orderIndex) ? segment.orderIndex : index,
    meta: segment.meta && typeof segment.meta === 'object' ? { ...segment.meta } : {},
    updatedAt: isValidIsoTimestamp(segment.updatedAt) ? segment.updatedAt : nowIso
  };
}

export function normalizeRouletteSegments(segments, { nowIso = nowIsoTimestamp() } = {}) {
  const seen = new Set();
  return (Array.isArray(segments) ? segments : [])
    .map((segment, index) => normalizeRouletteSegment(segment, index, { nowIso }))
    .filter(segment => segment && segment.id && segment.label && !seen.has(segment.id) && (seen.add(segment.id), true))
    .sort((left, right) => left.orderIndex - right.orderIndex || left.id.localeCompare(right.id))
    .map((segment, index) => ({ ...segment, orderIndex: index }));
}

export function normalizeRouletteWheel(wheel, { nowIso = nowIsoTimestamp() } = {}) {
  if (!wheel || typeof wheel !== 'object') {
    return {
      householdId: null,
      segments: [],
      meta: {},
      updatedAt: nowIso
    };
  }
  return {
    householdId: cleanString(wheel.householdId) || null,
    segments: normalizeRouletteSegments(wheel.segments, { nowIso }),
    meta: wheel.meta && typeof wheel.meta === 'object' ? { ...wheel.meta } : {},
    updatedAt: isValidIsoTimestamp(wheel.updatedAt) ? wheel.updatedAt : nowIso
  };
}

export function normalizeSpinHistoryEntry(entry, index = 0, { nowIso = nowIsoTimestamp() } = {}) {
  if (!entry || typeof entry !== 'object') return null;
  const targetKid = normalizeTargetKid(entry.targetKid);
  return {
    id: cleanString(entry.id),
    segmentId: cleanString(entry.segmentId),
    label: cleanString(entry.label),
    targetKid,
    householdId: cleanString(entry.householdId) || null,
    actorRole: isKidRole(entry.actorRole) ? entry.actorRole : null,
    weight: Number.isFinite(entry.weight) && entry.weight >= 0 ? entry.weight : 0,
    ticket: Number.isFinite(entry.ticket) && entry.ticket >= 0 ? entry.ticket : 0,
    angle: Number.isFinite(entry.angle) ? entry.angle : 0,
    assignedTo: normalizeAssignedTo(entry.assignedTo),
    meta: entry.meta && typeof entry.meta === 'object' ? { ...entry.meta } : {},
    createdAt: isValidIsoTimestamp(entry.createdAt) ? entry.createdAt : nowIso,
    orderIndex: Number.isInteger(entry.orderIndex) ? entry.orderIndex : index
  };
}

export function normalizeSpinHistory(history, { nowIso = nowIsoTimestamp() } = {}) {
  const seen = new Set();
  return (Array.isArray(history) ? history : [])
    .map((entry, index) => normalizeSpinHistoryEntry(entry, index, { nowIso }))
    .filter(entry => entry && entry.id && entry.segmentId && !seen.has(entry.id) && (seen.add(entry.id), true))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.orderIndex - right.orderIndex);
}

export function filterSpinHistory(history, targetKid = null) {
  return normalizeSpinHistory(history).filter(entry => segmentMatchesTarget(entry, targetKid));
}

function segmentMergeKey(segment) {
  if (!segment?.sourceType || !segment?.sourceId) return `id:${segment?.id ?? ''}`;
  return `${segment.sourceType}:${segment.sourceId}`;
}

export function mergeRouletteSegments(storedSegments, generatedSegments, { nowIso = nowIsoTimestamp() } = {}) {
  const stored = normalizeRouletteSegments(storedSegments, { nowIso });
  const generated = normalizeRouletteSegments(generatedSegments, { nowIso });
  const storedByKey = new Map(stored.map(segment => [segmentMergeKey(segment), segment]));
  const manualSegments = stored.filter(segment => segment.sourceType !== 'chore');
  const maxStoredOrder = stored.reduce((max, segment) => Math.max(max, segment.orderIndex), -1);

  const mergedGenerated = generated.map((segment, index) => {
    const storedSegment = storedByKey.get(segmentMergeKey(segment));
    if (!storedSegment) {
      return { ...segment, orderIndex: maxStoredOrder + index + 1 };
    }
    return {
      ...segment,
      id: storedSegment.id || segment.id,
      weight: storedSegment.weight,
      color: storedSegment.color,
      meta: { ...segment.meta, ...storedSegment.meta },
      orderIndex: storedSegment.orderIndex,
      updatedAt: storedSegment.updatedAt || segment.updatedAt
    };
  });

  return [...mergedGenerated, ...manualSegments]
    .sort((left, right) => left.orderIndex - right.orderIndex || left.id.localeCompare(right.id))
    .map((segment, index) => ({ ...segment, orderIndex: index }));
}

function getPositiveWeight(segment) {
  return Number.isFinite(segment?.weight) && segment.weight > 0 ? segment.weight : 0;
}

function normalizeRandomValue(randomValue) {
  if (!Number.isFinite(randomValue)) return 0;
  if (randomValue <= 0) return 0;
  if (randomValue >= 1) return 1 - Number.EPSILON;
  return randomValue;
}

export function pickSegmentByWeight(segments, randomValue = 0) {
  const normalizedSegments = normalizeRouletteSegments(segments);
  const totalWeight = normalizedSegments.reduce((sum, segment) => sum + getPositiveWeight(segment), 0);
  if (normalizedSegments.length === 0 || totalWeight <= 0) return null;
  const ticket = normalizeRandomValue(randomValue) * totalWeight;
  let cumulative = 0;
  for (const segment of normalizedSegments) {
    cumulative += getPositiveWeight(segment);
    if (ticket < cumulative) {
      return segment;
    }
  }
  return normalizedSegments[normalizedSegments.length - 1] ?? null;
}

function findSegmentArc(segments, segmentId) {
  const normalizedSegments = normalizeRouletteSegments(segments);
  const totalWeight = normalizedSegments.reduce((sum, segment) => sum + getPositiveWeight(segment), 0);
  if (!segmentId || totalWeight <= 0) return null;
  let startAngle = 0;
  for (const segment of normalizedSegments) {
    const span = (getPositiveWeight(segment) / totalWeight) * 360;
    if (segment.id === segmentId) {
      return { segment, startAngle, endAngle: startAngle + span };
    }
    startAngle += span;
  }
  return null;
}

export function computeTargetAngleForSegment(segments, segmentId, {
  fullRotations = 6,
  pointerAngle = 0,
  landingOffsetRatio = 0.5
} = {}) {
  const arc = findSegmentArc(segments, segmentId);
  if (!arc) return null;
  const offsetRatio = clampNumber(landingOffsetRatio, 0, 1);
  const landingAngle = arc.startAngle + ((arc.endAngle - arc.startAngle) * offsetRatio);
  const normalizedPointerAngle = ((pointerAngle % 360) + 360) % 360;
  const pointerAdjustment = (360 - normalizedPointerAngle - landingAngle + 360) % 360;
  return (Math.max(0, fullRotations) * 360) + pointerAdjustment;
}

export function spinPhysicsStep({
  angle = 0,
  velocity = 0,
  deltaMs = 16,
  frictionPerSecond = 0.92,
  minVelocity = 0.01
} = {}) {
  const stepSeconds = Math.max(0, deltaMs) / 1000;
  const nextVelocity = velocity * Math.pow(clampNumber(frictionPerSecond, 0, 1), stepSeconds);
  const resolvedVelocity = Math.abs(nextVelocity) <= Math.max(0, minVelocity) ? 0 : nextVelocity;
  return {
    angle: angle + (((velocity + resolvedVelocity) / 2) * stepSeconds),
    velocity: resolvedVelocity,
    isSpinning: resolvedVelocity !== 0
  };
}

export function mergeRouletteHistory(localHistory, remoteHistory, { nowIso = nowIsoTimestamp() } = {}) {
  const seen = new Set();
  return [...normalizeSpinHistory(localHistory, { nowIso }), ...normalizeSpinHistory(remoteHistory, { nowIso })]
    .filter(entry => !seen.has(entry.id) && (seen.add(entry.id), true))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function mergeRouletteSnapshots(localRoulette, remoteRoulette, { nowIso = nowIsoTimestamp() } = {}) {
  const local = {
    wheel: normalizeRouletteWheel(localRoulette?.wheel, { nowIso }),
    history: normalizeSpinHistory(localRoulette?.history, { nowIso })
  };
  const remote = {
    wheel: normalizeRouletteWheel(remoteRoulette?.wheel, { nowIso }),
    history: normalizeSpinHistory(remoteRoulette?.history, { nowIso })
  };
  const remoteById = new Map(remote.wheel.segments.map(segment => [segment.id, segment]));
  const mergedSegments = normalizeRouletteSegments([
    ...local.wheel.segments.map(segment => {
      const remoteSegment = remoteById.get(segment.id);
      return remoteSegment && remoteSegment.updatedAt > segment.updatedAt ? remoteSegment : segment;
    }),
    ...remote.wheel.segments.filter(segment => !local.wheel.segments.some(localSegment => localSegment.id === segment.id))
  ], { nowIso });
  const wheel = (remote.wheel.updatedAt > local.wheel.updatedAt ? remote.wheel : local.wheel);
  return {
    wheel: { ...wheel, segments: mergedSegments, updatedAt: wheel.updatedAt },
    history: mergeRouletteHistory(local.history, remote.history, { nowIso })
  };
}
