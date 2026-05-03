// @ts-nocheck
import { jsonResponse, optionsResponse } from '../_shared/cors.ts';
import { createSupabaseServiceClient, resolveAuthenticatedUser } from '../_shared/supabase.ts';
import { resolveSonosAccessToken, sonosControlRequest } from '../_shared/sonos.ts';

function playbackPath(groupId: string, action: string): string {
  if (action === 'toggle') {
    return `/groups/${groupId}/playback/togglePlayPause`;
  }

  if (action === 'next') {
    return `/groups/${groupId}/playback/skipToNextTrack`;
  }

  if (action === 'previous') {
    return `/groups/${groupId}/playback/skipToPreviousTrack`;
  }

  if (action === 'play') {
    return `/groups/${groupId}/playback/play`;
  }

  if (action === 'pause') {
    return `/groups/${groupId}/playback/pause`;
  }

  return '';
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
  const { accessToken, reconnectUrl } = await resolveSonosAccessToken(user.id, supabase);

  if (!accessToken) {
    return jsonResponse({
      ok: false,
      message: 'Sonos-sessionen er udløbet. Forbind Sonos igen.',
      connectUrl: reconnectUrl || '',
      needsReconnect: true
    }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const groupId = typeof body.groupId === 'string' ? body.groupId : '';
  const action = typeof body.action === 'string' ? body.action : '';

  if (!groupId) {
    return jsonResponse({ ok: false, message: 'Mangler Sonos groupId.' }, { status: 400 });
  }

  const path = playbackPath(groupId, action);
  if (!path) {
    return jsonResponse({ ok: false, message: `Ukendt Sonos action: ${action}` }, { status: 400 });
  }

  try {
    const response = await sonosControlRequest(path, {
      accessToken,
      method: 'POST'
    });

    if (response.ok) {
      return jsonResponse({ ok: true });
    }

    const payload = await response.json().catch(() => ({}));
    const message = typeof payload?.errorCode === 'string'
      ? payload.errorCode
      : typeof payload?.message === 'string'
        ? payload.message
        : `Sonos API fejlede (${response.status}).`;

    if (response.status === 401 || response.status === 403) {
      return jsonResponse({
        ok: false,
        message: 'Sonos-tilladelser mangler. Forbind Sonos igen.',
        connectUrl: reconnectUrl || '',
        needsReconnect: true
      }, { status: response.status });
    }

    return jsonResponse({ ok: false, message }, { status: response.status });
  } catch (error) {
    return jsonResponse({
      ok: false,
      message: error instanceof Error ? error.message : 'Ukendt Sonos-fejl.'
    }, { status: 500 });
  }
});
