const DEFAULT_CONFIG = Object.freeze({
  persistenceProvider: 'localStorage',
  defaultRole: 'parent',
  persistRoleSelection: true,
  spotify: Object.freeze({
    enabled: true,
    connectUrl: 'https://mfydufcizonxjmgyrwkj.supabase.co/functions/v1/spotify-connect',
    recommendationsEndpoint: 'https://mfydufcizonxjmgyrwkj.supabase.co/functions/v1/spotify-recommendations',
    searchEndpoint: 'https://mfydufcizonxjmgyrwkj.supabase.co/functions/v1/spotify-search',
    tokenEndpoint: 'https://mfydufcizonxjmgyrwkj.supabase.co/functions/v1/spotify-token',
    playbackEndpoint: 'https://mfydufcizonxjmgyrwkj.supabase.co/functions/v1/spotify-playback',
    disconnectEndpoint: 'https://mfydufcizonxjmgyrwkj.supabase.co/functions/v1/spotify-disconnect'
  })
});

function normalizeSpotifyConfig(spotifyConfig) {
  const fallback = DEFAULT_CONFIG.spotify;
  if (!spotifyConfig || typeof spotifyConfig !== 'object') {
    return fallback;
  }

  const enabled = spotifyConfig.enabled !== false;
  const connectUrl = typeof spotifyConfig.connectUrl === 'string'
    ? spotifyConfig.connectUrl.trim()
    : fallback.connectUrl;
  const recommendationsEndpoint = typeof spotifyConfig.recommendationsEndpoint === 'string'
    ? spotifyConfig.recommendationsEndpoint.trim()
    : fallback.recommendationsEndpoint;
  const searchEndpoint = typeof spotifyConfig.searchEndpoint === 'string'
    ? spotifyConfig.searchEndpoint.trim()
    : fallback.searchEndpoint;
  const tokenEndpoint = typeof spotifyConfig.tokenEndpoint === 'string'
    ? spotifyConfig.tokenEndpoint.trim()
    : fallback.tokenEndpoint;
  const playbackEndpoint = typeof spotifyConfig.playbackEndpoint === 'string'
    ? spotifyConfig.playbackEndpoint.trim()
    : fallback.playbackEndpoint;
  const disconnectEndpoint = typeof spotifyConfig.disconnectEndpoint === 'string'
    ? spotifyConfig.disconnectEndpoint.trim()
    : fallback.disconnectEndpoint;

  return {
    enabled,
    connectUrl,
    recommendationsEndpoint,
    searchEndpoint,
    tokenEndpoint,
    playbackEndpoint,
    disconnectEndpoint
  };
}

export function resolveAppConfig(runtimeConfig = globalThis.__APP_CONFIG__) {
  if (!runtimeConfig || typeof runtimeConfig !== 'object') {
    return DEFAULT_CONFIG;
  }

  const provider = runtimeConfig.persistenceProvider;
  if (provider !== 'localStorage') {
    return DEFAULT_CONFIG;
  }

  const defaultRole = runtimeConfig.defaultRole === 'kid' ? 'kid' : 'parent';
  const persistRoleSelection = runtimeConfig.persistRoleSelection !== false;

  return {
    persistenceProvider: provider,
    defaultRole,
    persistRoleSelection,
    spotify: normalizeSpotifyConfig(runtimeConfig.spotify)
  };
}
