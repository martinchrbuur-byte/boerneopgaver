import { renderIcon, renderIconText } from '../shared/iconRegistry.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function createMainView(rootElement) {
  if (!rootElement) {
    throw new Error('Root element is required.');
  }

  rootElement.innerHTML = `
    <section class="app-shell" aria-label="Børnenes opgaveskema">
      <header class="card app-header-card">
        <div class="app-header-row">
          <div class="app-brand">
            <img class="app-logo" src="./favicon.svg" alt="Opgavehelte logo" width="64" height="64" />
            <div>
            <h1 class="app-title">Opgavehelte</h1>
            <p class="app-subtitle">Fuldfør opgaver, optjen lommepenge, og gør samarbejdet sjovt.</p>
            </div>
          </div>
          <div id="account-section" class="account-section" hidden>
            <span id="account-email" class="account-email"></span>
            <button id="switch-account-btn" type="button" class="button button-secondary">Skift konto</button>
            <button id="logout-btn" type="button" class="button button-secondary">Log ud</button>
          </div>
        </div>
        <div id="pwa-install-section" class="pwa-install-banner" hidden>
          <div class="pwa-install-copy">
            <p id="pwa-install-status" class="pwa-install-status"></p>
            <p id="pwa-install-hint" class="pwa-install-hint"></p>
          </div>
          <button id="pwa-install-btn" type="button" class="button button-primary" hidden>Installer app</button>
        </div>
      </header>

      <section class="card app-role-card app-top-card" aria-label="Rolleskift">
        <h2 class="section-title">Visningstilstand</h2>
        <div id="role-switch" class="role-switch" role="group" aria-label="Vælg brugerrolle">
          <button type="button" class="button button-secondary" data-role="parent" aria-pressed="true">
            Forældrevisning
          </button>
          <button type="button" class="button button-secondary" data-role="Hans Jørgen" aria-pressed="false">
            ${renderIconText('kidHans', 'Hans Jørgen')}
          </button>
          <button type="button" class="button button-secondary" data-role="Andrea" aria-pressed="false">
            ${renderIconText('kidAndrea', 'Andrea')}
          </button>
        </div>
      </section>

      <section class="card app-status-card app-top-card" aria-label="Status">
        <div id="status-row" class="status-row">
          <div class="status-container">
            <p id="status-text" class="status-text">Forældretilstand</p>
            <div id="money-slider-group" class="money-slider-group" aria-live="polite">
              <div class="slider-wrapper">
                <input type="range" class="progress-slider" min="0" max="0" value="0" disabled />
                <span class="slider-label"><span class="money-slider-count">0,00 kr / 0,00 kr</span></span>
              </div>
            </div>
          </div>
          <div class="status-icons" aria-hidden="true">
            <span id="wallet-icon" class="wallet-icon" title="Lommepung">${renderIcon('wallet')}</span>
            <span id="coin-icon" class="coin-icon" title="Optjente lommepenge" hidden>${renderIcon('coin')}</span>
          </div>
        </div>
        <p id="feedback" class="feedback" role="status" aria-live="polite"></p>
      </section>

      <section class="card app-spotify-card app-top-card" aria-label="Spotify">
        <h2 class="section-title">${renderIconText('music', 'Spotify')}</h2>
        <p id="spotify-status" class="chore-meta">Forbinder ikke endnu.</p>
        <div id="spotify-offline" class="spotify-offline" hidden>
          ${renderIconText('offline', 'Offline – Spotify er midlertidigt utilgængelig.')}
        </div>
        <div id="spotify-actions" class="actions spotify-actions">
          <button id="spotify-connect-link" type="button" class="button button-primary" hidden>Forbind Spotify</button>
          <button id="spotify-refresh-btn" type="button" class="button button-secondary" hidden>Opdater anbefalinger</button>
        </div>
        <ul id="spotify-list" class="list spotify-list"></ul>
        <div id="spotify-player" class="spotify-player" hidden>
          <div class="spotify-now-playing">
            <img id="spotify-track-image" class="spotify-track-image" src="" alt="" hidden>
            <div class="spotify-track-info">
              <strong id="spotify-track-name" class="spotify-track-name"></strong>
              <span id="spotify-track-artist" class="spotify-track-artist"></span>
            </div>
          </div>
          <div class="spotify-controls">
            <button id="spotify-prev-btn" type="button" class="spotify-ctrl-btn" title="Forrige">⏮</button>
            <button id="spotify-play-pause-btn" type="button" class="spotify-ctrl-btn" title="Afspil/Pause">▶</button>
            <button id="spotify-next-btn" type="button" class="spotify-ctrl-btn" title="Næste">⏭</button>
          </div>
        </div>
      </section>

      <nav class="tab-nav app-tab-nav" role="tablist" aria-label="Sektioner">
        <button class="tab-btn tab-active" role="tab" data-tab="opgaver" aria-selected="true">${renderIconText('tabChores', 'Opgaver')}</button>
        <button class="tab-btn tab-parent-only" role="tab" data-tab="periode" aria-selected="false">${renderIconText('tabPeriod', 'Periode')}</button>
        <button class="tab-btn tab-parent-only" role="tab" data-tab="feedback" aria-selected="false">${renderIconText('tabFeedback', 'Feedback')}</button>
        <button class="tab-btn tab-parent-only" role="tab" data-tab="historik" aria-selected="false">${renderIconText('tabHistory', 'Historik')}</button>
      </nav>

      <div id="tab-opgaver" class="tab-panel tab-panel-chores" role="tabpanel">
        <section id="add-chore-section" class="card chore-composer-card" aria-label="Tilføj opgave">
          <h2 class="section-title">Tilføj en opgave</h2>
          <form id="add-chore-form">
            <div class="form-row form-row-3">
              <input
                id="chore-name-input"
                class="input"
                name="choreName"
                type="text"
                placeholder="f.eks. Giv katten mad"
                maxlength="80"
                required
              />
              <div class="value-input-wrapper">
                <input
                  id="chore-value-input"
                  class="input input-narrow"
                  name="choreValue"
                  type="number"
                  placeholder="kr"
                  min="0"
                  step="0.5"
                  value="0"
                />
                <span class="value-unit">kr</span>
              </div>
              <button type="submit" class="button button-primary">Tilføj</button>
            </div>
            <div id="assign-to-section" class="assign-to-section">
              <label class="assign-label">Tildel til:</label>
              <div class="assign-checkboxes">
                <label class="checkbox-label">
                  <input type="checkbox" name="assignedTo" value="Hans Jørgen" checked /> Hans Jørgen
                </label>
                <label class="checkbox-label">
                  <input type="checkbox" name="assignedTo" value="Andrea" checked /> Andrea
                </label>
              </div>
            </div>
            <div class="form-row form-row-max">
              <label class="assign-label" for="chore-max-input">Maks gange pr. periode (0&nbsp;=&nbsp;ubegrænset):</label>
              <input
                id="chore-max-input"
                class="input input-narrow"
                name="choreMax"
                type="number"
                min="0"
                step="1"
                value="1"
              />
            </div>
            <div class="form-row form-row-max">
              <label class="assign-label" for="chore-unlimited-cap-input">Dagligt loft ved ubegrænset (min 1):</label>
              <input
                id="chore-unlimited-cap-input"
                class="input input-narrow"
                name="choreUnlimitedCap"
                type="number"
                min="1"
                step="1"
                value="1"
              />
            </div>
          </form>
        </section>

        <div class="chore-content-grid">
          <div id="collab-inbox" class="collab-inbox" hidden></div>

          <section class="card chore-list-card" aria-label="Opgaveliste">
            <h2 class="section-title">Opgaver</h2>
            <ul id="chore-list" class="list"></ul>
          </section>

          <section class="card recent-completions-card" aria-label="Seneste fuldføringer">
            <h2 class="section-title">Seneste fuldføringer</h2>
            <ul id="recent-completions" class="list"></ul>
          </section>
        </div>
      </div>

      <div id="tab-periode" class="tab-panel" role="tabpanel" hidden>
        <section class="card" aria-label="Aktuel periode">
          <div class="period-header">
            <div>
              <h2 class="section-title" id="period-title">Aktuel periode</h2>
              <p id="period-dates" class="period-dates"></p>
            </div>
            <span id="period-days-left" class="period-days-badge"></span>
          </div>
          <div id="period-earnings" class="period-earnings"></div>
          <div id="period-parent-actions" class="period-parent-actions" hidden>
            <hr class="divider" />
            <div class="period-settings-row">
              <label class="assign-label" for="period-length-input">Periode-længde (dage):</label>
              <input id="period-length-input" class="input input-narrow" type="number" min="1" max="365" value="7" />
              <button id="period-length-save" class="button button-secondary" type="button">Gem</button>
            </div>
            <button id="close-period-btn" class="button button-danger" type="button">${renderIconText('check', 'Luk periode og marker som betalt')}</button>
          </div>
        </section>
      </div>

      <div id="tab-feedback" class="tab-panel" role="tabpanel" hidden>
        <section class="card" aria-label="Send feedback">
          <h2 class="section-title">${renderIconText('tabFeedback', 'Forældre-feedback')}</h2>
          <p class="chore-meta feedback-intro">Skriv ønsker, fejl eller idéer, så de kan bruges til senere implementering.</p>
          <form id="feedback-form" class="feedback-form">
            <div class="form-row">
              <input
                id="feedback-title-input"
                class="input"
                name="feedbackTitle"
                type="text"
                maxlength="120"
                placeholder="Kort overskrift (valgfri)"
              />
              <select id="feedback-category-input" class="input" name="feedbackCategory">
                <option value="general">Generelt</option>
                <option value="bug">Fejl</option>
                <option value="idea">Idé</option>
                <option value="quality">Forbedring</option>
                <option value="question">Spørgsmål</option>
              </select>
            </div>
            <div class="form-row feedback-message-row">
              <label class="assign-label" for="feedback-message-input">Hvad vil du gerne have ændret eller bygget?</label>
              <textarea
                id="feedback-message-input"
                class="input textarea"
                name="feedbackMessage"
                rows="5"
                maxlength="4000"
                placeholder="Beskriv behov, problem eller idé"
                required
              ></textarea>
            </div>
            <button type="submit" class="button button-primary">Gem feedback</button>
          </form>
        </section>

        <section class="card" aria-label="Tidligere feedback">
          <h2 class="section-title">${renderIconText('feedbackArchive', 'Feedback-historik')}</h2>
          <div id="feedback-history"></div>
        </section>
      </div>

      <div id="tab-historik" class="tab-panel" role="tabpanel" hidden>
        <section class="card" aria-label="Periode-historik">
          <h2 class="section-title">${renderIconText('tabHistory', 'Periode-historik')}</h2>
          <div id="period-history"></div>
        </section>
      </div>

      <div id="mascot-overlay" class="mascot-overlay" hidden>
        <span class="mascot-emoji" aria-hidden="true"></span>
        <span class="mascot-message"></span>
      </div>

    </section>
  `;

  return {
    roleSwitch: rootElement.querySelector('#role-switch'),
    addChoreForm: rootElement.querySelector('#add-chore-form'),
    addChoreSection: rootElement.querySelector('#add-chore-section'),
    choreNameInput: rootElement.querySelector('#chore-name-input'),
    choreValueInput: rootElement.querySelector('#chore-value-input'),
    choreList: rootElement.querySelector('#chore-list'),
    recentCompletions: rootElement.querySelector('#recent-completions'),
    feedback: rootElement.querySelector('#feedback'),
    tabNav: rootElement.querySelector('.tab-nav'),
    tabOpgaver: rootElement.querySelector('#tab-opgaver'),
    tabPeriode: rootElement.querySelector('#tab-periode'),
    tabFeedback: rootElement.querySelector('#tab-feedback'),
    tabHistorik: rootElement.querySelector('#tab-historik'),
    feedbackForm: rootElement.querySelector('#feedback-form'),
    feedbackTitleInput: rootElement.querySelector('#feedback-title-input'),
    feedbackCategoryInput: rootElement.querySelector('#feedback-category-input'),
    feedbackMessageInput: rootElement.querySelector('#feedback-message-input'),
    feedbackHistory: rootElement.querySelector('#feedback-history'),
    periodTitle: rootElement.querySelector('#period-title'),
    periodDates: rootElement.querySelector('#period-dates'),
    periodDaysLeft: rootElement.querySelector('#period-days-left'),
    periodEarnings: rootElement.querySelector('#period-earnings'),
    periodParentActions: rootElement.querySelector('#period-parent-actions'),
    periodLengthInput: rootElement.querySelector('#period-length-input'),
    periodLengthSave: rootElement.querySelector('#period-length-save'),
    closePeriodBtn: rootElement.querySelector('#close-period-btn'),
    periodHistory: rootElement.querySelector('#period-history'),
    tabParentOnlyBtns: rootElement.querySelectorAll('.tab-parent-only'),
    choreMaxInput: rootElement.querySelector('#chore-max-input'),
    choreUnlimitedCapInput: rootElement.querySelector('#chore-unlimited-cap-input'),
    collabInbox: rootElement.querySelector('#collab-inbox'),
    mascotOverlay: rootElement.querySelector('#mascot-overlay'),
    statusText: rootElement.querySelector('#status-text'),
    moneySliderGroup: rootElement.querySelector('#money-slider-group'),
    statusRow: rootElement.querySelector('#status-row'),
    walletIcon: rootElement.querySelector('#wallet-icon'),
    coinIcon: rootElement.querySelector('#coin-icon'),
    spotifyStatus: rootElement.querySelector('#spotify-status'),
    spotifyOffline: rootElement.querySelector('#spotify-offline'),
    spotifyActions: rootElement.querySelector('#spotify-actions'),
    spotifyConnectLink: rootElement.querySelector('#spotify-connect-link'),
    spotifyRefreshButton: rootElement.querySelector('#spotify-refresh-btn'),
    spotifyList: rootElement.querySelector('#spotify-list'),
    spotifyPlayer: rootElement.querySelector('#spotify-player'),
    spotifyTrackImage: rootElement.querySelector('#spotify-track-image'),
    spotifyTrackName: rootElement.querySelector('#spotify-track-name'),
    spotifyTrackArtist: rootElement.querySelector('#spotify-track-artist'),
    spotifyPlayPauseBtn: rootElement.querySelector('#spotify-play-pause-btn'),
    spotifyPrevBtn: rootElement.querySelector('#spotify-prev-btn'),
    spotifyNextBtn: rootElement.querySelector('#spotify-next-btn'),
    accountSection: rootElement.querySelector('#account-section'),
    accountEmail: rootElement.querySelector('#account-email'),
    switchAccountButton: rootElement.querySelector('#switch-account-btn'),
    logoutButton: rootElement.querySelector('#logout-btn'),
    pwaInstallSection: rootElement.querySelector('#pwa-install-section'),
    pwaInstallStatus: rootElement.querySelector('#pwa-install-status'),
    pwaInstallHint: rootElement.querySelector('#pwa-install-hint'),
    pwaInstallButton: rootElement.querySelector('#pwa-install-btn')
  };
}

