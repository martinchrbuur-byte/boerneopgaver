/**
 * Daily emoji mood variation registry.
 *
 * Each chore category maps to a curated pool of thematically related icon keys
 * from iconRegistry.js.  The icon chosen for a given chore varies each calendar
 * day but is deterministic within the day: the same chore always shows the same
 * icon on the same day — but wakes up with a fresh look the next morning.
 *
 * Seed formula: choreId + "::" + "YYYY-M-D"
 */

/** Curated icon pools per chore category. All keys must exist in iconRegistry.js. */
const CATEGORY_MOOD_POOLS = Object.freeze({
  sleep:   ['sleep', 'star', 'moon', 'sparkle', 'magic'],
  dental:  ['dental', 'magic', 'diamond', 'sparkle', 'star'],
  pet:     ['pet', 'heart', 'star', 'rainbow', 'balloon'],
  clean:   ['clean', 'magic', 'sparkle', 'rainbow', 'star'],
  clothes: ['clothes', 'star', 'heart', 'flower', 'rainbow'],
  school:  ['school', 'idea', 'star', 'rocket', 'magic'],
  bath:    ['bath', 'magic', 'rainbow', 'flower', 'sparkle'],
  food:    ['food', 'star', 'heart', 'medal', 'coin'],
});

/** Fallback pool used when no category key matches. */
const FALLBACK_POOL = Object.freeze([
  'star', 'target', 'rocket', 'puzzle', 'balloon',
  'rainbow', 'trophy', 'music', 'paint', 'build',
  'idea', 'magic', 'medal', 'sparkle', 'fire',
]);

function getTodayString() {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
}

function seededIndex(seed, length) {
  let hash = 0;
  for (const char of seed) {
    hash = (hash << 5) - hash + char.charCodeAt(0);
    hash |= 0; // keep it 32-bit
  }
  return Math.abs(hash) % length;
}

/**
 * Return a daily-varying icon key from the curated pool for the given chore
 * category.  The result is stable for the whole calendar day.
 *
 * @param {string} categoryKey  – one of the keys in CATEGORY_MOOD_POOLS, or 'fallback'
 * @param {string} choreId      – stable unique ID of the chore
 * @returns {string}            – icon key
 */
export function getDailyMoodIcon(categoryKey, choreId) {
  const pool = CATEGORY_MOOD_POOLS[categoryKey] ?? FALLBACK_POOL;
  const seed = `${choreId}::${getTodayString()}`;
  return pool[seededIndex(seed, pool.length)];
}

/**
 * Return the daily mood icon for a raw chore name, using the same keyword
 * matching as choreMarker.js but applying the daily seed on top.
 *
 * @param {string} categoryKey  – resolved category key (may be undefined for fallback)
 * @param {string} choreName    – normalised chore name (used as seed when no ID)
 * @param {string} [choreId]    – optional stable chore ID; falls back to choreName
 * @returns {string}            – icon key
 */
export function getDailyMoodIconForChore(categoryKey, choreName, choreId) {
  const id = choreId ?? choreName;
  return getDailyMoodIcon(categoryKey ?? 'fallback', id);
}
