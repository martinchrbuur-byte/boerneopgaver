import { getPublishableKey } from '../config/supabaseConfig.js';

function sanitizeUrl(value) {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('__')) {
    return '';
  }

  return trimmed;
}

function normalizeItem(item) {
  return {
    id: typeof item?.id === 'string' ? item.id : '',
    title: typeof item?.title === 'string' ? item.title : 'Ukendt titel',
    subtitle: typeof item?.subtitle === 'string' ? item.subtitle : 'Spotify',
    href: sanitizeUrl(item?.href),
    uri: typeof item?.uri === 'string' ? item.uri : '',
    kind: typeof item?.kind === 'string' ? item.kind : 'playlist',
    canPlay: item?.canPlay !== false
  };
}

function isLikedSongsItem(item) {
  if (!item || typeof item !== 'object') {
    return false;
  }

  const title = typeof item.title === 'string' ? item.title.trim().toLowerCase() : '';
  const uri = typeof item.uri === 'string' ? item.uri.trim().toLowerCase() : '';
  const href = typeof item.href === 'string' ? item.href.trim().toLowerCase() : '';

  if (uri === 'spotify:collection' || uri === 'spotify:collection:tracks') {
    return true;
  }

  if (href.includes('/collection/tracks')) {
    return true;
  }

  return title === 'liked songs' || title === 'sange, du synes om';
}

function prioritizeLikedSongs(items = []) {
  const likedSongsFallback = {
    id: 'spotify-liked-songs',
    title: 'Sange, du synes om',
    subtitle: 'Din Spotify-samling',
    href: 'https://open.spotify.com/collection/tracks',
    uri: 'spotify:collection:tracks',
    kind: 'playlist',
    canPlay: true
  };

  if (!Array.isArray(items) || items.length === 0) {
    return [likedSongsFallback];
  }

  const likedSongs = [];
  const remaining = [];

  for (const item of items) {
    if (isLikedSongsItem(item)) {
      likedSongs.push(item);
    } else {
      remaining.push(item);
    }
  }

  const primaryLikedSongs = likedSongs[0] || likedSongsFallback;
  return [primaryLikedSongs, ...remaining];
}

let sdkLoadPromise = null;

function loadSpotifySdk() {
  if (sdkLoadPromise) {
    return sdkLoadPromise;
  }

  sdkLoadPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('No window context.'));
      return;
    }

    if (window.Spotify) {
      resolve();
      return;
    }

    const existingCallback = window.onSpotifyWebPlaybackSDKReady;
    window.onSpotifyWebPlaybackSDKReady = () => {
      if (typeof existingCallback === 'function') {
        existingCallback();
      }
      resolve();
    };

    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.onerror = () => {
      sdkLoadPromise = null;
      reject(new Error('Failed to load Spotify Web Playback SDK.'));
    };
    document.head.appendChild(script);
  });

  return sdkLoadPromise;
}

