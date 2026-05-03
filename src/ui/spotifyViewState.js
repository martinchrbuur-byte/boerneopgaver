import { renderIcon } from '../shared/iconRegistry.js';

function escapeAttribute(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderEmptySpotifyItem(text) {
  return `<li class="chore-item"><p class="chore-meta">${text}</p></li>`;
}

function renderSpotifyDeviceOptions(devices = [], selectedDeviceId = '') {
  if (!Array.isArray(devices) || devices.length === 0) {
    return '<option value="">Ingen enheder fundet endnu</option>';
  }

  return devices.map((device) => {
    const id = escapeAttribute(device?.id || '');
    const name = escapeHtml(device?.name || 'Ukendt enhed');
    const type = escapeHtml(device?.type || 'Ukendt type');
    const activeSuffix = device?.isActive ? ' · Aktiv' : '';
    const selected = device?.id === selectedDeviceId ? ' selected' : '';
    return `<option value="${id}"${selected}>${name} · ${type}${activeSuffix}</option>`;
  }).join('');
}

function renderSpotifyItems(items = [], canControlPlayback = false) {
  if (!Array.isArray(items) || items.length === 0) {
    return renderEmptySpotifyItem('Ingen anbefalinger endnu.');
  }

  return items.map((item) => {
    const kind = typeof item?.kind === 'string' ? item.kind : 'playlist';
    const kindLabel = kind === 'track'
      ? 'Track'
      : kind === 'album'
        ? 'Album'
        : kind === 'artist'
          ? 'Artist'
          : 'Playliste';
    const title = escapeHtml(item?.title || 'Ukendt titel');
    const subtitle = escapeHtml(item?.subtitle || 'Spotify');
    const href = escapeAttribute(item?.href || '');
    const uri = escapeAttribute(item?.uri || '');
    const canPlay = canControlPlayback && uri && item?.canPlay !== false;
    const linkMarkup = href
      ? `<a class="button button-secondary" href="${href}" target="_blank" rel="noopener noreferrer">Åbn i Spotify</a>`
      : '';
    const playMarkup = canPlay
      ? `<button class="button button-primary spotify-play-item-btn" type="button" data-spotify-uri="${uri}" title="Afspil">▶ Afspil</button>`
      : '';

    return `
      <li class="chore-item">
        <div class="chore-main">
          <h3 class="chore-title">${renderIcon('music')}<span>${title}</span></h3>
          <div class="actions">${playMarkup}${linkMarkup}</div>
        </div>
        <p class="chore-meta">${escapeHtml(kindLabel)} · ${subtitle}</p>
      </li>
    `;
  }).join('');
}

function renderSpotifySearchResults(viewRefs, spotifyUi, canControlPlayback) {
  if (!viewRefs.spotifySearchStatus || !viewRefs.spotifySearchResults) {
    return;
  }

  const search = spotifyUi?.search || null;
  if (!search || !search.query) {
    viewRefs.spotifySearchStatus.textContent = 'Søg for at finde musik og playlister.';
    viewRefs.spotifySearchResults.innerHTML = renderEmptySpotifyItem('Ingen søgeresultater endnu.');
    return;
  }

  if (search.status === 'loading') {
    viewRefs.spotifySearchStatus.textContent = `Søger efter “${search.query}”...`;
    viewRefs.spotifySearchResults.innerHTML = renderEmptySpotifyItem('Henter søgeresultater...');
    return;
  }

  viewRefs.spotifySearchStatus.textContent = search.message || 'Søgning færdig.';
  viewRefs.spotifySearchResults.innerHTML = renderSpotifyItems(search.items || [], canControlPlayback);
}

function renderSpotifyTile(viewRefs, spotifyUi = null) {
  if (!viewRefs.spotifyStatus || !viewRefs.spotifyList) {
    return;
  }

  const status = spotifyUi?.status ?? 'unavailable';
  const message = spotifyUi?.message ?? 'Spotify er ikke sat op endnu.';
  const isOffline = status === 'offline';
  const isConnected = status === 'ready';
  const canConnect = status === 'needs-auth' && typeof spotifyUi?.connectUrl === 'string' && spotifyUi.connectUrl.length > 0;
  const canRefresh = isConnected;
  const playerReady = spotifyUi?.playerReady === true;
  const canControlPlayback = spotifyUi?.canControlPlayback === true;
  const isPlaying = spotifyUi?.isPlaying === true;
  const currentTrack = spotifyUi?.currentTrack || null;
  const devices = Array.isArray(spotifyUi?.devices) ? spotifyUi.devices : [];
  const selectedDeviceId = typeof spotifyUi?.selectedDeviceId === 'string' ? spotifyUi.selectedDeviceId : '';
  const deviceStatus = typeof spotifyUi?.deviceStatus === 'string' ? spotifyUi.deviceStatus : 'idle';
  const deviceMessage = typeof spotifyUi?.deviceMessage === 'string'
    ? spotifyUi.deviceMessage
    : 'Vælg en højttaler eller anden Spotify Connect-enhed.';
  const showDevicePicker = isConnected;

  viewRefs.spotifyStatus.textContent = message;
  if (viewRefs.spotifyOffline) {
    viewRefs.spotifyOffline.hidden = !isOffline;
  }

  if (viewRefs.spotifyConnectLink) {
    viewRefs.spotifyConnectLink.hidden = !canConnect;
    viewRefs.spotifyConnectLink.disabled = status === 'loading';
  }

  if (viewRefs.spotifyRefreshButton) {
    viewRefs.spotifyRefreshButton.hidden = !canRefresh;
    viewRefs.spotifyRefreshButton.disabled = status === 'loading';
  }

  if (viewRefs.spotifyDisconnectButton) {
    viewRefs.spotifyDisconnectButton.hidden = !isConnected;
    viewRefs.spotifyDisconnectButton.disabled = status === 'loading';
  }

  if (viewRefs.spotifyDevicePanel) {
    viewRefs.spotifyDevicePanel.hidden = !showDevicePicker;
  }

  if (viewRefs.spotifyDeviceStatus) {
    viewRefs.spotifyDeviceStatus.textContent = deviceMessage;
  }

  if (viewRefs.spotifyDeviceSelect) {
    viewRefs.spotifyDeviceSelect.innerHTML = renderSpotifyDeviceOptions(devices, selectedDeviceId);
    viewRefs.spotifyDeviceSelect.disabled = !devices.length || status === 'loading' || deviceStatus === 'loading';
  }

  if (viewRefs.spotifyDeviceRefreshButton) {
    viewRefs.spotifyDeviceRefreshButton.hidden = !showDevicePicker;
    viewRefs.spotifyDeviceRefreshButton.disabled = status === 'loading' || deviceStatus === 'loading';
  }

  if (viewRefs.spotifyPlayer) {
    viewRefs.spotifyPlayer.hidden = !canControlPlayback;
  }

  if (canControlPlayback) {
    if (viewRefs.spotifyPlayPauseBtn) {
      viewRefs.spotifyPlayPauseBtn.textContent = isPlaying ? '⏸' : '▶';
      viewRefs.spotifyPlayPauseBtn.title = isPlaying ? 'Pause' : 'Afspil';
      viewRefs.spotifyPlayPauseBtn.disabled = false;
    }

    if (viewRefs.spotifyPrevBtn) {
      viewRefs.spotifyPrevBtn.disabled = false;
    }

    if (viewRefs.spotifyNextBtn) {
      viewRefs.spotifyNextBtn.disabled = false;
    }

    if (currentTrack) {
      if (viewRefs.spotifyTrackName) {
        viewRefs.spotifyTrackName.textContent = currentTrack.name || '';
      }
      if (viewRefs.spotifyTrackArtist) {
        viewRefs.spotifyTrackArtist.textContent = currentTrack.artist || '';
      }
      if (viewRefs.spotifyTrackImage) {
        if (currentTrack.imageUrl) {
          viewRefs.spotifyTrackImage.src = currentTrack.imageUrl;
          viewRefs.spotifyTrackImage.alt = currentTrack.name || '';
          viewRefs.spotifyTrackImage.hidden = false;
        } else {
          viewRefs.spotifyTrackImage.hidden = true;
        }
      }
    } else {
      if (viewRefs.spotifyTrackName) viewRefs.spotifyTrackName.textContent = spotifyUi?.selectedDeviceName || 'Intet spiller nu';
      if (viewRefs.spotifyTrackArtist) {
        viewRefs.spotifyTrackArtist.textContent = playerReady
          ? ''
          : 'Spotify-afspilning styres på den valgte enhed.';
      }
      if (viewRefs.spotifyTrackImage) viewRefs.spotifyTrackImage.hidden = true;
    }
  } else {
    if (viewRefs.spotifyPlayPauseBtn) viewRefs.spotifyPlayPauseBtn.disabled = true;
    if (viewRefs.spotifyPrevBtn) viewRefs.spotifyPrevBtn.disabled = true;
    if (viewRefs.spotifyNextBtn) viewRefs.spotifyNextBtn.disabled = true;
  }

  if (status === 'loading') {
    viewRefs.spotifyList.innerHTML = renderEmptySpotifyItem('Henter anbefalinger...');
    renderSpotifySearchResults(viewRefs, spotifyUi, canControlPlayback);
    return;
  }

  if (!isConnected) {
    viewRefs.spotifyList.innerHTML = renderEmptySpotifyItem('Spotify-data vises her, når kontoen er forbundet.');
    if (viewRefs.spotifySearchStatus) {
      viewRefs.spotifySearchStatus.textContent = 'Forbind Spotify for at søge i musik og playlister.';
    }
    if (viewRefs.spotifySearchResults) {
      viewRefs.spotifySearchResults.innerHTML = renderEmptySpotifyItem('Søgeresultater vises her, når Spotify er forbundet.');
    }
    return;
  }

  viewRefs.spotifyList.innerHTML = renderSpotifyItems(spotifyUi.items || [], canControlPlayback);
  renderSpotifySearchResults(viewRefs, spotifyUi, canControlPlayback);
}

export function createSpotifyViewStateController({
  root,
  viewRefs,
  spotifyService,
  refreshApp,
  isAppDisposed,
  navigateToUrl
}) {
  const removeListeners = [];
  const navigate = typeof navigateToUrl === 'function' ? navigateToUrl : (url) => window.location.assign(url);

  function bind(element, eventName, handler) {
    if (!element) {
      return;
    }

    element.addEventListener(eventName, handler);
    removeListeners.push(() => element.removeEventListener(eventName, handler));
  }

  function render() {
    if (isAppDisposed()) {
      return;
    }
    renderSpotifyTile(viewRefs, spotifyService.getTileState());
  }

  async function refreshRecommendations({ completionMessage = '' } = {}) {
    if (isAppDisposed()) {
      return;
    }

    const pending = spotifyService.refreshRecommendations();
    refreshApp();
    await pending;

    if (isAppDisposed()) {
      return;
    }
    refreshApp(completionMessage);
  }

  async function refreshDevices({ completionMessage = '' } = {}) {
    if (isAppDisposed()) {
      return;
    }

    const pending = spotifyService.refreshDevices();
    refreshApp();
    const state = await pending;

    if (isAppDisposed()) {
      return;
    }

    refreshApp(completionMessage || state?.deviceMessage || 'Spotify-enheder opdateret.');
  }

  bind(viewRefs.spotifyDisconnectButton, 'click', async () => {
    await spotifyService.disconnect();
    refreshApp('Spotify-forbindelsen er afbrudt.');
  });

  bind(viewRefs.spotifyRefreshButton, 'click', async () => {
    await refreshRecommendations({ completionMessage: 'Spotify-anbefalinger opdateret.' });
  });

  bind(viewRefs.spotifyDeviceRefreshButton, 'click', async () => {
    await refreshDevices();
  });

  bind(viewRefs.spotifyPlayPauseBtn, 'click', () => {
    void spotifyService.togglePlay();
  });

  bind(viewRefs.spotifyPrevBtn, 'click', () => {
    void spotifyService.previous();
  });

  bind(viewRefs.spotifyNextBtn, 'click', () => {
    void spotifyService.next();
  });

  bind(viewRefs.spotifyConnectLink, 'click', async () => {
    const pending = spotifyService.beginAuthorization();
    refreshApp();
    const result = await pending;

    if (result?.ok && typeof result.authorizationUrl === 'string' && result.authorizationUrl.length > 0) {
      navigate(result.authorizationUrl);
      return;
    }

    if (isAppDisposed()) {
      return;
    }

    refreshApp(result?.message || 'Kunne ikke starte Spotify-login.');
  });

  bind(viewRefs.spotifySearchForm, 'submit', async (event) => {
    event.preventDefault();
    const query = String(viewRefs.spotifySearchInput?.value || '').trim();
    const pending = spotifyService.searchCatalog(query);
    refreshApp();
    const result = await pending;

    if (isAppDisposed()) {
      return;
    }

    refreshApp(result?.search?.message || (query ? `Søgning færdig for “${query}”.` : 'Søgefelt ryddet.'));
  });

  bind(viewRefs.spotifyDeviceSelect, 'change', async (event) => {
    const nextDeviceId = String(event.target?.value || '').trim();
    const result = await spotifyService.selectPlaybackDevice(nextDeviceId);

    if (isAppDisposed()) {
      return;
    }

    refreshApp(result?.message || 'Spotify-enhed opdateret.');
  });

  bind(root, 'click', (event) => {
    const playBtn = event.target.closest('[data-spotify-uri]');
    if (!playBtn) {
      return;
    }

    const uri = playBtn.getAttribute('data-spotify-uri');
    if (uri) {
      void spotifyService.play(uri);
    }
  });

  spotifyService.setOnStateChange(() => {
    if (isAppDisposed()) {
      return;
    }
    render();
  });

  return {
    render,
    refreshRecommendations,
    refreshDevices,
    dispose() {
      while (removeListeners.length > 0) {
        const remove = removeListeners.pop();
        remove();
      }
      spotifyService.setOnStateChange(null);
    }
  };
}
