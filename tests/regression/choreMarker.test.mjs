import test from 'node:test';
import assert from 'node:assert/strict';

import { getChoreVisual } from '../../src/shared/choreMarker.js';
import { rememberEmojiMapping } from '../../src/shared/emojiMappingService.js';

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

test('maps everyday checklist chores to specific markers', () => {
  assert.equal(getChoreVisual('Morgenmad').iconKey, 'food');
  assert.equal(getChoreVisual('Ordne hår').iconKey, 'hair');
  assert.equal(getChoreVisual('Tag tøj på').iconKey, 'clothes');
  assert.equal(getChoreVisual('Pak tasker').iconKey, 'school');
  assert.equal(getChoreVisual('Lav madpakker').iconKey, 'food');
  assert.equal(getChoreVisual('Læg tøj frem').iconKey, 'clothes');
});

test('uses local heuristics for unknown task wording', () => {
  const storage = new MapStorage();

  assert.equal(getChoreVisual('Vask sokker', undefined, { storage }).iconKey, 'clothes');
  assert.equal(getChoreVisual('Gør klar til frokost', undefined, { storage }).iconKey, 'food');
  assert.equal(getChoreVisual('Hent hundens foder', undefined, { storage }).iconKey, 'pet');
  assert.equal(getChoreVisual('Tag backpack med', undefined, { storage }).iconKey, 'school');
  assert.equal(getChoreVisual('Find mine stickers', undefined, { storage }).iconKey, 'task');
});

test('explicit keyword rules take precedence over local mappings', () => {
  const storage = new MapStorage();
  rememberEmojiMapping('Børst tænder', 'clothes', storage);

  const visual = getChoreVisual('Børst tænder', undefined, { storage });

  assert.equal(visual.iconKey, 'dental');
  assert.equal(visual.source, 'keyword');
});

test('reuses a stored mapping for an unknown task', () => {
  const storage = new MapStorage();
  rememberEmojiMapping('Gør klar til turen', 'rocket', storage);

  const visual = getChoreVisual('  GØR KLAR TIL TUREN  ', undefined, { storage });

  assert.equal(visual.iconKey, 'rocket');
  assert.equal(visual.source, 'learned');
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
  assert.equal(first.iconKey, 'task');
  assert.equal(first.source, 'fallback');
  assert.equal(second.source, 'fallback');
});

class MapStorage {
  #values = new Map();

  getItem(key) {
    return this.#values.get(key) ?? null;
  }

  setItem(key, value) {
    this.#values.set(key, value);
  }

  removeItem(key) {
    this.#values.delete(key);
  }
}
