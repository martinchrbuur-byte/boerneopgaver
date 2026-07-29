import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ROULETTE_TARGET_BOTH,
  computeTargetAngleForSegment,
  filterSegmentsByTarget,
  mergeRouletteSegments,
  pickSegmentByWeight,
  spinPhysicsStep
} from '../../src/shared/rouletteModel.js';

test('pickSegmentByWeight is deterministic across weighted boundaries', () => {
  const segments = [
    { id: 'a', label: 'A', weight: 2, assignedTo: ['Andrea'] },
    { id: 'b', label: 'B', weight: 1, assignedTo: ['Andrea'] },
    { id: 'c', label: 'C', weight: 3, assignedTo: ['Andrea'] }
  ];

  assert.equal(pickSegmentByWeight(segments, 0).id, 'a');
  assert.equal(pickSegmentByWeight(segments, 0.4).id, 'b');
  assert.equal(pickSegmentByWeight(segments, 0.5).id, 'c');
  assert.equal(pickSegmentByWeight(segments, 0.999999).id, 'c');
});

test('target filtering supports individual kids and both semantics', () => {
  const segments = [
    { id: 'andrea', label: 'Andrea only', assignedTo: ['Andrea'] },
    { id: 'both', label: 'Shared', assignedTo: ['Andrea', 'Hans Jørgen'] },
    { id: 'hans', label: 'Hans only', assignedTo: ['Hans Jørgen'] }
  ];

  assert.deepEqual(filterSegmentsByTarget(segments, 'Andrea').map(segment => segment.id), ['andrea', 'both']);
  assert.deepEqual(filterSegmentsByTarget(segments, 'Hans Jørgen').map(segment => segment.id), ['both', 'hans']);
  assert.deepEqual(filterSegmentsByTarget(segments, ROULETTE_TARGET_BOTH).map(segment => segment.id), ['both']);
});

test('mergeRouletteSegments preserves stored config while refreshing chore data', () => {
  const stored = [
    { id: 'manual-1', label: 'Manual', sourceType: 'manual', weight: 4, orderIndex: 0, assignedTo: ['Andrea'] },
    { id: 'stored-chore-a', label: 'Old label', sourceType: 'chore', sourceId: 'chore-a', weight: 7, color: '#abc', orderIndex: 1, assignedTo: ['Andrea'] }
  ];
  const generated = [
    { id: 'generated-a', label: 'New label', sourceType: 'chore', sourceId: 'chore-a', weight: 1, orderIndex: 0, assignedTo: ['Hans Jørgen'] },
    { id: 'generated-b', label: 'Fresh chore', sourceType: 'chore', sourceId: 'chore-b', weight: 1, orderIndex: 1, assignedTo: ['Andrea', 'Hans Jørgen'] }
  ];

  const merged = mergeRouletteSegments(stored, generated, { nowIso: '2026-01-01T10:00:00.000Z' });

  assert.deepEqual(merged.map(segment => segment.id), ['manual-1', 'stored-chore-a', 'generated-b']);
  assert.equal(merged[1].label, 'New label');
  assert.equal(merged[1].weight, 7);
  assert.equal(merged[1].color, '#abc');
  assert.deepEqual(merged[1].assignedTo, ['Hans Jørgen']);
});

test('computeTargetAngleForSegment and spinPhysicsStep stay deterministic', () => {
  const segments = [
    { id: 'a', label: 'A', weight: 2, assignedTo: ['Andrea'] },
    { id: 'b', label: 'B', weight: 1, assignedTo: ['Andrea'] },
    { id: 'c', label: 'C', weight: 3, assignedTo: ['Andrea'] }
  ];

  assert.equal(computeTargetAngleForSegment(segments, 'b', { fullRotations: 2 }), 930);
  assert.deepEqual(spinPhysicsStep({ angle: 0, velocity: 360, deltaMs: 1000, frictionPerSecond: 0.25 }), {
    angle: 225,
    velocity: 90,
    isSpinning: true
  });
});
