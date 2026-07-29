import { nowIsoTimestamp } from '../shared/dateTime.js';
import { createEntityId } from '../shared/id.js';
import {
  canConfigureRoulette,
  canSpinRoulette,
  computeTargetAngleForSegment,
  filterEligibleSegments,
  filterSegmentsByTarget,
  filterSpinHistory,
  isKidRole,
  mergeRouletteSegments,
  normalizeAssignedTo,
  normalizeRouletteSegment,
  normalizeRouletteSegments,
  normalizeRouletteWheel,
  normalizeSpinHistory,
  pickSegmentByWeight,
  resolveRouletteTarget,
  spinPhysicsStep
} from '../shared/rouletteModel.js';

export const ROULETTE_MESSAGES = Object.freeze({
  parentOnly: 'Kun forældrevisning kan redigere roulettehjulet.',
  kidOnly: 'Kun børnevisning kan spinne roulettehjulet.',
  invalidSegment: 'Roulette-feltet er ugyldigt.',
  missingSegment: 'Roulette-feltet kunne ikke findes.',
  noSegments: 'Der er ingen roulette-felter at spinne på.',
  saved: 'Roulettehjulet er gemt.',
  spun: 'Roulettehjulet er spundet.'
});

function asResult(ok, message, state) {
  return { ok, message, state };
}

function normalizeRouletteSnapshot(snapshot, nowIso = nowIsoTimestamp()) {
  const wheel = normalizeRouletteWheel(snapshot?.wheel, { nowIso });
  const history = normalizeSpinHistory(snapshot?.history, { nowIso });
  return { wheel, history };
}

function buildChoreSegments(data, choreService, nowIso, activePeriodId = null) {
  const choreState = typeof choreService?.getState === 'function'
    ? choreService.getState({ activePeriodId })
    : null;
  const chores = Array.isArray(choreState?.chores)
    ? choreState.chores.filter(chore => chore && chore.id && chore.name && chore.isFullyDone !== true)
    : (Array.isArray(data?.chores) ? data.chores.filter(chore => chore && chore.id && chore.name) : []);

  return chores.map((chore, index) => normalizeRouletteSegment({
    id: `roulette-chore-${chore.id}`,
    label: chore.name,
    weight: 1,
    assignedTo: normalizeAssignedTo(chore.assignedTo),
    sourceType: 'chore',
    sourceId: chore.id,
    meta: {
      choreId: chore.id,
      value: typeof chore.value === 'number' ? chore.value : 0,
      maxPerPeriod: typeof chore.maxPerPeriod === 'number' ? chore.maxPerPeriod : 1
    },
    orderIndex: index,
    updatedAt: nowIso
  }, index, { nowIso })).filter(Boolean);
}

function materializeWheel(data, choreService, nowIso, activePeriodId = null) {
  const snapshot = normalizeRouletteSnapshot(data?.roulette, nowIso);
  const generatedSegments = buildChoreSegments(data, choreService, nowIso, activePeriodId);
  const segments = mergeRouletteSegments(snapshot.wheel.segments, generatedSegments, { nowIso });
  return {
    wheel: {
      ...snapshot.wheel,
      segments,
      updatedAt: snapshot.wheel.updatedAt || nowIso
    },
    history: snapshot.history
  };
}

function getStateFromData(data, choreService, {
  actorRole = 'parent',
  targetKid = null,
  limit = 50,
  activePeriodId = null,
  nowIso = nowIsoTimestamp()
} = {}) {
  const resolvedTargetKid = resolveRouletteTarget(actorRole, targetKid);
  const materialized = materializeWheel(data, choreService, nowIso, activePeriodId);
    const eligibility = actorRole !== 'parent'
      ? filterEligibleSegments(materialized.wheel.segments, actorRole, resolvedTargetKid === 'both' ? 'both' : 'self')
      : { segments: filterSegmentsByTarget(materialized.wheel.segments, resolvedTargetKid), sharedSuggestion: false };
    return {
      wheel: {
        ...materialized.wheel,
        segments: eligibility.segments
      },
    history: filterSpinHistory(materialized.history, resolvedTargetKid).slice(0, Math.max(0, limit)),
    targetKid: resolvedTargetKid,
    permissions: {
      canConfigure: canConfigureRoulette(actorRole),
      canSpin: canSpinRoulette(actorRole, resolvedTargetKid)
    }
  };
}

