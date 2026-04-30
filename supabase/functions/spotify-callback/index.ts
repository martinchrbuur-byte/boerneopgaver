// @ts-nocheck
import { parseSpotifyState, exchangeSpotifyCodeForToken, fetchSpotifyUser, computeExpiresAtIso } from '../_shared/spotify.ts';
import { createSupabaseServiceClient } from '../_shared/supabase.ts';
import { requireEnv } from '../_shared/env.ts';

function redirectToApp(params: Record<string, string>) {
  const appUrl = Deno.env.get('SPOTIFY_POST_AUTH_REDIRECT_URL')?.trim() || Deno.env.get('APP_BASE_URL')?.trim() || '/';
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
    return redirectToApp({ spotify: 'error', reason: error });
  }

  if (!code || !state) {
    return redirectToApp({ spotify: 'error', reason: 'missing_code_or_state' });
  }

  try {
    requireEnv('SUPABASE_SERVICE_ROLE_KEY');
    const statePayload = await parseSpotifyState(state);
    const tokenPayload = await exchangeSpotifyCodeForToken(code);
    const spotifyUser = await fetchSpotifyUser(tokenPayload.access_token);

    const supabase = createSupabaseServiceClient();
    const nextConnection = {
      user_id: statePayload.u,
      spotify_user_id: spotifyUser.id,
      access_token: tokenPayload.access_token,
      refresh_token: tokenPayload.refresh_token || null,
      scope: tokenPayload.scope || null,
      token_type: tokenPayload.token_type || null,
      expires_at: computeExpiresAtIso(tokenPayload.expires_in),
      updated_at: new Date().toISOString()
    };

    const { error: upsertError } = await supabase
      .from('spotify_connections')
      .upsert(nextConnection, { onConflict: 'user_id' });

    if (upsertError) {
      throw upsertError;
    }

    return redirectToApp({ spotify: 'connected' });
  } catch (caughtError) {
    const reason = caughtError instanceof Error ? caughtError.message : 'unknown';
    return redirectToApp({ spotify: 'error', reason });
  }
});
