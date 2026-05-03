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

function normalizeDevice(device) {
  return {
    id: typeof device?.id === 'string' ? device.id : '',
    name: typeof device?.name === 'string' ? device.name : 'Ukendt enhed',
    type: typeof device?.type === 'string' ? device.type : 'Unknown',
    isActive: device?.isActive === true,
    isRestricted: device?.isRestricted === true,
    volumePercent: typeof device?.volumePercent === 'number' ? device.volumePercent : null,
    supportsVolume: device?.supportsVolume === true
  };
}

function deviceSortValue(device) {
  const type = typeof device?.type === 'string' ? device.type.toLowerCase() : '';
  if (type === 'speaker') {
    return 0;
  }
  if (device?.isActive) {
    return 1;
  }
  if (type === 'tv') {
    return 2;
  }
  if (type === 'computer') {
    return 3;
  }
  if (type === 'smartphone') {
    return 4;
  }
  return 5;
}

function sortDevices(devices = []) {
  return [...devices].sort((left, right) => {
    const rank = deviceSortValue(left) - deviceSortValue(right);
    if (rank !== 0) {
      return rank;
    }

    if (left.isActive !== right.isActive) {
      return left.isActive ? -1 : 1;
    }

    return String(left.name || '').localeCompare(String(right.name || ''), 'da');
  });
}