function updateRouletteData(storageService, updater) {
  return storageService.updateData((data) => {
    const snapshot = normalizeRouletteSnapshot(data.roulette, nowIsoTimestamp());
    const nextRoulette = updater(snapshot, data);
    return {
      ...data,
      roulette: {
        wheel: normalizeRouletteWheel(nextRoulette.wheel),
        history: normalizeSpinHistory(nextRoulette.history)
      }
    };
  });
}

export function createRouletteService({ storageService, choreService = null, nowProvider = nowIsoTimestamp } = {}) {
  if (!storageService) {
    throw new Error('createRouletteService requires storageService.');
  }

  function getWheel({ actorRole = 'parent', targetKid = null, limit = 50, activePeriodId = null } = {}) {
    return asResult(true, '', getStateFromData(storageService.loadData(), choreService, {
      actorRole,
      targetKid,
      limit,
      activePeriodId,
      nowIso: nowProvider()
    }));
  }

  function createWheel({
    actorRole = 'parent',
    householdId = null,
    segments,
    meta = {},
    targetKid = null,
    nowIso = nowProvider()
  } = {}) {
    if (!canConfigureRoulette(actorRole)) {
      return asResult(false, ROULETTE_MESSAGES.parentOnly, getStateFromData(storageService.loadData(), choreService, { actorRole, targetKid, nowIso }));
    }

    updateRouletteData(storageService, (snapshot, data) => {
      const materialized = materializeWheel(data, choreService, nowIso);
      const nextSegments = Array.isArray(segments)
        ? normalizeRouletteSegments(segments, { nowIso })
        : materialized.wheel.segments;
      return {
        wheel: normalizeRouletteWheel({
          householdId,
          segments: nextSegments,
          meta: { ...materialized.wheel.meta, ...meta },
          updatedAt: nowIso
        }, { nowIso }),
        history: snapshot.history
      };
    });

    return asResult(true, ROULETTE_MESSAGES.saved, getStateFromData(storageService.loadData(), choreService, { actorRole, targetKid, nowIso }));
  }

  function updateWheel(patch = {}, { actorRole = 'parent', targetKid = null, nowIso = nowProvider() } = {}) {
    if (!canConfigureRoulette(actorRole)) {
      return asResult(false, ROULETTE_MESSAGES.parentOnly, getStateFromData(storageService.loadData(), choreService, { actorRole, targetKid, nowIso }));
    }

    updateRouletteData(storageService, (snapshot, data) => {
      const materialized = materializeWheel(data, choreService, nowIso);
      return {
        wheel: normalizeRouletteWheel({
          ...materialized.wheel,
          ...patch,
          meta: { ...materialized.wheel.meta, ...(patch.meta && typeof patch.meta === 'object' ? patch.meta : {}) },
          segments: patch.segments === undefined
            ? materialized.wheel.segments
            : normalizeRouletteSegments(patch.segments, { nowIso }),
          updatedAt: nowIso
        }, { nowIso }),
        history: snapshot.history
      };
    });

    return asResult(true, ROULETTE_MESSAGES.saved, getStateFromData(storageService.loadData(), choreService, { actorRole, targetKid, nowIso }));
  }

  function addSegment(segment, { actorRole = 'parent', targetKid = null, nowIso = nowProvider() } = {}) {
    if (!canConfigureRoulette(actorRole)) {
      return asResult(false, ROULETTE_MESSAGES.parentOnly, getStateFromData(storageService.loadData(), choreService, { actorRole, targetKid, nowIso }));
    }

    const nextSegment = normalizeRouletteSegment({
      ...segment,
      id: segment?.id || createEntityId('roulette-segment'),
      sourceType: segment?.sourceType || 'manual',
      updatedAt: nowIso
    });
    if (!nextSegment?.label) {
      return asResult(false, ROULETTE_MESSAGES.invalidSegment, getStateFromData(storageService.loadData(), choreService, { actorRole, targetKid, nowIso }));
    }

    updateRouletteData(storageService, (snapshot, data) => {
      const materialized = materializeWheel(data, choreService, nowIso);
      return {
        wheel: {
          ...materialized.wheel,
          segments: normalizeRouletteSegments([...materialized.wheel.segments, { ...nextSegment, orderIndex: materialized.wheel.segments.length }], { nowIso }),
          updatedAt: nowIso
        },
        history: snapshot.history
      };
    });

    return asResult(true, ROULETTE_MESSAGES.saved, getStateFromData(storageService.loadData(), choreService, { actorRole, targetKid, nowIso }));
  }

  function updateSegment(segmentId, patch = {}, { actorRole = 'parent', targetKid = null, nowIso = nowProvider() } = {}) {
    if (!canConfigureRoulette(actorRole)) {
      return asResult(false, ROULETTE_MESSAGES.parentOnly, getStateFromData(storageService.loadData(), choreService, { actorRole, targetKid, nowIso }));
    }

    const currentState = getStateFromData(storageService.loadData(), choreService, { actorRole: 'parent', nowIso });
    if (!currentState.wheel.segments.some(segment => segment.id === segmentId)) {
      return asResult(false, ROULETTE_MESSAGES.missingSegment, getStateFromData(storageService.loadData(), choreService, { actorRole, targetKid, nowIso }));
    }

    updateRouletteData(storageService, (snapshot, data) => {
      const materialized = materializeWheel(data, choreService, nowIso);
      return {
        wheel: {
          ...materialized.wheel,
          segments: normalizeRouletteSegments(materialized.wheel.segments.map((segment) => (
            segment.id === segmentId
              ? { ...segment, ...patch, id: segment.id, updatedAt: nowIso }
              : segment
          )), { nowIso }),
          updatedAt: nowIso
        },
        history: snapshot.history
      };
    });

    return asResult(true, ROULETTE_MESSAGES.saved, getStateFromData(storageService.loadData(), choreService, { actorRole, targetKid, nowIso }));
  }

  function removeSegment(segmentId, { actorRole = 'parent', targetKid = null, nowIso = nowProvider() } = {}) {
    if (!canConfigureRoulette(actorRole)) {
      return asResult(false, ROULETTE_MESSAGES.parentOnly, getStateFromData(storageService.loadData(), choreService, { actorRole, targetKid, nowIso }));
    }

    const currentState = getStateFromData(storageService.loadData(), choreService, { actorRole: 'parent', nowIso });
    if (!currentState.wheel.segments.some(segment => segment.id === segmentId)) {
      return asResult(false, ROULETTE_MESSAGES.missingSegment, getStateFromData(storageService.loadData(), choreService, { actorRole, targetKid, nowIso }));
    }

    updateRouletteData(storageService, (snapshot, data) => {
      const materialized = materializeWheel(data, choreService, nowIso);
      return {
        wheel: {
          ...materialized.wheel,
          segments: normalizeRouletteSegments(materialized.wheel.segments.filter(segment => segment.id !== segmentId), { nowIso }),
          updatedAt: nowIso
        },
        history: snapshot.history
      };
    });

    return asResult(true, ROULETTE_MESSAGES.saved, getStateFromData(storageService.loadData(), choreService, { actorRole, targetKid, nowIso }));
  }

  function reorderSegments(orderedSegmentIds, { actorRole = 'parent', targetKid = null, nowIso = nowProvider() } = {}) {
    if (!canConfigureRoulette(actorRole)) {
      return asResult(false, ROULETTE_MESSAGES.parentOnly, getStateFromData(storageService.loadData(), choreService, { actorRole, targetKid, nowIso }));
    }

    const currentState = getStateFromData(storageService.loadData(), choreService, { actorRole: 'parent', nowIso });
    const currentSegments = currentState.wheel.segments;
    const byId = new Map(currentSegments.map(segment => [segment.id, segment]));
    if (
      !Array.isArray(orderedSegmentIds) ||
      orderedSegmentIds.length !== currentSegments.length ||
      new Set(orderedSegmentIds).size !== orderedSegmentIds.length ||
      orderedSegmentIds.some(id => !byId.has(id))
    ) {
      return asResult(false, ROULETTE_MESSAGES.invalidSegment, getStateFromData(storageService.loadData(), choreService, { actorRole, targetKid, nowIso }));
    }

    updateRouletteData(storageService, (snapshot, data) => {
      const materialized = materializeWheel(data, choreService, nowIso);
      const segmentsById = new Map(materialized.wheel.segments.map(segment => [segment.id, segment]));
      return {
        wheel: {
          ...materialized.wheel,
          segments: orderedSegmentIds.map((id, index) => ({ ...segmentsById.get(id), orderIndex: index, updatedAt: nowIso })),
          updatedAt: nowIso
        },
        history: snapshot.history
      };
    });

    return asResult(true, ROULETTE_MESSAGES.saved, getStateFromData(storageService.loadData(), choreService, { actorRole, targetKid, nowIso }));
  }

  function spinWheel({
    actorRole,
    targetKid = null,
    randomValue = 0,
    householdId = null,
    nowIso = nowProvider(),
    fullRotations = 8,
    pointerAngle = 0,
    landingOffsetRatio = 0.5,
    deltaMs = 1000,
    frictionPerSecond = 0.12,
    initialVelocity = 1440,
    seed = null,
    actorId = actorRole,
    activePeriodId = null
  } = {}) {
    const resolvedTargetKid = resolveRouletteTarget(actorRole, targetKid);
    if (!canSpinRoulette(actorRole, resolvedTargetKid)) {
      return asResult(false, ROULETTE_MESSAGES.kidOnly, getStateFromData(storageService.loadData(), choreService, { actorRole: actorRole || 'parent', targetKid, activePeriodId, nowIso }));
    }

    const data = storageService.loadData();
    const state = getStateFromData(data, choreService, { actorRole, targetKid: resolvedTargetKid, activePeriodId, nowIso });
    const seededValue = Number.isFinite(seed)
      ? ((Math.sin(seed) * 10000) % 1 + 1) % 1
      : randomValue;
    const pickedSegment = pickSegmentByWeight(state.wheel.segments, seededValue);
    if (!pickedSegment) {
      return asResult(false, ROULETTE_MESSAGES.noSegments, state);
    }

    const totalWeight = state.wheel.segments.reduce((sum, segment) => sum + (segment.weight > 0 ? segment.weight : 0), 0);
    const normalizedRandomValue = seededValue <= 0 ? 0 : (seededValue >= 1 ? 1 - Number.EPSILON : seededValue);
    const entry = {
      id: createEntityId('roulette-spin'),
      segmentId: pickedSegment.id,
      label: pickedSegment.label,
      targetKid: resolvedTargetKid,
      sharedSuggestion: state.sharedSuggestion,
      householdId: householdId ?? state.wheel.householdId ?? null,
      actorRole,
      weight: pickedSegment.weight,
      ticket: normalizedRandomValue * totalWeight,
      angle: computeTargetAngleForSegment(state.wheel.segments, pickedSegment.id, { fullRotations, pointerAngle, landingOffsetRatio }) ?? 0,
      assignedTo: resolvedTargetKid === 'both' && !state.sharedSuggestion ? ['Hans Jørgen', 'Andrea'] : pickedSegment.assignedTo,
      meta: {
        physics: spinPhysicsStep({
          angle: 0,
          velocity: initialVelocity,
          deltaMs,
          frictionPerSecond
        }),
        sourceId: pickedSegment.sourceId,
        sourceType: pickedSegment.sourceType,
        seed: Number.isFinite(seed) ? seed : null,
        actorId,
        sharedSuggestion: state.sharedSuggestion
      },
      createdAt: nowIso
    };

    updateRouletteData(storageService, (snapshot) => ({
      wheel: normalizeRouletteWheel({
        ...snapshot.wheel,
        householdId: householdId ?? snapshot.wheel.householdId ?? null,
        updatedAt: nowIso
      }, { nowIso }),
      history: [...snapshot.history, entry].slice(-100)
    }));

    const nextState = getStateFromData(storageService.loadData(), choreService, { actorRole, targetKid: resolvedTargetKid, activePeriodId, nowIso });
    const spinEntry = nextState.history[0];
    return asResult(true, ROULETTE_MESSAGES.spun, {
      ...nextState,
      result: {
        chosenSegmentId: pickedSegment.id,
        assignedTo: spinEntry?.assignedTo ?? [],
        seed: Number.isFinite(seed) ? seed : null,
        spinTimestamp: nowIso,
        animationParams: {
          targetAngle: spinEntry?.angle ?? 0,
          duration: 7200,
          friction: frictionPerSecond,
          easing: 'settle'
        },
        sharedSuggestion: state.sharedSuggestion
      }
    });
  }

  function getSpinHistory({ actorRole = 'parent', targetKid = null, limit = 50 } = {}) {
    const data = storageService.loadData();
    const resolvedTargetKid = resolveRouletteTarget(actorRole, targetKid);
    return asResult(true, '', {
      history: filterSpinHistory(normalizeRouletteSnapshot(data.roulette, nowProvider()).history, resolvedTargetKid)
        .slice(0, Math.max(0, limit)),
      targetKid: resolvedTargetKid,
      permissions: {
        canConfigure: canConfigureRoulette(actorRole),
        canSpin: canSpinRoulette(actorRole, resolvedTargetKid)
      }
    });
  }

  return {
    getWheel: (householdIdOrOptions, options = {}) => getWheel(
      typeof householdIdOrOptions === 'string' ? { ...options, householdId: householdIdOrOptions } : (householdIdOrOptions ?? {})
    ),
    createWheel: (householdIdOrOptions, segments, meta = {}) => createWheel(
      typeof householdIdOrOptions === 'string'
        ? { householdId: householdIdOrOptions, segments, meta, actorRole: meta.actorRole ?? 'parent' }
        : (householdIdOrOptions ?? {})
    ),
    updateWheel: (householdIdOrPatch, patchOrOptions = {}, options = {}) => {
      if (typeof householdIdOrPatch === 'string') {
        return updateWheel({ ...patchOrOptions, householdId: householdIdOrPatch }, options);
      }
      return updateWheel(householdIdOrPatch, patchOrOptions);
    },
    addSegment: (householdIdOrSegment, segmentOrOptions = {}, options = {}) => addSegment(
      typeof householdIdOrSegment === 'string' ? segmentOrOptions : householdIdOrSegment,
      typeof householdIdOrSegment === 'string' ? options : segmentOrOptions
    ),
    updateSegment: (householdIdOrSegmentId, segmentIdOrPatch, patchOrOptions = {}, options = {}) => {
      if (typeof segmentIdOrPatch === 'string') {
        return updateSegment(segmentIdOrPatch, patchOrOptions, options);
      }
      return updateSegment(householdIdOrSegmentId, segmentIdOrPatch, patchOrOptions);
    },
    removeSegment: (householdIdOrSegmentId, segmentIdOrOptions, options = {}) => {
      if (typeof segmentIdOrOptions === 'string') {
        return removeSegment(segmentIdOrOptions, options);
      }
      return removeSegment(householdIdOrSegmentId, segmentIdOrOptions);
    },
    reorderSegments: (householdIdOrIds, idsOrOptions, options = {}) => reorderSegments(
      Array.isArray(householdIdOrIds) ? householdIdOrIds : idsOrOptions,
      Array.isArray(householdIdOrIds) ? idsOrOptions : options
    ),
    spinWheel: (householdIdOrOptions, actorRole, actorId, options = {}) => spinWheel(
      typeof householdIdOrOptions === 'string'
        ? {
          householdId: householdIdOrOptions,
          actorRole,
          actorId,
          targetKid: options.target === 'both' ? 'both' : actorId,
          seed: options.seed,
          ...options.spinConfig
        }
        : (householdIdOrOptions ?? {})
    ),
    getSpinHistory: (householdIdOrOptions, limit = 50) => getSpinHistory(
      typeof householdIdOrOptions === 'string' ? { limit } : (householdIdOrOptions ?? {})
    )
  };
}

export { asResult, isKidRole };
