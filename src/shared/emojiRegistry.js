/**
 * Canonical semantic emoji metadata.
 *
 * Application state should store these keys, never Unicode emoji or asset URLs.
 * The existing iconRegistry remains the rendering compatibility layer while
 * callers migrate to these semantic names.
 */

export const EMOJI_DEFINITIONS = Object.freeze({
  food: Object.freeze({ key: 'food', label: 'Mad', category: 'food' }),
  broom: Object.freeze({ key: 'broom', label: 'Rengøring', category: 'cleaning', aliasOf: 'cleanup' }),
  coin: Object.freeze({ key: 'coin', label: 'Mønt', category: 'money' }),
  confetti: Object.freeze({ key: 'confetti', label: 'Konfetti', category: 'celebration' }),
  partyPopper: Object.freeze({ key: 'partyPopper', label: 'Fest', category: 'celebration', aliasOf: 'party' }),
  sparkle: Object.freeze({ key: 'sparkle', label: 'Glimt', category: 'celebration' }),
  rocket: Object.freeze({ key: 'rocket', label: 'Raket', category: 'achievement' }),
  trophy: Object.freeze({ key: 'trophy', label: 'Trofæ', category: 'achievement' }),
  sleep: Object.freeze({ key: 'sleep', label: 'Søvn', category: 'sleep' }),
  dental: Object.freeze({ key: 'dental', label: 'Tandpleje', category: 'dental' }),
  pet: Object.freeze({ key: 'pet', label: 'Kæledyr', category: 'pets' }),
  clothes: Object.freeze({ key: 'clothes', label: 'Tøj', category: 'clothing' }),
  school: Object.freeze({ key: 'school', label: 'Skole', category: 'school' }),
  bath: Object.freeze({ key: 'bath', label: 'Bad', category: 'bath' }),
  check: Object.freeze({ key: 'check', label: 'Færdig', category: 'action' }),
  warning: Object.freeze({ key: 'warning', label: 'Advarsel', category: 'status' }),
});

const ALIASES = Object.freeze({
  clean: 'broom',
  party: 'partyPopper',
});

export function normalizeEmojiKey(key) {
  const canonicalKey = ALIASES[key] ?? key;
  return EMOJI_DEFINITIONS[canonicalKey] ? canonicalKey : null;
}

export function getEmojiDefinition(key) {
  const canonicalKey = normalizeEmojiKey(key);
  return canonicalKey ? EMOJI_DEFINITIONS[canonicalKey] : null;
}

export function isKnownEmojiKey(key) {
  return Boolean(normalizeEmojiKey(key));
}

export function getEmojiCategory(key) {
  return getEmojiDefinition(key)?.category ?? null;
}
