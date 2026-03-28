// Supabase configuration
// For local testing, replace __SUPABASE_ANON_KEY__ with your anon key.
// For GitHub Pages, the deploy workflow injects the secret automatically.

const SUPABASE_ANON_KEY_PLACEHOLDER = '__SUPABASE_ANON_KEY__';

export const SUPABASE_CONFIG = {
  url: 'https://mfydufcizonxjmgyrwkj.supabase.co',
  anonKey: SUPABASE_ANON_KEY_PLACEHOLDER
};

export function isSupabaseConfigured() {
  return (
    typeof SUPABASE_CONFIG.anonKey === 'string' &&
    SUPABASE_CONFIG.anonKey.length > 0 &&
    SUPABASE_CONFIG.anonKey !== SUPABASE_ANON_KEY_PLACEHOLDER
  );
}
