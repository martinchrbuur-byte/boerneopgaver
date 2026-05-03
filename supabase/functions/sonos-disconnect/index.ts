// @ts-nocheck
import { jsonResponse, optionsResponse } from '../_shared/cors.ts';
import { createSupabaseServiceClient, resolveAuthenticatedUser } from '../_shared/supabase.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return optionsResponse();
  }

  const user = await resolveAuthenticatedUser(request);
  if (!user) {
    return jsonResponse({ ok: false, message: 'Authentication required.' }, { status: 401 });
  }

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from('sonos_connections')
    .delete()
    .eq('user_id', user.id);

  if (error) {
    return jsonResponse({ ok: false, message: 'Kunne ikke afbryde Sonos-forbindelsen.' }, { status: 500 });
  }

  return jsonResponse({ ok: true, message: 'Sonos-forbindelsen er afbrudt.' });
});
