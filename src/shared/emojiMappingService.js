import { isKnownEmojiKey } from './emojiRegistry.js';

export const EMOJI_MAPPING_STORAGE_KEY = 'kids_chore_tracker_emoji_mappings_v1';
const STORAGE_VERSION = 1;
const MAX_MAPPINGS = 250;

function getStorage(storage) {
  if (storage) return storage;
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function normalizeMappingName(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function readMappings(storage) {
  const localStorage = getStorage(storage);
  if (!localStorage) return {};

  try {
    const raw = localStorage.getItem(EMOJI_MAPPING_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const mappings = parsed?.version === STORAGE_VERSION ? parsed.mappings : null;
    if (!mappings || typeof mappings !== 'object' || Array.isArray(mappings)) return {};

    return Object.fromEntries(
      Object.entries(mappings)
        .filter(([name, iconKey]) => normalizeMappingName(name) && isKnownEmojiKey(iconKey))
        .slice(-MAX_MAPPINGS)
    );
  } catch {
    return {};
  }
}

function writeMappings(mappings, storage) {
  const localStorage = getStorage(storage);
  if (!localStorage) return false;

  try {
    localStorage.setItem(EMOJI_MAPPING_STORAGE_KEY, JSON.stringify({
      version: STORAGE_VERSION,
      mappings,
    }));
    return true;
  } catch {
    return false;
  }
}

export function getStoredEmojiMapping(taskName, storage) {
  const name = normalizeMappingName(taskName);
  if (!name) return null;
  const iconKey = readMappings(storage)[name];
  return isKnownEmojiKey(iconKey) ? iconKey : null;
}

export function rememberEmojiMapping(taskName, iconKey, storage) {
  const name = normalizeMappingName(taskName);
  if (!name || !isKnownEmojiKey(iconKey)) return false;

  const mappings = readMappings(storage);
  mappings[name] = iconKey;
  const entries = Object.entries(mappings).slice(-MAX_MAPPINGS);
  return writeMappings(Object.fromEntries(entries), storage);
}

export function clearStoredEmojiMappings(storage) {
  const localStorage = getStorage(storage);
  if (!localStorage) return false;

  try {
    localStorage.removeItem(EMOJI_MAPPING_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
