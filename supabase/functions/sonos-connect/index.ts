// @ts-nocheck
import { jsonResponse, optionsResponse } from '../_shared/cors.ts';
import { resolveAuthenticatedUser } from '../_shared/supabase.ts';
import { buildSonosAuthorizeUrl } from '../_shared/sonos.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return optionsResponse();
  }

  const user = await resolveAuthenticatedUser(request);
  if (!user) {
    return jsonResponse({ connected: false, message: 'Authentication required.' }, { status: 401 });
  }

  try {
    const connectUrl = await buildSonosAuthorizeUrl(user.id);
    return jsonResponse({ connected: false, connectUrl, message: 'Sonos authorization URL generated.' });
  } catch (error) {
    return jsonResponse(
      { connected: false, message: error instanceof Error ? error.message : 'Could not create Sonos connect URL.' },
      { status: 500 }
    );
  }
});
