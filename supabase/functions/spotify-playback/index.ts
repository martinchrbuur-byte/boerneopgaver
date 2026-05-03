// @ts-nocheck
import { jsonResponse, optionsResponse } from '../_shared/cors.ts';
import { createSupabaseServiceClient, resolveAuthenticatedUser } from '../_shared/supabase.ts';
import { buildSpotifyAuthorizeUrl, computeExpiresAtIso, refreshSpotifyToken } from '../_shared/spotify.ts';

const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

function isExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return true;
  const ms = new Date(expiresAt).getTime();
  if (!Number.isFinite(ms)) return true;
  return ms <= (Date.now() + 30_000);
}

async function resolveAccessToken(userId: string, supabase: ReturnType<typeof createSupabaseServiceClient>): Promise<{ accessToken: string; reconnectUrl?: string }> {
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

  return { accessToken };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return optionsResponse();
  }

  const user = await resolveAuthenticatedUser(request);
  if (!user) {
    return jsonResponse({ ok: false, message: 'Authentication required.' }, { status: 401 });
  }

  const supabase = createSupabaseServiceClient();
  const { accessToken, reconnectUrl } = await resolveAccessToken(user.id, supabase);

  if (!accessToken) {
    return jsonResponse({
      ok: false,
      message: 'Spotify-sessionen er udløbet. Forbind Spotify igen.',
      reconnectUrl
    }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // no body is fine for some actions
  }

  const action = typeof body.action === 'string' ? body.action : '';
  const deviceId = typeof body.deviceId === 'string' ? body.deviceId : '';
  const contextUri = typeof body.contextUri === 'string' ? body.contextUri : '';
  const trackUri = typeof body.trackUri === 'string' ? body.trackUri : '';
  const transferPlay = body.play !== false;

  const spotifyHeaders = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };

  try {
    let spotifyResp: Response;

    if (action === 'devices') {
      spotifyResp = await fetch(`${SPOTIFY_API_BASE}/me/player/devices`, {
        method: 'GET',
        headers: spotifyHeaders
      });
    } else if (action === 'transfer') {
      spotifyResp = await fetch(`${SPOTIFY_API_BASE}/me/player`, {
        method: 'PUT',
        headers: spotifyHeaders,
        body: JSON.stringify({
          device_ids: deviceId ? [deviceId] : [],
          play: transferPlay
        })
      });
    } else if (action === 'play') {
      const url = new URL(`${SPOTIFY_API_BASE}/me/player/play`);
      if (deviceId) url.searchParams.set('device_id', deviceId);
      const playBody: Record<string, unknown> = {};
      if (trackUri) {
        playBody.uris = [trackUri];
      } else if (contextUri) {
        playBody.context_uri = contextUri;
      }
      spotifyResp = await fetch(url.toString(), {
        method: 'PUT',
        headers: spotifyHeaders,
        body: JSON.stringify(playBody)
      });
    } else if (action === 'pause') {
      const url = new URL(`${SPOTIFY_API_BASE}/me/player/pause`);
      if (deviceId) url.searchParams.set('device_id', deviceId);
      spotifyResp = await fetch(url.toString(), {
        method: 'PUT',
        headers: spotifyHeaders
      });
    } else if (action === 'next') {
      const url = new URL(`${SPOTIFY_API_BASE}/me/player/next`);
      if (deviceId) url.searchParams.set('device_id', deviceId);
      spotifyResp = await fetch(url.toString(), {
        method: 'POST',
        headers: spotifyHeaders
      });
    } else if (action === 'previous') {
      const url = new URL(`${SPOTIFY_API_BASE}/me/player/previous`);
      if (deviceId) url.searchParams.set('device_id', deviceId);
      spotifyResp = await fetch(url.toString(), {
        method: 'POST',
        headers: spotifyHeaders
      });
    } else {
      return jsonResponse({ ok: false, message: `Unknown action: ${action}` }, { status: 400 });
    }

    // Spotify returns 204 No Content for successful playback commands
    if (action === 'devices' && spotifyResp.ok) {
      const payload = await spotifyResp.json().catch(() => ({}));
      const devices = Array.isArray(payload?.devices)
        ? payload.devices.map((device: Record<string, unknown>) => ({
            id: typeof device?.id === 'string' ? device.id : '',
            name: typeof device?.name === 'string' ? device.name : 'Ukendt enhed',
            type: typeof device?.type === 'string' ? device.type : 'Unknown',
            isActive: device?.is_active === true,
            isRestricted: device?.is_restricted === true,
            volumePercent: typeof device?.volume_percent === 'number' ? device.volume_percent : null,
            supportsVolume: device?.supports_volume === true
          })).filter((device: Record<string, unknown>) => typeof device.id === 'string' && device.id.length > 0)
        : [];

      return jsonResponse({ ok: true, devices });
    }

    if (spotifyResp.status === 204 || spotifyResp.ok) {
      return jsonResponse({ ok: true });
    }

    const errPayload = await spotifyResp.json().catch(() => ({}));
    const errMsg = typeof errPayload?.error?.message === 'string'
      ? errPayload.error.message
      : `Spotify API fejlede (${spotifyResp.status}).`;

    // 403 typically means missing scope — user needs to reconnect
    if (spotifyResp.status === 403 || spotifyResp.status === 401) {
      return jsonResponse({
        ok: false,
        message: 'Spotify-tilladelser mangler. Forbind Spotify igen for at aktivere afspilning.',
        reconnectUrl: await buildSpotifyAuthorizeUrl(user.id),
        needsReconnect: true
      }, { status: 403 });
    }

    return jsonResponse({ ok: false, message: errMsg }, { status: spotifyResp.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ukendt fejl.';
    return jsonResponse({ ok: false, message }, { status: 500 });
  }
});
