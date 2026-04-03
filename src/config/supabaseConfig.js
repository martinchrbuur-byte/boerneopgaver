// Supabase configuration - supports window.SUPABASE_PUBLISHABLE_KEY, localStorage, and runtime config
const PLACEHOLDER = '__SUPABASE_PUBLISHABLE_KEY__';
const STORAGE_KEY = 'SUPABASE_PUBLISHABLE_KEY';
const STORAGE_KEY_ALIASES = Object.freeze([
  STORAGE_KEY,
  'SUPABASE_ANON_KEY',
  'supabase.publishableKey',
  'supabase.anonKey'
]);

export const SUPABASE_CONFIG = {
  url: 'https://mfydufcizonxjmgyrwkj.supabase.co',
  publishableKey: PLACEHOLDER
};

function norm(v) { return typeof v === 'string' ? v.trim() : ''; }

function readRuntimeConfigValue(config) {
  return (
    norm(config?.supabasePublishableKey) ||
    norm(config?.supabaseAnonKey) ||
    norm(config?.SUPABASE_PUBLISHABLE_KEY) ||
    norm(config?.SUPABASE_ANON_KEY) ||
    norm(config?.supabase?.publishableKey) ||
    norm(config?.supabase?.anonKey)
  );
}

function readStorageValue() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return '';
  }

  for (const keyName of STORAGE_KEY_ALIASES) {
    const value = norm(window.localStorage?.getItem?.(keyName));
    if (value) {
      return value;
    }
  }

  return '';
}

export function getPublishableKey() {
  const key =
    norm(typeof window !== 'undefined' ? window.SUPABASE_PUBLISHABLE_KEY : '') ||
    norm(typeof window !== 'undefined' ? window.SUPABASE_ANON_KEY : '') ||
    readRuntimeConfigValue(globalThis.__APP_CONFIG__) ||
    readStorageValue() ||
    norm(SUPABASE_CONFIG.publishableKey);

  if (key && key !== PLACEHOLDER && typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY, key);
    } catch {}
  }
  return key;
}

export function isSupabaseConfigured() {
  const key = getPublishableKey();
  return key && key.length > 0 && key !== PLACEHOLDER;
}
