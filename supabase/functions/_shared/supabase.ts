// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireEnv } from './env.ts';

export type AuthenticatedUser = {
  id: string;
  token: string;
};

export function createSupabaseAnonClient() {
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const supabaseAnonKey = requireEnv('SUPABASE_ANON_KEY');

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export function createSupabaseServiceClient() {
  const supabaseUrl = requireEnv('SUPABASE_URL');
  const supabaseServiceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export function readBearerToken(request: Request): string {
  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization') || '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return '';
  }

  return authHeader.slice(7).trim();
}

export async function resolveAuthenticatedUser(request: Request): Promise<AuthenticatedUser | null> {
  const token = readBearerToken(request);
  if (!token) {
    return null;
  }

  const client = createSupabaseAnonClient();
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user?.id) {
    return null;
  }

  return {
    id: data.user.id,
    token
  };
}