function createInitialTileState(enabled, connectUrl) {
  return {
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
    canControlPlayback: false,
    isPlaying: false,
    currentTrack: null,
    deviceId: '',
    selectedDeviceId: '',
    selectedDeviceName: '',
    devices: [],
    deviceStatus: 'idle',
    deviceMessage: 'Vælg en højttaler eller anden Spotify Connect-enhed.',
    showingAllDevices: false
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

  let tileState = createInitialTileState(enabled, connectUrl);

  // SDK player state
  let player = null;
  let browserDeviceId = '';
  let cachedToken = null; // { token, expiresAt (ms) }
  let playerInitPromise = null;
  let onStateChange = null;

  function notifyStateChange() {
    if (typeof onStateChange === 'function') {
      onStateChange();
    }
  }

  function getSelectedPlaybackDeviceId() {
    return tileState.selectedDeviceId || browserDeviceId;
  }

  function getSelectedPlaybackDeviceName() {
    if (tileState.selectedDeviceId) {
      return tileState.selectedDeviceName || '';
    }

    const browserDevice = (tileState.devices || []).find((device) => device.id === browserDeviceId);
    return browserDevice?.name || '';
  }

  function syncPlaybackAvailability() {
    tileState = {
      ...tileState,
      deviceId: getSelectedPlaybackDeviceId(),
      canControlPlayback: tileState.playerReady || Boolean(tileState.selectedDeviceId)
    };
  }

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
      syncPlaybackAvailability();
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
    syncPlaybackAvailability();
    notifyStateChange();
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
          browserDeviceId = device_id;
          tileState = {
            ...tileState,
            playerReady: true
          };
          syncPlaybackAvailability();
          notifyStateChange();
          void refreshDevices({ preserveMessage: true });
        });

        player.addListener('not_ready', () => {
          browserDeviceId = '';
          tileState = { ...tileState, playerReady: false, isPlaying: false };
          syncPlaybackAvailability();
          notifyStateChange();
        });

        player.addListener('player_state_changed', (state) => {
          updatePlayerState(state);
        });

        player.addListener('initialization_error', ({ message }) => {
          console.warn('Spotify init error:', message);
          playerInitPromise = null;
          tileState = { ...tileState, playerReady: false };
          syncPlaybackAvailability();
        });

        player.addListener('authentication_error', ({ message }) => {
          console.warn('Spotify auth error:', message);
          cachedToken = null;
          tileState = { ...tileState, playerReady: false };
          syncPlaybackAvailability();
        });

        player.addListener('account_error', ({ message }) => {
          console.warn('Spotify account error (Premium required):', message);
          tileState = {
            ...tileState,
            playerReady: false,
            message: 'Spotify Premium kræves for afspilning i browseren.'
          };
          syncPlaybackAvailability();
          notifyStateChange();
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
        body: JSON.stringify({ action, deviceId: getSelectedPlaybackDeviceId(), ...extra })
      });

      const payload = await response.json().catch(() => ({}));

      if (response.ok && payload?.ok) {
        return payload;
      }

      if (payload?.needsReconnect) {
        // stored token lacks playback scopes – prompt reconnect
        tileState = {
          ...tileState,
          status: 'needs-auth',
          message: payload.message || 'Forbind Spotify igen for at aktivere afspilning.',
          connectUrl: sanitizeUrl(payload.reconnectUrl) || connectUrl
        };
        notifyStateChange();
      }

      return payload;
    } catch (error) {
      console.warn(`Spotify ${action} failed:`, error);
      return { ok: false, message: error instanceof Error ? error.message : 'Ukendt fejl.' };
    }
  }

  async function refreshDevices({ preserveMessage = false } = {}) {
    if (!enabled) {
      tileState = {
        ...tileState,
        deviceStatus: 'error',
        deviceMessage: 'Spotify er slået fra.',
        devices: []
      };
      syncPlaybackAvailability();
      return getTileState();
    }

    if (!isOnline()) {
      tileState = {
        ...tileState,
        deviceStatus: 'error',
        deviceMessage: 'Du er offline. Enhedslisten kan ikke opdateres lige nu.',
        devices: []
      };
      syncPlaybackAvailability();
      return getTileState();
    }

    if (!playbackEndpoint) {
      tileState = {
        ...tileState,
        deviceStatus: 'error',
        deviceMessage: 'Spotify afspilnings-endpoint mangler i app-konfigurationen.',
        devices: []
      };
      syncPlaybackAvailability();
      return getTileState();
    }

    tileState = {
      ...tileState,
      deviceStatus: 'loading',
      deviceMessage: 'Henter Spotify Connect-enheder...'
    };
    notifyStateChange();

    const payload = await sendPlaybackCommand('devices');
    if (!payload?.ok) {
      tileState = {
        ...tileState,
        deviceStatus: 'error',
        deviceMessage: typeof payload?.message === 'string' && payload.message.trim().length > 0
          ? payload.message
          : 'Kunne ikke hente Spotify Connect-enheder lige nu.',
        devices: []
      };
      syncPlaybackAvailability();
      notifyStateChange();
      return getTileState();
    }

    const devices = Array.isArray(payload?.devices)
      ? sortDevices(payload.devices.map(normalizeDevice).filter((device) => device.id))
      : [];
    const speakerDevices = devices.filter((device) => String(device.type || '').toLowerCase() === 'speaker');
    const visibleDevices = speakerDevices.length > 0 ? speakerDevices : devices;
    const activeDevice = devices.find((device) => device.isActive);
    const selectedDevice = visibleDevices.find((device) => device.id === tileState.selectedDeviceId)
      || visibleDevices.find((device) => device.id === activeDevice?.id)
      || visibleDevices[0]
      || null;

    tileState = {
      ...tileState,
      devices: visibleDevices,
      selectedDeviceId: selectedDevice?.id || '',
      selectedDeviceName: selectedDevice?.name || '',
      deviceStatus: devices.length > 0 ? 'ready' : 'empty',
      deviceMessage: devices.length === 0
        ? 'Ingen Spotify Connect-enheder fundet. Åbn Spotify på en anden enhed, og prøv igen.'
        : speakerDevices.length > 0
          ? 'Højttalere vises først, så Spotify Connect-højttalere er nemmere at vælge.'
          : 'Ingen højttalere fundet lige nu, så alle Spotify Connect-enheder vises som fallback.',
      showingAllDevices: speakerDevices.length === 0 && devices.length > 0
    };

    if (!preserveMessage && tileState.status === 'ready' && !tileState.message) {
      tileState = { ...tileState, message: 'Spotify er klar.' };
    }

    syncPlaybackAvailability();
    notifyStateChange();
    return getTileState();
  }

  async function selectPlaybackDevice(nextDeviceId) {
    const normalizedId = String(nextDeviceId || '').trim();
    if (!normalizedId) {
      tileState = {
        ...tileState,
        selectedDeviceId: '',
        selectedDeviceName: '',
        isPlaying: false
      };
      syncPlaybackAvailability();
      notifyStateChange();
      return { ok: true, message: 'Valg af Spotify-enhed nulstillet.' };
    }

    const selectedDevice = (tileState.devices || []).find((device) => device.id === normalizedId);
    if (!selectedDevice) {
      return { ok: false, message: 'Den valgte Spotify-enhed kunne ikke findes længere.' };
    }

    tileState = {
      ...tileState,
      deviceStatus: 'loading',
      deviceMessage: `Skifter afspilning til ${selectedDevice.name}...`
    };
    notifyStateChange();

    const payload = await sendPlaybackCommand('transfer', { deviceId: normalizedId, play: true });
    if (!payload?.ok) {
      tileState = {
        ...tileState,
        deviceStatus: 'error',
        deviceMessage: typeof payload?.message === 'string' && payload.message.trim().length > 0
          ? payload.message
          : 'Kunne ikke skifte Spotify-enhed lige nu.'
      };
      notifyStateChange();
      return { ok: false, message: tileState.deviceMessage };
    }

    tileState = {
      ...tileState,
      selectedDeviceId: normalizedId,
      selectedDeviceName: selectedDevice.name,
      isPlaying: true,
      deviceStatus: 'ready',
      deviceMessage: `${selectedDevice.name} er valgt til Spotify-afspilning.`,
      devices: (tileState.devices || []).map((device) => ({
        ...device,
        isActive: device.id === normalizedId
      }))
    };
    syncPlaybackAvailability();
    notifyStateChange();
    return { ok: true, message: tileState.deviceMessage };
  }

  async function play(uri) {
    const safeUri = typeof uri === 'string' ? uri.trim() : '';

    if (!safeUri) {
      const result = await sendPlaybackCommand('play');
      if (result?.ok) {
        tileState = { ...tileState, isPlaying: true };
        syncPlaybackAvailability();
        notifyStateChange();
      }
      return;
    }

    if (safeUri.startsWith('spotify:track:')) {
      const result = await sendPlaybackCommand('play', { trackUri: safeUri });
      if (result?.ok) {
        tileState = { ...tileState, isPlaying: true };
        syncPlaybackAvailability();
        notifyStateChange();
      }
      return;
    }

    const result = await sendPlaybackCommand('play', { contextUri: safeUri });
    if (result?.ok) {
      tileState = { ...tileState, isPlaying: true };
      syncPlaybackAvailability();
      notifyStateChange();
    }
  }

  async function togglePlay() {
    if (!tileState.canControlPlayback) {
      return;
    }

    try {
      if (player && tileState.playerReady) {
        const state = await player.getCurrentState();
        if (state) {
          const result = await sendPlaybackCommand(state.paused ? 'play' : 'pause');
          if (result?.ok) {
            tileState = { ...tileState, isPlaying: state.paused };
            syncPlaybackAvailability();
            notifyStateChange();
          }
          return;
        }
      }

      const nextAction = tileState.isPlaying ? 'pause' : 'play';
      const result = await sendPlaybackCommand(nextAction);
      if (result?.ok) {
        tileState = { ...tileState, isPlaying: nextAction === 'play' };
        syncPlaybackAvailability();
        notifyStateChange();
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
    browserDeviceId = '';

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

    tileState = createInitialTileState(enabled, connectUrl);
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
      syncPlaybackAvailability();

      // Auto-initialize the player when connected
      if (tokenEndpoint && !player) {
        void initPlayer();
      }

      void refreshDevices({ preserveMessage: true });

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
      syncPlaybackAvailability();

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
    refreshDevices,
    selectPlaybackDevice,
    searchCatalog,
    setOnStateChange,
    dispose
  };
}
