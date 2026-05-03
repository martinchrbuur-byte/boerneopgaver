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
    disconnectEndpoint: 'https://mfydufcizonxjmgyrwkj.supabase.co/functions/v1/spotify-disconnect',
    sonosConnectEndpoint: 'https://mfydufcizonxjmgyrwkj.supabase.co/functions/v1/sonos-connect',
    sonosDevicesEndpoint: 'https://mfydufcizonxjmgyrwkj.supabase.co/functions/v1/sonos-devices',
    sonosPlaybackEndpoint: 'https://mfydufcizonxjmgyrwkj.supabase.co/functions/v1/sonos-playback',
    sonosDisconnectEndpoint: 'https://mfydufcizonxjmgyrwkj.supabase.co/functions/v1/sonos-disconnect'
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
  const sonosConnectEndpoint = typeof spotifyConfig.sonosConnectEndpoint === 'string'
    ? spotifyConfig.sonosConnectEndpoint.trim()
    : fallback.sonosConnectEndpoint;
  const sonosDevicesEndpoint = typeof spotifyConfig.sonosDevicesEndpoint === 'string'
    ? spotifyConfig.sonosDevicesEndpoint.trim()
    : fallback.sonosDevicesEndpoint;
  const sonosPlaybackEndpoint = typeof spotifyConfig.sonosPlaybackEndpoint === 'string'
    ? spotifyConfig.sonosPlaybackEndpoint.trim()
    : fallback.sonosPlaybackEndpoint;
  const sonosDisconnectEndpoint = typeof spotifyConfig.sonosDisconnectEndpoint === 'string'
    ? spotifyConfig.sonosDisconnectEndpoint.trim()
    : fallback.sonosDisconnectEndpoint;

  return {
    enabled,
    connectUrl,
    recommendationsEndpoint,
    searchEndpoint,
    tokenEndpoint,
    playbackEndpoint,
    disconnectEndpoint,
    sonosConnectEndpoint,
    sonosDevicesEndpoint,
    sonosPlaybackEndpoint,
    sonosDisconnectEndpoint
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