function authPageHeading(page) {
  if (page === 'signup') return 'Opret familiekonto';
  if (page === 'login') return 'Log ind';
  if (page === 'forgot-password') return 'Glemt adgangskode';
  if (page === 'reset-password') return 'Nulstil adgangskode';
  return 'Velkommen til Opgavehelte';
}

function authPageSubheading(page) {
  if (page === 'signup') return 'Lav én konto til familien for sikker cloud sync på tværs af enheder.';
  if (page === 'login') return 'Log ind for at fortsætte med jeres opgaver og periodedata.';
  if (page === 'forgot-password') return 'Vi sender et link, så du kan vælge en ny adgangskode.';
  if (page === 'reset-password') return 'Vælg en ny adgangskode til jeres familiekonto.';
  return 'Vælg hvordan du vil komme i gang med cloud sync.';
}

function authPageBody(page) {
  switch (page) {
    case 'signup':
      return `
      <form id="auth-signup-form" class="auth-form" novalidate>
        <label class="auth-label" for="signup-email">Email</label>
        <input id="signup-email" class="input" name="email" type="email" autocomplete="email" required />
        <label class="auth-label" for="signup-password">Adgangskode</label>
        <input id="signup-password" class="input" name="password" type="password" autocomplete="new-password" minlength="6" required />
        <label class="auth-label" for="signup-password-confirm">Gentag adgangskode</label>
        <input id="signup-password-confirm" class="input" name="passwordConfirm" type="password" autocomplete="new-password" minlength="6" required />
        <button type="submit" class="button button-primary">Opret konto</button>
      </form>
      <p class="auth-link-row">Har du allerede en konto? <button type="button" class="auth-link-button" data-auth-nav="login">Log ind</button></p>
    `;
    case 'login':
      return `
      <form id="auth-login-form" class="auth-form" novalidate>
        <label class="auth-label" for="login-email">Email</label>
        <input id="login-email" class="input" name="email" type="email" autocomplete="email" required />
        <label class="auth-label" for="login-password">Adgangskode</label>
        <input id="login-password" class="input" name="password" type="password" autocomplete="current-password" required />
        <button type="submit" class="button button-primary">Log ind</button>
      </form>
      <div class="auth-link-stack">
        <p class="auth-link-row">Ingen konto endnu? <button type="button" class="auth-link-button" data-auth-nav="signup">Opret konto</button></p>
        <p class="auth-link-row"><button type="button" class="auth-link-button" data-auth-nav="forgot-password">Glemt adgangskode?</button></p>
      </div>
    `;
    case 'forgot-password':
      return `
      <form id="auth-forgot-form" class="auth-form" novalidate>
        <label class="auth-label" for="forgot-email">Email</label>
        <input id="forgot-email" class="input" name="email" type="email" autocomplete="email" required />
        <button type="submit" class="button button-primary">Send nulstillingslink</button>
      </form>
      <p class="auth-link-row"><button type="button" class="auth-link-button" data-auth-nav="login">Tilbage til log ind</button></p>
    `;
    case 'reset-password':
      return `
      <form id="auth-reset-form" class="auth-form" novalidate>
        <label class="auth-label" for="reset-password">Ny adgangskode</label>
        <input id="reset-password" class="input" name="password" type="password" autocomplete="new-password" minlength="6" required />
        <label class="auth-label" for="reset-password-confirm">Gentag ny adgangskode</label>
        <input id="reset-password-confirm" class="input" name="passwordConfirm" type="password" autocomplete="new-password" minlength="6" required />
        <button type="submit" class="button button-primary">Gem ny adgangskode</button>
      </form>
      <p class="auth-link-row"><button type="button" class="auth-link-button" data-auth-nav="login">Tilbage til log ind</button></p>
    `;
    default:
      return `
    <div class="auth-actions">
      <button type="button" class="button button-primary" data-auth-nav="signup">Opret konto</button>
      <button type="button" class="button button-secondary" data-auth-nav="login">Log ind</button>
    </div>
  `;
  }
}

