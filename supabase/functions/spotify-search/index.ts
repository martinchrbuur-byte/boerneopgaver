// @ts-nocheck
import { jsonResponse, optionsResponse } from '../_shared/cors.ts';
import { createSupabaseServiceClient, resolveAuthenticatedUser } from '../_shared/supabase.ts';
import {
  buildSpotifyAuthorizeUrl,
  computeExpiresAtIso,
  refreshSpotifyToken,
  searchSpotifyCatalog
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

async function resolveAccessToken(userId: string, supabase: ReturnType<typeof createSupabaseServiceClient>) {
  const { data: connection, error } = await supabase
    .from('spotify_connections')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !connection) {
    return { accessToken: '', reconnectUrl: await buildSpotifyAuthorizeUrl(userId) };
  }

  let { access_token: accessToken, refresh_token: refreshToken, expires_at: expiresAt } = connection;

  if (!accessToken || !refreshToken) {
    return { accessToken: '', reconnectUrl: await buildSpotifyAuthorizeUrl(userId) };
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
        .eq('user_id', userId);
    } catch {
      return { accessToken: '', reconnectUrl: await buildSpotifyAuthorizeUrl(userId) };
    }
  }

  return { accessToken, reconnectUrl: await buildSpotifyAuthorizeUrl(userId) };
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
    const { accessToken, reconnectUrl } = await resolveAccessToken(user.id, supabase);

    if (!accessToken) {
      return jsonResponse({
        connected: false,
        message: 'Spotify-sessionen er udløbet. Forbind Spotify igen.',
        connectUrl: reconnectUrl
      }, { status: 401 });
    }

    const requestUrl = new URL(request.url);
    const query = String(requestUrl.searchParams.get('q') || '').trim();

    if (!query) {
      return jsonResponse({
        connected: true,
        message: 'Skriv en søgning for at finde musik og playlister.',
        items: [],
        connectUrl: reconnectUrl
      });
    }

    const items = await searchSpotifyCatalog(accessToken, query, { limit: 20 });
    const message = items.length > 0
      ? `${items.length} resultater for “${query}”.`
      : `Ingen resultater for “${query}”.`;

    return jsonResponse({
      connected: true,
      message,
      items,
      connectUrl: reconnectUrl
    });
  } catch (error) {
    return jsonResponse({
      connected: false,
      message: error instanceof Error ? error.message : 'Could not search Spotify catalog.'
    }, { status: 500 });
  }
});
