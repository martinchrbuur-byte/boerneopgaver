// @ts-nocheck
import { jsonResponse, optionsResponse } from '../_shared/cors.ts';
import { resolveAuthenticatedUser } from '../_shared/supabase.ts';
import { buildSpotifyAuthorizeUrl } from '../_shared/spotify.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return optionsResponse();
  }

  const user = await resolveAuthenticatedUser(request);
  if (!user) {
    return jsonResponse({ connected: false, message: 'Authentication required.' }, { status: 401 });
  }

  try {
    const connectUrl = await buildSpotifyAuthorizeUrl(user.id);
    const requestUrl = new URL(request.url);
    if (requestUrl.searchParams.get('redirect') === '1') {
      return new Response(null, {
        status: 302,
        headers: {
          Location: connectUrl
        }
      });
    }

    return jsonResponse({ connected: false, connectUrl, message: 'Spotify authorization URL generated.' });
  } catch (error) {
    return jsonResponse(
      { connected: false, message: error instanceof Error ? error.message : 'Could not create Spotify connect URL.' },
      { status: 500 }
    );
  }
});