export function createAuthView(rootElement, { page = 'welcome', message = '' } = {}) {
  if (!rootElement) {
    throw new Error('Root element is required.');
  }

  const safePage = escapeHtml(page);
  const safeHeading = escapeHtml(authPageHeading(page));
  const safeSubheading = escapeHtml(authPageSubheading(page));
  const safeMessage = escapeHtml(message);

  rootElement.innerHTML = `
    <section class="auth-shell" aria-label="Konto og login">
      <header class="card">
        <div class="app-brand">
          <img class="app-logo" src="./favicon.svg" alt="Opgavehelte logo" width="64" height="64" />
          <div>
            <h1 class="app-title">Opgavehelte</h1>
            <p class="app-subtitle">Sikker cloud sync for familiens opgaver.</p>
          </div>
        </div>
      </header>
      <section class="card" data-auth-page="${safePage}">
        <h2 class="section-title">${safeHeading}</h2>
        <p class="app-subtitle auth-subtitle">${safeSubheading}</p>
        <p id="auth-feedback" class="feedback" role="status" aria-live="polite">${safeMessage}</p>
        ${authPageBody(page)}
      </section>
    </section>
  `;

  return {
    page,
    feedback: rootElement.querySelector('#auth-feedback'),
    navButtons: rootElement.querySelectorAll('button[data-auth-nav]'),
    signupForm: rootElement.querySelector('#auth-signup-form'),
    loginForm: rootElement.querySelector('#auth-login-form'),
    forgotForm: rootElement.querySelector('#auth-forgot-form'),
    resetForm: rootElement.querySelector('#auth-reset-form')
  };
}
