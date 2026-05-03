// @ts-nocheck
import { parseSonosState, exchangeSonosCodeForToken, computeSonosExpiresAtIso } from '../_shared/sonos.ts';
import { createSupabaseServiceClient } from '../_shared/supabase.ts';
import { requireEnv } from '../_shared/env.ts';

function redirectToApp(params: Record<string, string>) {
  const appUrl = Deno.env.get('SONOS_POST_AUTH_REDIRECT_URL')?.trim()
    || Deno.env.get('APP_BASE_URL')?.trim()
    || '/';
  const redirectUrl = new URL(appUrl);
  for (const [key, value] of Object.entries(params)) {
    redirectUrl.searchParams.set(key, value);
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: redirectUrl.toString()
    }
  });
}

Deno.serve(async (request) => {
  const url = new URL(request.url);
  const code = url.searchParams.get('code') || '';
  const state = url.searchParams.get('state') || '';
  const error = url.searchParams.get('error') || '';

  if (error) {
    return redirectToApp({ sonos: 'error', reason: error });
  }

  if (!code || !state) {
    return redirectToApp({ sonos: 'error', reason: 'missing_code_or_state' });
  }

  try {
    requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    const statePayload = await parseSonosState(state);
    const tokenPayload = await exchangeSonosCodeForToken(code);

    const supabase = createSupabaseServiceClient();
    const nextConnection = {
      user_id: statePayload.u,
      access_token: tokenPayload.access_token,
      refresh_token: tokenPayload.refresh_token || null,
      scope: tokenPayload.scope || null,
      token_type: tokenPayload.token_type || null,
      expires_at: computeSonosExpiresAtIso(tokenPayload.expires_in),
      updated_at: new Date().toISOString()
    };

    const { data: updatedRows, error: updateError } = await supabase
      .from('sonos_connections')
      .update(nextConnection)
      .eq('user_id', statePayload.u)
      .select('user_id');

    if (updateError) {
      throw updateError;
    }

    if (!Array.isArray(updatedRows) || updatedRows.length === 0) {
      const { error: insertError } = await supabase
        .from('sonos_connections')
        .insert(nextConnection);

      if (insertError) {
        throw insertError;
      }
    }

    return redirectToApp({ sonos: 'connected' });
  } catch (caughtError) {
    const reason = caughtError instanceof Error ? caughtError.message : 'unknown';
    return redirectToApp({ sonos: 'error', reason });
  }
});
