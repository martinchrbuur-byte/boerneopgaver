import test from 'node:test';
import assert from 'node:assert/strict';

import { getChoreVisual } from '../../src/shared/choreMarker.js';

test('maps known English chore to bed marker', () => {
  const visual = getChoreVisual('Make the bed');

  assert.equal(visual.label, 'Søvn');
  assert.equal(visual.source, 'keyword');
});

test('maps known Danish chore to toothbrush marker', () => {
  const visual = getChoreVisual('Børst tænder');

  assert.equal(visual.label, 'Tandpleje');
  assert.equal(visual.source, 'keyword');
});

test('maps pet-feeding chores to pet marker in Danish and English', () => {
  const danish = getChoreVisual('Fodre hunden');
  const english = getChoreVisual('Feed the dog');

  assert.equal(danish.label, 'Kæledyr');
  assert.equal(english.label, 'Kæledyr');
  assert.equal(danish.source, 'keyword');
  assert.equal(english.source, 'keyword');
});

test('keyword visuals are deterministic for the same chore name', () => {
  const first = getChoreVisual('Ryd op på værelset');
  const second = getChoreVisual('Ryd op på værelset');

  assert.equal(first.iconKey, second.iconKey);
  assert.equal(first.label, second.label);
  assert.equal(first.source, 'keyword');
});

test('falls back deterministically for unknown chores', () => {
  const first = getChoreVisual('Sort my stickers');
  const second = getChoreVisual('Sort my stickers');

  assert.equal(first.iconKey, second.iconKey);
  assert.equal(first.source, 'fallback');
  assert.equal(second.source, 'fallback');
});
