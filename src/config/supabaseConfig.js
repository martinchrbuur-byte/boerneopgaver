// Supabase configuration
// For local testing, replace __SUPABASE_PUBLISHABLE_KEY__ with your publishable key.
// For GitHub Pages, the deploy workflow injects the key automatically.

const SUPABASE_PUBLISHABLE_KEY_PLACEHOLDER = '__SUPABASE_PUBLISHABLE_KEY__';

export const SUPABASE_CONFIG = {
  url: 'https://mfydufcizonxjmgyrwkj.supabase.co',
  publishableKey: SUPABASE_PUBLISHABLE_KEY_PLACEHOLDER
};

export function getPublishableKey() {
  return (
    (typeof window !== 'undefined' && window.SUPABASE_PUBLISHABLE_KEY) ||
    SUPABASE_CONFIG.publishableKey
  );
}

export function isSupabaseConfigured() {
  const key = getPublishableKey();
  return (
    typeof key === 'string' &&
    key.length > 0 &&
    key !== SUPABASE_PUBLISHABLE_KEY_PLACEHOLDER
  );
}
