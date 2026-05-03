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

function renderSpotifyItems(items = [], playerReady = false) {
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
    const canPlay = playerReady && uri && item?.canPlay !== false;
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

function renderSpotifySearchResults(viewRefs, spotifyUi, playerReady) {
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
  viewRefs.spotifySearchResults.innerHTML = renderSpotifyItems(search.items || [], playerReady);
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
  const isPlaying = spotifyUi?.isPlaying === true;
  const currentTrack = spotifyUi?.currentTrack || null;

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

  if (viewRefs.spotifyPlayer) {
    viewRefs.spotifyPlayer.hidden = !playerReady;
  }

  if (playerReady) {
    if (viewRefs.spotifyPlayPauseBtn) {
      viewRefs.spotifyPlayPauseBtn.textContent = isPlaying ? '⏸' : '▶';
      viewRefs.spotifyPlayPauseBtn.title = isPlaying ? 'Pause' : 'Afspil';
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
      if (viewRefs.spotifyTrackName) viewRefs.spotifyTrackName.textContent = 'Intet spiller nu';
      if (viewRefs.spotifyTrackArtist) viewRefs.spotifyTrackArtist.textContent = '';
      if (viewRefs.spotifyTrackImage) viewRefs.spotifyTrackImage.hidden = true;
    }
  }

  if (status === 'loading') {
    viewRefs.spotifyList.innerHTML = renderEmptySpotifyItem('Henter anbefalinger...');
    renderSpotifySearchResults(viewRefs, spotifyUi, playerReady);
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

  viewRefs.spotifyList.innerHTML = renderSpotifyItems(spotifyUi.items || [], playerReady);
  renderSpotifySearchResults(viewRefs, spotifyUi, playerReady);
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

  bind(viewRefs.spotifyDisconnectButton, 'click', async () => {
    await spotifyService.disconnect();
    refreshApp('Spotify-forbindelsen er afbrudt.');
  });

  bind(viewRefs.spotifyRefreshButton, 'click', async () => {
    await refreshRecommendations({ completionMessage: 'Spotify-anbefalinger opdateret.' });
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
    dispose() {
      while (removeListeners.length > 0) {
        const remove = removeListeners.pop();
        remove();
      }
      spotifyService.setOnStateChange(null);
    }
  };
}
