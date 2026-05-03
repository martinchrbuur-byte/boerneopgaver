// @ts-nocheck
import { jsonResponse, optionsResponse } from '../_shared/cors.ts';
import { createSupabaseServiceClient, resolveAuthenticatedUser } from '../_shared/supabase.ts';
import { resolveSonosAccessToken, sonosControlRequest } from '../_shared/sonos.ts';

function normalizeGroup(group: Record<string, unknown>, householdId: string) {
  const id = typeof group?.id === 'string' ? group.id : '';
  const name = typeof group?.name === 'string' && group.name.trim().length > 0
    ? group.name
    : 'Sonos-rum';

  return {
    id,
    groupId: id,
    householdId,
    name,
    type: 'Speaker'
  };
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
  const { accessToken, reconnectUrl } = await resolveSonosAccessToken(user.id, supabase);

  if (!accessToken) {
    return jsonResponse({
      connected: false,
      message: 'Sonos-sessionen er udløbet. Forbind Sonos igen.',
      connectUrl: reconnectUrl || ''
    }, { status: 401 });
  }

  try {
    const householdsResp = await sonosControlRequest('/households', { accessToken });
    const householdsPayload = await householdsResp.json().catch(() => ({}));

    if (!householdsResp.ok) {
      return jsonResponse({
        connected: false,
        message: 'Kunne ikke hente Sonos-husholdninger lige nu.',
        connectUrl: reconnectUrl || ''
      }, { status: householdsResp.status });
    }

    const households = Array.isArray(householdsPayload?.households)
      ? householdsPayload.households
      : Array.isArray(householdsPayload)
        ? householdsPayload
        : [];

    const devices = [];

    for (const household of households) {
      const householdId = typeof household?.id === 'string'
        ? household.id
        : typeof household?.householdId === 'string'
          ? household.householdId
          : '';
      if (!householdId) {
        continue;
      }

      const groupsResp = await sonosControlRequest(`/households/${householdId}/groups`, { accessToken });
      const groupsPayload = await groupsResp.json().catch(() => ({}));
      if (!groupsResp.ok) {
        continue;
      }

      const groups = Array.isArray(groupsPayload?.groups) ? groupsPayload.groups : [];
      for (const group of groups) {
        const normalized = normalizeGroup(group, householdId);
        if (normalized.id) {
          devices.push(normalized);
        }
      }
    }

    return jsonResponse({
      connected: true,
      devices,
      message: devices.length > 0
        ? 'Sonos-enheder fundet.'
        : 'Ingen Sonos-grupper fundet. Kontroller at højttalerne er online.'
    });
  } catch (error) {
    return jsonResponse({
      connected: false,
      message: error instanceof Error ? error.message : 'Ukendt Sonos-fejl.',
      connectUrl: reconnectUrl || ''
    }, { status: 500 });
  }
});