export function createSpotifyService({
  spotifyConfig = {},
  fetchImpl = globalThis.fetch,
  navigatorRef = globalThis.navigator,
  getAccessToken = () => ''
} = {}) {
  const enabled = spotifyConfig?.enabled !== false;
  const connectUrl = sanitizeUrl(spotifyConfig?.connectUrl);
  const recommendationsEndpoint = sanitizeUrl(spotifyConfig?.recommendationsEndpoint);
  const searchEndpoint = sanitizeUrl(spotifyConfig?.searchEndpoint);
  const tokenEndpoint = sanitizeUrl(spotifyConfig?.tokenEndpoint);
  const playbackEndpoint = sanitizeUrl(spotifyConfig?.playbackEndpoint);
  const disconnectEndpoint = sanitizeUrl(spotifyConfig?.disconnectEndpoint);

  let tileState = {
    status: enabled ? (connectUrl ? 'needs-auth' : 'unavailable') : 'unavailable',
    message: enabled
      ? (connectUrl ? 'Forbind Spotify for at hente anbefalinger.' : 'Spotify er ikke sat op endnu.')
      : 'Spotify er slået fra.',
    connectUrl,
    items: [],
    search: {
      query: '',
      status: 'idle',
      message: 'Søg for at finde musik og playlister.',
      items: []
    },
    playerReady: false,
    isPlaying: false,
    currentTrack: null,
    deviceId: ''
  };

  // SDK player state
  let player = null;
  let deviceId = '';
  let cachedToken = null; // { token, expiresAt (ms) }
  let playerInitPromise = null;
  let onStateChange = null;

  function isOnline() {
    if (!navigatorRef || typeof navigatorRef.onLine !== 'boolean') {
      return true;
    }
    return navigatorRef.onLine;
  }

  function getTileState() {
    if (!isOnline()) {
      return {
        ...tileState,
        status: 'offline',
        message: 'Du er offline. Spotify-anbefalinger kan ikke opdateres lige nu.'
      };
    }
    return { ...tileState };
  }

  function buildSupabaseHeaders() {
    const headers = {
      Accept: 'application/json'
    };

    const accessToken = typeof getAccessToken === 'function'
      ? String(getAccessToken() || '')
      : '';
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const publishableKey = String(getPublishableKey() || '').trim();
    if (publishableKey) {
      headers.apikey = publishableKey;
    }

    return headers;
  }

  async function fetchSpotifyToken() {
    if (!tokenEndpoint) {
      throw new Error('Token endpoint ikke konfigureret.');
    }

    const response = await fetchImpl(tokenEndpoint, {
      method: 'GET',
      headers: buildSupabaseHeaders(),
      credentials: 'omit'
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok || !payload?.access_token) {
      const message = typeof payload?.message === 'string' ? payload.message : 'Kunne ikke hente Spotify-token.';
      throw new Error(message);
    }

    const expiresIn = typeof payload.expires_in === 'number' ? payload.expires_in : 3600;
    cachedToken = {
      token: payload.access_token,
      expiresAt: Date.now() + (expiresIn - 60) * 1000
    };

    return cachedToken.token;
  }

  async function getSpotifyToken() {
    if (cachedToken && cachedToken.expiresAt > Date.now()) {
      return cachedToken.token;
    }
    return fetchSpotifyToken();
  }

  function updatePlayerState(sdkState) {
    if (!sdkState) {
      tileState = { ...tileState, isPlaying: false, currentTrack: null };
      return;
    }

    const track = sdkState.track_window?.current_track || null;
    const currentTrack = track
      ? {
          name: track.name || '',
          artist: Array.isArray(track.artists) ? track.artists.map(a => a.name).join(', ') : '',
          imageUrl: Array.isArray(track.album?.images) && track.album.images.length > 0
            ? track.album.images[0].url
            : ''
        }
      : null;

    tileState = { ...tileState, isPlaying: !sdkState.paused, currentTrack };

    if (typeof onStateChange === 'function') {
      onStateChange();
    }
  }

  async function initPlayer() {
    if (!enabled || !tokenEndpoint) {
      return;
    }

    if (playerInitPromise) {
      return playerInitPromise;
    }

    playerInitPromise = (async () => {
      try {
        await loadSpotifySdk();

        if (!window.Spotify) {
          throw new Error('Spotify SDK ikke tilgængeligt.');
        }

        player = new window.Spotify.Player({
          name: 'Opgavehelte',
          getOAuthToken: async (cb) => {
            try {
              const token = await getSpotifyToken();
              cb(token);
            } catch {
              cb('');
            }
          },
          volume: 0.7
        });

        player.addListener('ready', ({ device_id }) => {
          deviceId = device_id;
          tileState = { ...tileState, playerReady: true, deviceId };
          if (typeof onStateChange === 'function') {
            onStateChange();
          }
        });

        player.addListener('not_ready', () => {
          deviceId = '';
          tileState = { ...tileState, playerReady: false, deviceId: '', isPlaying: false };
          if (typeof onStateChange === 'function') {
            onStateChange();
          }
        });

        player.addListener('player_state_changed', (state) => {
          updatePlayerState(state);
        });

        player.addListener('initialization_error', ({ message }) => {
          console.warn('Spotify init error:', message);
          playerInitPromise = null;
          tileState = { ...tileState, playerReady: false };
        });

        player.addListener('authentication_error', ({ message }) => {
          console.warn('Spotify auth error:', message);
          cachedToken = null;
          tileState = { ...tileState, playerReady: false };
        });

        player.addListener('account_error', ({ message }) => {
          console.warn('Spotify account error (Premium required):', message);
          tileState = {
            ...tileState,
            playerReady: false,
            message: 'Spotify Premium kræves for afspilning i browseren.'
          };
          if (typeof onStateChange === 'function') {
            onStateChange();
          }
        });

        await player.connect();
      } catch (error) {
        console.warn('Spotify player init failed:', error);
        playerInitPromise = null;
      }
    })();

    return playerInitPromise;
  }

  function setOnStateChange(callback) {
    onStateChange = callback;
  }

  async function sendPlaybackCommand(action, extra = {}) {
    if (!playbackEndpoint) {
      console.warn('Playback endpoint not configured.');
      return;
    }

    try {
      const response = await fetchImpl(playbackEndpoint, {
        method: 'POST',
        headers: { ...buildSupabaseHeaders(), 'Content-Type': 'application/json' },
        credentials: 'omit',
        body: JSON.stringify({ action, deviceId, ...extra })
      });

      const payload = await response.json().catch(() => ({}));

      if (payload?.needsReconnect) {
        // stored token lacks playback scopes – prompt reconnect
        tileState = {
          ...tileState,
          status: 'needs-auth',
          message: payload.message || 'Forbind Spotify igen for at aktivere afspilning.',
          connectUrl: sanitizeUrl(payload.reconnectUrl) || connectUrl
        };
        if (typeof onStateChange === 'function') {
          onStateChange();
        }
      }
    } catch (error) {
      console.warn(`Spotify ${action} failed:`, error);
    }
  }

  async function play(uri) {
    const safeUri = typeof uri === 'string' ? uri.trim() : '';
    if (!safeUri) {
      await sendPlaybackCommand('play');
      return;
    }

    if (safeUri.startsWith('spotify:track:')) {
      await sendPlaybackCommand('play', { trackUri: safeUri });
      return;
    }

    await sendPlaybackCommand('play', { contextUri: safeUri });
  }

  async function togglePlay() {
    if (!player) {
      return;
    }

    try {
      // Get current state from SDK to know if playing or paused
      const state = await player.getCurrentState();
      if (!state) {
        return;
      }
      if (state.paused) {
        await sendPlaybackCommand('play');
      } else {
        await sendPlaybackCommand('pause');
      }
    } catch (error) {
      console.warn('Spotify togglePlay failed:', error);
    }
  }

  async function next() {
    await sendPlaybackCommand('next');
  }

  async function previous() {
    await sendPlaybackCommand('previous');
  }

  function dispose() {
    if (player) {
      player.disconnect();
      player = null;
    }
    playerInitPromise = null;
    onStateChange = null;
  }

  async function disconnect() {
    // Stop and clean up SDK player
    dispose();
    cachedToken = null;
    deviceId = '';

    if (disconnectEndpoint) {
      try {
        await fetchImpl(disconnectEndpoint, {
          method: 'POST',
          headers: buildSupabaseHeaders(),
          credentials: 'omit'
        });
      } catch {
        // best-effort
      }
    }

    tileState = {
      status: connectUrl ? 'needs-auth' : 'unavailable',
      message: 'Forbind Spotify for at hente anbefalinger.',
      connectUrl,
      items: [],
      search: {
        query: '',
        status: 'idle',
        message: 'Søg for at finde musik og playlister.',
        items: []
      },
      playerReady: false,
      isPlaying: false,
      currentTrack: null,
      deviceId: ''
    };
  }

  async function beginAuthorization() {
    if (!enabled) {
      tileState = { ...tileState, status: 'unavailable', message: 'Spotify er slået fra.' };
      return { ok: false, message: tileState.message, authorizationUrl: '' };
    }

    if (!isOnline()) {
      return { ok: false, message: 'Du er offline. Prøv igen når forbindelsen er tilbage.', authorizationUrl: '' };
    }

    if (!connectUrl) {
      tileState = {
        ...tileState,
        status: 'unavailable',
        message: 'Spotify connect-endpoint mangler i app-konfigurationen.'
      };
      return { ok: false, message: tileState.message, authorizationUrl: '' };
    }

    tileState = { ...tileState, status: 'loading', message: 'Forbereder Spotify-login...' };

    try {
      const response = await fetchImpl(connectUrl, {
        method: 'GET',
        headers: buildSupabaseHeaders(),
        credentials: 'omit'
      });

      const payload = await response.json().catch(() => ({}));
      const authorizationUrl = sanitizeUrl(payload?.connectUrl);

      if (!response.ok || !authorizationUrl) {
        tileState = {
          status: 'needs-auth',
          message: typeof payload?.message === 'string' && payload.message.trim().length > 0
            ? payload.message
            : 'Forbind Spotify for at hente anbefalinger.',
          connectUrl,
          items: [],
          playerReady: false,
          isPlaying: false,
          currentTrack: null,
          deviceId: ''
        };
        return { ok: false, message: tileState.message, authorizationUrl: '' };
      }

      tileState = { ...tileState, status: 'needs-auth', message: 'Åbner Spotify-login...' };
      return { ok: true, message: tileState.message, authorizationUrl };
    } catch {
      tileState = { ...tileState, status: 'unavailable', message: 'Kunne ikke starte Spotify-login lige nu.' };
      return { ok: false, message: tileState.message, authorizationUrl: '' };
    }
  }

  async function refreshRecommendations() {
    if (!enabled) {
      tileState = { ...tileState, status: 'unavailable', message: 'Spotify er slået fra.', items: [] };
      return getTileState();
    }

    if (!isOnline()) {
      return getTileState();
    }

    if (!recommendationsEndpoint) {
      tileState = {
        ...tileState,
        status: connectUrl ? 'needs-auth' : 'unavailable',
        message: connectUrl
          ? 'Forbind Spotify for at hente anbefalinger.'
          : 'Spotify endpoint mangler i app-konfigurationen.',
        items: []
      };
      return getTileState();
    }

    tileState = { ...tileState, status: 'loading', message: 'Henter Spotify-anbefalinger...' };

    try {
      const response = await fetchImpl(recommendationsEndpoint, {
        method: 'GET',
        headers: buildSupabaseHeaders(),
        credentials: 'omit'
      });

      const payload = await response.json().catch(() => ({}));
      const responseConnectUrl = sanitizeUrl(payload?.connectUrl) || connectUrl;
      const connected = payload?.connected === true;

      if (response.status === 401 || !connected) {
        tileState = {
          ...tileState,
          status: 'needs-auth',
          message: typeof payload?.message === 'string' && payload.message.trim().length > 0
            ? payload.message
            : 'Forbind Spotify for at hente anbefalinger.',
          connectUrl: responseConnectUrl,
          items: []
        };
        return getTileState();
      }

      const items = Array.isArray(payload?.items)
        ? prioritizeLikedSongs(payload.items.map(normalizeItem)).slice(0, 6)
        : [];

      tileState = {
        ...tileState,
        status: 'ready',
        message: typeof payload?.message === 'string' && payload.message.trim().length > 0
          ? payload.message
          : 'Spotify-anbefalinger er opdateret.',
        connectUrl: responseConnectUrl,
        items
      };

      // Auto-initialize the player when connected
      if (tokenEndpoint && !player) {
        void initPlayer();
      }

      return getTileState();
    } catch {
      tileState = {
        ...tileState,
        status: 'unavailable',
        message: 'Kunne ikke hente Spotify-data lige nu.',
        items: []
      };
      return getTileState();
    }
  }

  async function searchCatalog(query) {
    const normalizedQuery = String(query || '').trim();

    if (!enabled) {
      tileState = {
        ...tileState,
        search: {
          query: normalizedQuery,
          status: 'error',
          message: 'Spotify er slået fra.',
          items: []
        }
      };
      return getTileState();
    }

    if (!isOnline()) {
      tileState = {
        ...tileState,
        search: {
          query: normalizedQuery,
          status: 'error',
          message: 'Du er offline. Søgning er midlertidigt utilgængelig.',
          items: []
        }
      };
      return getTileState();
    }

    if (!normalizedQuery) {
      tileState = {
        ...tileState,
        search: {
          query: '',
          status: 'idle',
          message: 'Søg for at finde musik og playlister.',
          items: []
        }
      };
      return getTileState();
    }

    if (!searchEndpoint) {
      tileState = {
        ...tileState,
        search: {
          query: normalizedQuery,
          status: 'error',
          message: 'Spotify søge-endpoint mangler i app-konfigurationen.',
          items: []
        }
      };
      return getTileState();
    }

    tileState = {
      ...tileState,
      search: {
        query: normalizedQuery,
        status: 'loading',
        message: `Søger efter “${normalizedQuery}”...`,
        items: []
      }
    };

    try {
      const endpointUrl = new URL(searchEndpoint);
      endpointUrl.searchParams.set('q', normalizedQuery);

      const response = await fetchImpl(endpointUrl.toString(), {
        method: 'GET',
        headers: buildSupabaseHeaders(),
        credentials: 'omit'
      });

      const payload = await response.json().catch(() => ({}));
      const responseConnectUrl = sanitizeUrl(payload?.connectUrl) || connectUrl;
      const connected = payload?.connected === true;

      if (response.status === 401 || !connected) {
        tileState = {
          ...tileState,
          status: 'needs-auth',
          message: typeof payload?.message === 'string' && payload.message.trim().length > 0
            ? payload.message
            : 'Forbind Spotify for at søge i musik og playlister.',
          connectUrl: responseConnectUrl,
          items: [],
          search: {
            query: normalizedQuery,
            status: 'error',
            message: 'Forbind Spotify for at bruge søgning.',
            items: []
          }
        };
        return getTileState();
      }

      const items = Array.isArray(payload?.items)
        ? payload.items.map(normalizeItem).slice(0, 20)
        : [];

      tileState = {
        ...tileState,
        status: 'ready',
        connectUrl: responseConnectUrl,
        search: {
          query: normalizedQuery,
          status: 'ready',
          message: typeof payload?.message === 'string' && payload.message.trim().length > 0
            ? payload.message
            : `${items.length} resultater fundet.`,
          items
        }
      };

      if (tokenEndpoint && !player) {
        void initPlayer();
      }

      return getTileState();
    } catch {
      tileState = {
        ...tileState,
        search: {
          query: normalizedQuery,
          status: 'error',
          message: 'Kunne ikke hente Spotify-søgeresultater lige nu.',
          items: []
        }
      };
      return getTileState();
    }
  }

  return {
    getTileState,
    refreshRecommendations,
    beginAuthorization,
    disconnect,
    initPlayer,
    play,
    togglePlay,
    next,
    previous,
    searchCatalog,
    setOnStateChange,
    dispose
  };
}
