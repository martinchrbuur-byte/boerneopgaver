// @ts-nocheck
import { jsonResponse, optionsResponse } from '../_shared/cors.ts';
import { createSupabaseServiceClient, resolveAuthenticatedUser } from '../_shared/supabase.ts';
import {
  buildSpotifyAuthorizeUrl,
  computeExpiresAtIso,
  fetchFeaturedPlaylists,
  refreshSpotifyToken
} from '../_shared/spotify.ts';

function isExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) {
    return true;
  }

  const expiresAtMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiresAtMs)) {
    return true;
  }

  return expiresAtMs <= (Date.now() + 30_000);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return optionsResponse();
  }

  const user = await resolveAuthenticatedUser(request);
  if (!user) {
    return jsonResponse({ connected: false, message: 'Authentication required.' }, { status: 401 });
  }

  try {
    const supabase = createSupabaseServiceClient();
    const { data: connection, error: loadError } = await supabase
      .from('spotify_connections')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', user.id)
      .maybeSingle();

    if (loadError) {
      throw loadError;
    }

    if (!connection) {
      return jsonResponse({
        connected: false,
        message: 'Forbind Spotify for at hente anbefalinger.',
        connectUrl: await buildSpotifyAuthorizeUrl(user.id)
      }, { status: 401 });
    }

    let accessToken = connection.access_token;
    let refreshToken = connection.refresh_token;
    let expiresAt = connection.expires_at;

    if (!accessToken || !refreshToken) {
      return jsonResponse({
        connected: false,
        message: 'Spotify-forbindelsen mangler token-data. Forbind igen.',
        connectUrl: await buildSpotifyAuthorizeUrl(user.id)
      }, { status: 401 });
    }

    if (isExpired(expiresAt)) {
      const refreshed = await refreshSpotifyToken(refreshToken);
      accessToken = refreshed.access_token;
      refreshToken = refreshed.refresh_token || refreshToken;
      expiresAt = computeExpiresAtIso(refreshed.expires_in);

      const { error: updateError } = await supabase
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

      if (updateError) {
        throw updateError;
      }
    }

    const items = await fetchFeaturedPlaylists(accessToken, { limit: 6, country: 'DK' });

    return jsonResponse({
      connected: true,
      message: 'Spotify-anbefalinger klar.',
      items,
      connectUrl: await buildSpotifyAuthorizeUrl(user.id)
    });
  } catch (error) {
    return jsonResponse({
      connected: false,
      message: error instanceof Error ? error.message : 'Could not load Spotify recommendations.'
    }, { status: 500 });
  }
});
