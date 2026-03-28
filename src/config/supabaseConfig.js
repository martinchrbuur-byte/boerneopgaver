// Supabase configuration
// Get your API key from: https://app.supabase.com/project/mfydufcizonxjmgyrwkj/settings/api

export const SUPABASE_CONFIG = {
  url: 'https://mfydufcizonxjmgyrwkj.supabase.co',
  anonKey: process.env.SUPABASE_ANON_KEY || ''
};

export function isSupabaseConfigured() {
  return SUPABASE_CONFIG.anonKey.length > 0;
}
