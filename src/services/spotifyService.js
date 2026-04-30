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
    href: sanitizeUrl(item?.href)
  };
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

  let tileState = {
    status: enabled ? (connectUrl ? 'needs-auth' : 'unavailable') : 'unavailable',
    message: enabled
      ? (connectUrl ? 'Forbind Spotify for at hente anbefalinger.' : 'Spotify er ikke sat op endnu.')
      : 'Spotify er slået fra.',
    connectUrl,
    items: []
  };

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

  async function beginAuthorization() {
    if (!enabled) {
      tileState = {
        status: 'unavailable',
        message: 'Spotify er slået fra.',
        connectUrl,
        items: []
      };
      return { ok: false, message: tileState.message, authorizationUrl: '' };
    }

    if (!isOnline()) {
      return { ok: false, message: 'Du er offline. Prøv igen når forbindelsen er tilbage.', authorizationUrl: '' };
    }

    if (!connectUrl) {
      tileState = {
        status: 'unavailable',
        message: 'Spotify connect-endpoint mangler i app-konfigurationen.',
        connectUrl,
        items: []
      };
      return { ok: false, message: tileState.message, authorizationUrl: '' };
    }

    tileState = {
      ...tileState,
      status: 'loading',
      message: 'Forbereder Spotify-login...'
    };

    try {
      const accessToken = typeof getAccessToken === 'function'
        ? String(getAccessToken() || '')
        : '';
      const headers = {
        Accept: 'application/json'
      };
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      const response = await fetchImpl(connectUrl, {
        method: 'GET',
        headers,
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
          items: []
        };

        return { ok: false, message: tileState.message, authorizationUrl: '' };
      }

      tileState = {
        status: 'needs-auth',
        message: 'Åbner Spotify-login...',
        connectUrl,
        items: []
      };

      return {
        ok: true,
        message: tileState.message,
        authorizationUrl
      };
    } catch (error) {
      tileState = {
        status: 'unavailable',
        message: 'Kunne ikke starte Spotify-login lige nu.',
        connectUrl,
        items: []
      };

      return { ok: false, message: tileState.message, authorizationUrl: '' };
    }
  }

  async function refreshRecommendations() {
    if (!enabled) {
      tileState = {
        status: 'unavailable',
        message: 'Spotify er slået fra.',
        connectUrl,
        items: []
      };
      return getTileState();
    }

    if (!isOnline()) {
      return getTileState();
    }

    if (!recommendationsEndpoint) {
      tileState = {
        status: connectUrl ? 'needs-auth' : 'unavailable',
        message: connectUrl
          ? 'Forbind Spotify for at hente anbefalinger.'
          : 'Spotify endpoint mangler i app-konfigurationen.',
        connectUrl,
        items: []
      };
      return getTileState();
    }

    tileState = {
      ...tileState,
      status: 'loading',
      message: 'Henter Spotify-anbefalinger...'
    };

    try {
      const accessToken = typeof getAccessToken === 'function'
        ? String(getAccessToken() || '')
        : '';
      const headers = {
        Accept: 'application/json'
      };
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      const response = await fetchImpl(recommendationsEndpoint, {
        method: 'GET',
        headers,
        credentials: 'omit'
      });

      const payload = await response.json().catch(() => ({}));
      const responseConnectUrl = sanitizeUrl(payload?.connectUrl) || connectUrl;
      const connected = payload?.connected === true;

      if (response.status === 401 || !connected) {
        tileState = {
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
        ? payload.items.map(normalizeItem).slice(0, 6)
        : [];

      tileState = {
        status: 'ready',
        message: typeof payload?.message === 'string' && payload.message.trim().length > 0
          ? payload.message
          : 'Spotify-anbefalinger er opdateret.',
        connectUrl: responseConnectUrl,
        items
      };

      return getTileState();
    } catch (error) {
      tileState = {
        ...tileState,
        status: 'unavailable',
        message: 'Kunne ikke hente Spotify-data lige nu.',
        items: []
      };
      return getTileState();
    }
  }

  return {
    getTileState,
    refreshRecommendations,
    beginAuthorization
  };
}
