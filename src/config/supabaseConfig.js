// Supabase configuration
// For local testing, replace __SUPABASE_PUBLISHABLE_KEY__ with your publishable key.
// For GitHub Pages, the deploy workflow injects the key automatically.

const SUPABASE_PUBLISHABLE_KEY_PLACEHOLDER = '__SUPABASE_PUBLISHABLE_KEY__';

export const SUPABASE_CONFIG = {
  url: 'https://mfydufcizonxjmgyrwkj.supabase.co',
  publishableKey: SUPABASE_PUBLISHABLE_KEY_PLACEHOLDER
};

export function isSupabaseConfigured() {
  return (
    typeof SUPABASE_CONFIG.publishableKey === 'string' &&
    SUPABASE_CONFIG.publishableKey.length > 0 &&
    SUPABASE_CONFIG.publishableKey !== SUPABASE_PUBLISHABLE_KEY_PLACEHOLDER
  );
}
