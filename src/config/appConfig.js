const DEFAULT_CONFIG = Object.freeze({
  persistenceProvider: 'localStorage',
  defaultRole: 'parent',
  persistRoleSelection: true,
  spotify: Object.freeze({
    enabled: true,
    connectUrl: '__SPOTIFY_CONNECT_URL__',
    recommendationsEndpoint: '__SPOTIFY_RECOMMENDATIONS_ENDPOINT__'
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

  return {
    enabled,
    connectUrl,
    recommendationsEndpoint
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
