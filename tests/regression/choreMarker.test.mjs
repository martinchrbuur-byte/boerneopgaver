import test from 'node:test';
import assert from 'node:assert/strict';

import { getChoreVisual } from '../../src/shared/choreMarker.js';

test('maps known English chore to bed marker', () => {
  const visual = getChoreVisual('Make the bed');

  assert.equal(visual.emoji, '🛏️');
  assert.equal(visual.source, 'keyword');
});

test('maps known Danish chore to toothbrush marker', () => {
  const visual = getChoreVisual('Børst tænder');

  assert.equal(visual.emoji, '🪥');
  assert.equal(visual.source, 'keyword');
});

test('maps pet-feeding chores to pet marker in Danish and English', () => {
  const danish = getChoreVisual('Fodre hunden');
  const english = getChoreVisual('Feed the dog');

  assert.equal(danish.emoji, '🐶');
  assert.equal(english.emoji, '🐶');
});

test('falls back deterministically for unknown chores', () => {
  const first = getChoreVisual('Sort my stickers');
  const second = getChoreVisual('Sort my stickers');

  assert.equal(first.emoji, second.emoji);
  assert.equal(first.source, 'fallback');
  assert.equal(second.source, 'fallback');
});
