// Supabase configuration - supports window.SUPABASE_PUBLISHABLE_KEY, localStorage, and runtime config
const PLACEHOLDER = '__SUPABASE_PUBLISHABLE_KEY__';
const STORAGE_KEY = 'SUPABASE_PUBLISHABLE_KEY';

export const SUPABASE_CONFIG = {
  url: 'https://mfydufcizonxjmgyrwkj.supabase.co',
  publishableKey: PLACEHOLDER
};

function norm(v) { return typeof v === 'string' ? v.trim() : ''; }

export function getPublishableKey() {
  const key = 
    norm(typeof window !== 'undefined' ? window.SUPABASE_PUBLISHABLE_KEY : '') ||
    norm(globalThis.__APP_CONFIG__?.supabasePublishableKey) ||
    (typeof window !== 'undefined' ? norm(window.localStorage?.getItem?.(STORAGE_KEY)) : '') ||
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
