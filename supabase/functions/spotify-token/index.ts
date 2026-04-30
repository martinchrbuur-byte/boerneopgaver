// @ts-nocheck
import { jsonResponse, optionsResponse } from '../_shared/cors.ts';
import { createSupabaseServiceClient, resolveAuthenticatedUser } from '../_shared/supabase.ts';
import { buildSpotifyAuthorizeUrl, computeExpiresAtIso, refreshSpotifyToken } from '../_shared/spotify.ts';

function isExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return true;
  const ms = new Date(expiresAt).getTime();
  if (!Number.isFinite(ms)) return true;
  return ms <= (Date.now() + 30_000);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return optionsResponse();
  }

  const user = await resolveAuthenticatedUser(request);
  if (!user) {
    return jsonResponse({ connected: false, message: 'Authentication required.' }, { status: 401 });
  }

  const supabase = createSupabaseServiceClient();
  const { data: connection, error: loadError } = await supabase
    .from('spotify_connections')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (loadError) {
    return jsonResponse({ connected: false, message: 'Database error.' }, { status: 500 });
  }

  if (!connection) {
    return jsonResponse({
      connected: false,
      message: 'Forbind Spotify for at bruge afspilleren.',
      connectUrl: await buildSpotifyAuthorizeUrl(user.id)
    }, { status: 401 });
  }

  let { access_token: accessToken, refresh_token: refreshToken, expires_at: expiresAt } = connection;

  if (!accessToken || !refreshToken) {
    return jsonResponse({
      connected: false,
      message: 'Spotify-forbindelsen mangler token-data. Forbind igen.',
      connectUrl: await buildSpotifyAuthorizeUrl(user.id)
    }, { status: 401 });
  }

  if (isExpired(expiresAt)) {
    try {
      const refreshed = await refreshSpotifyToken(refreshToken);
      accessToken = refreshed.access_token;
      refreshToken = refreshed.refresh_token || refreshToken;
      expiresAt = computeExpiresAtIso(refreshed.expires_in);

      await supabase
        .from('spotify_connections')
        .update({
          access_token: accessToken,
          refresh_token: refreshToken,
          scope: refreshed.scope || null,
          token_type: refreshed.token_type || null,
          expires_at: expiresAt,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);
    } catch {
      return jsonResponse({
        connected: false,
        message: 'Spotify-sessionen er udløbet. Forbind Spotify igen.',
        connectUrl: await buildSpotifyAuthorizeUrl(user.id)
      }, { status: 401 });
    }
  }

  const expiresAtMs = new Date(expiresAt).getTime();
  const expiresIn = Number.isFinite(expiresAtMs) ? Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000)) : 3600;

  return jsonResponse({
    connected: true,
    access_token: accessToken,
    expires_in: expiresIn
  });
});
