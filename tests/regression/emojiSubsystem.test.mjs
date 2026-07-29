import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EMOJI_DEFINITIONS,
  getEmojiDefinition,
  isKnownEmojiKey,
} from '../../src/shared/emojiRegistry.js';
import { renderTwemoji } from '../../src/shared/twemojiRenderer.js';
import { getChoreVisual } from '../../src/shared/choreMarker.js';
import { HELPER_CAST, pickPhrase } from '../../src/shared/helperCast.js';
import {
  EMOJI_MAPPING_STORAGE_KEY,
  clearStoredEmojiMappings,
  getStoredEmojiMapping,
  rememberEmojiMapping,
} from '../../src/shared/emojiMappingService.js';

test('semantic registry contains contextual primary keys', () => {
  assert.equal(getEmojiDefinition('food').category, 'food');
  assert.equal(getEmojiDefinition('broom').category, 'cleaning');
  assert.equal(getEmojiDefinition('hair').category, 'grooming');
  assert.equal(getEmojiDefinition('task').category, 'task');
  assert.equal(getEmojiDefinition('coin').category, 'money');
  assert.equal(getEmojiDefinition('confetti').category, 'celebration');
  assert.ok(Object.keys(EMOJI_DEFINITIONS).length > 0);
});

test('legacy semantic aliases resolve to canonical keys', () => {
  assert.equal(getEmojiDefinition('clean').key, 'broom');
  assert.equal(getEmojiDefinition('party').key, 'partyPopper');
  assert.equal(isKnownEmojiKey('broom'), true);
  assert.equal(isKnownEmojiKey('not-real'), false);
});

test('contextual chore markers do not vary into unrelated categories', () => {
  assert.equal(getChoreVisual('Lav aftensmad', 'food-1').iconKey, 'food');
  assert.equal(getChoreVisual('Ryd op på værelset', 'clean-1').iconKey, 'cleanup');
  assert.equal(getChoreVisual('Børst tænder', 'tooth-1').iconKey, 'dental');
});

test('Twemoji renderer emits an image with a semantic key', () => {
  const markup = renderTwemoji('coin');
  assert.match(markup, /<img/);
  assert.match(markup, /1fa99\.svg/);
  assert.match(markup, /data-emoji-key="coin"/);
  assert.doesNotMatch(markup, /🪙/u);
});

test('helper phrases carry emoji keys instead of native emoji text', () => {
  for (const helper of HELPER_CAST) {
    const phrase = pickPhrase(helper);
    assert.equal(typeof phrase.text, 'string');
    assert.ok(isKnownEmojiKey(phrase.emojiKey));
    assert.doesNotMatch(phrase.text, /[\u{1F300}-\u{1FAFF}]/u);
  }
});

test('local emoji mappings reject unknown icon keys and recover from invalid data', () => {
  const storage = new MapStorage();
  storage.setItem(EMOJI_MAPPING_STORAGE_KEY, '{not valid json');

  assert.equal(getStoredEmojiMapping('Pak tasken', storage), null);
  assert.equal(rememberEmojiMapping('Pak tasken', 'school', storage), true);
  assert.equal(getStoredEmojiMapping('pak tasken', storage), 'school');
  assert.equal(rememberEmojiMapping('Andet', 'not-an-icon', storage), false);
  assert.equal(clearStoredEmojiMappings(storage), true);
  assert.equal(getStoredEmojiMapping('Pak tasken', storage), null);
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
