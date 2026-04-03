// Supabase configuration
// For local testing, set window.SUPABASE_PUBLISHABLE_KEY in index.html or store it in localStorage.
// For GitHub Pages, the deploy workflow injects the key automatically.

const SUPABASE_PUBLISHABLE_KEY_PLACEHOLDER = '__SUPABASE_PUBLISHABLE_KEY__';
const SUPABASE_KEY_STORAGE_KEY = 'SUPABASE_PUBLISHABLE_KEY';

export const SUPABASE_CONFIG = {
  url: 'https://mfydufcizonxjmgyrwkj.supabase.co',
  publishableKey: SUPABASE_PUBLISHABLE_KEY_PLACEHOLDER
};

function normalizeKey(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function getRuntimeConfigPublishableKey() {
  const appConfig = typeof globalThis !== 'undefined' ? globalThis.__APP_CONFIG__ : null;
  return normalizeKey(appConfig?.supabasePublishableKey);
}

function getWindowPublishableKey() {
  return typeof window !== 'undefined' ? normalizeKey(window.SUPABASE_PUBLISHABLE_KEY) : '';
}

function getStoredPublishableKey() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return '';
  }

  try {
    return normalizeKey(window.localStorage.getItem(SUPABASE_KEY_STORAGE_KEY));
  } catch {
    return '';
  }
}

function persistPublishableKeyIfNeeded(key) {
  if (!key || key === SUPABASE_PUBLISHABLE_KEY_PLACEHOLDER) {
    return;
  }

  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    const existing = normalizeKey(window.localStorage.getItem(SUPABASE_KEY_STORAGE_KEY));
    if (existing !== key) {
      window.localStorage.setItem(SUPABASE_KEY_STORAGE_KEY, key);
    }
  } catch {
    // Ignore storage access errors (private mode / blocked storage)
  }
}

export function getPublishableKey() {
  const key =
    getWindowPublishableKey() ||
    getRuntimeConfigPublishableKey() ||
    getStoredPublishableKey() ||
    normalizeKey(SUPABASE_CONFIG.publishableKey);

  persistPublishableKeyIfNeeded(key);
  return key;
}

export function isSupabaseConfigured() {
  const key = getPublishableKey();
  return (
    typeof key === 'string' &&
    key.length > 0 &&
    key !== SUPABASE_PUBLISHABLE_KEY_PLACEHOLDER
  );
}
