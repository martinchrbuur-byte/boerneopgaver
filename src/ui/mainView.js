export function createMainView(rootElement) {
  if (!rootElement) {
    throw new Error('Root element is required.');
  }

  rootElement.innerHTML = `
    <section class="app-shell" aria-label="Børnenes opgaveskema">
      <header class="card">
        <div class="app-header-row">
          <div>
            <h1 class="app-title">🌟 Opgavehelte</h1>
            <p class="app-subtitle">Fuldfør opgaver, optjen lommepenge, og gør samarbejdet sjovt.</p>
          </div>
          <div id="account-section" class="account-section" hidden>
            <span id="account-email" class="account-email"></span>
            <button id="switch-account-btn" type="button" class="button button-secondary">Skift konto</button>
            <button id="logout-btn" type="button" class="button button-secondary">Log ud</button>
          </div>
        </div>
      </header>

      <section class="card" aria-label="Rolleskift">
        <h2 class="section-title">Visningstilstand</h2>
        <div id="role-switch" class="role-switch" role="group" aria-label="Vælg brugerrolle">
          <button type="button" class="button button-secondary" data-role="parent" aria-pressed="true">
            Forældrevisning
          </button>
          <button type="button" class="button button-secondary" data-role="Hans Jørgen" aria-pressed="false">
            👦 Hans Jørgen
          </button>
          <button type="button" class="button button-secondary" data-role="Andrea" aria-pressed="false">
            👱‍♀️ Andrea
          </button>
        </div>
      </section>

      <section class="card" aria-label="Status">
        <div class="status-row">
          <div class="status-container">
            <p id="status-text" class="status-text">Forældretilstand</p>
            <div id="money-slider-group" class="money-slider-group" aria-live="polite">
              <div class="slider-wrapper">
                <input type="range" class="progress-slider" min="0" max="0" value="0" disabled />
                <span class="slider-label"><span class="money-slider-count">0,00 kr / 0,00 kr</span></span>
              </div>
            </div>
          </div>
          <span id="coin-icon" class="coin-icon" title="Optjente lommepenge" hidden>🪙</span>
        </div>
        <p id="feedback" class="feedback" role="status" aria-live="polite"></p>
      </section>

      <nav class="tab-nav" role="tablist" aria-label="Sektioner">
        <button class="tab-btn tab-active" role="tab" data-tab="opgaver" aria-selected="true">📋 Opgaver</button>
        <button class="tab-btn" role="tab" data-tab="sprint" aria-selected="false">🏃 Sprint</button>
        <button class="tab-btn tab-parent-only" role="tab" data-tab="historik" aria-selected="false">📜 Historik</button>
      </nav>

      <div id="tab-opgaver" class="tab-panel" role="tabpanel">
        <section id="add-chore-section" class="card" aria-label="Tilføj opgave">
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
              <label class="assign-label" for="chore-max-input">Maks gange pr. sprint (0&nbsp;=&nbsp;ubegrænset):</label>
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

        <div id="collab-inbox" class="collab-inbox" hidden></div>

        <section class="card" aria-label="Opgaveliste">
          <h2 class="section-title">Opgaver</h2>
          <ul id="chore-list" class="list"></ul>
        </section>

        <section class="card" aria-label="Seneste fuldføringer">
          <h2 class="section-title">Seneste fuldføringer</h2>
          <ul id="recent-completions" class="list"></ul>
        </section>
      </div>

      <div id="tab-sprint" class="tab-panel" role="tabpanel" hidden>
        <section class="card" aria-label="Aktuel sprint">
          <div class="sprint-header">
            <div>
              <h2 class="section-title" id="sprint-title">Aktuel sprint</h2>
              <p id="sprint-dates" class="sprint-dates"></p>
            </div>
            <span id="sprint-days-left" class="sprint-days-badge"></span>
          </div>
          <div id="sprint-earnings" class="sprint-earnings"></div>
          <div id="sprint-parent-actions" class="sprint-parent-actions" hidden>
            <hr class="divider" />
            <div class="sprint-settings-row">
              <label class="assign-label" for="sprint-length-input">Sprint-længde (dage):</label>
              <input id="sprint-length-input" class="input input-narrow" type="number" min="1" max="365" value="7" />
              <button id="sprint-length-save" class="button button-secondary" type="button">Gem</button>
            </div>
            <button id="close-sprint-btn" class="button button-danger" type="button">✅ Luk sprint og marker som betalt</button>
          </div>
        </section>
      </div>

      <div id="tab-historik" class="tab-panel" role="tabpanel" hidden>
        <section class="card" aria-label="Sprint-historik">
          <h2 class="section-title">📜 Sprint-historik</h2>
          <div id="sprint-history"></div>
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
    tabSprint: rootElement.querySelector('#tab-sprint'),
    tabHistorik: rootElement.querySelector('#tab-historik'),
    sprintTitle: rootElement.querySelector('#sprint-title'),
    sprintDates: rootElement.querySelector('#sprint-dates'),
    sprintDaysLeft: rootElement.querySelector('#sprint-days-left'),
    sprintEarnings: rootElement.querySelector('#sprint-earnings'),
    sprintParentActions: rootElement.querySelector('#sprint-parent-actions'),
    sprintLengthInput: rootElement.querySelector('#sprint-length-input'),
    sprintLengthSave: rootElement.querySelector('#sprint-length-save'),
    closeSprintBtn: rootElement.querySelector('#close-sprint-btn'),
    sprintHistory: rootElement.querySelector('#sprint-history'),
    tabParentOnlyBtns: rootElement.querySelectorAll('.tab-parent-only'),
    choreMaxInput: rootElement.querySelector('#chore-max-input'),
    choreUnlimitedCapInput: rootElement.querySelector('#chore-unlimited-cap-input'),
    collabInbox: rootElement.querySelector('#collab-inbox'),
    mascotOverlay: rootElement.querySelector('#mascot-overlay'),
    statusText: rootElement.querySelector('#status-text'),
    moneySliderGroup: rootElement.querySelector('#money-slider-group'),
    coinIcon: rootElement.querySelector('#coin-icon'),
    accountSection: rootElement.querySelector('#account-section'),
    accountEmail: rootElement.querySelector('#account-email'),
    switchAccountButton: rootElement.querySelector('#switch-account-btn'),
    logoutButton: rootElement.querySelector('#logout-btn')
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
  if (page === 'login') return 'Log ind for at fortsætte med jeres opgaver og sprintdata.';
  if (page === 'forgot-password') return 'Vi sender et link, så du kan vælge en ny adgangskode.';
  if (page === 'reset-password') return 'Vælg en ny adgangskode til jeres familiekonto.';
  return 'Vælg hvordan du vil komme i gang med cloud sync.';
}

function authPageBody(page) {
  if (page === 'signup') {
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
  }

  if (page === 'login') {
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
  }

  if (page === 'forgot-password') {
    return `
      <form id="auth-forgot-form" class="auth-form" novalidate>
        <label class="auth-label" for="forgot-email">Email</label>
        <input id="forgot-email" class="input" name="email" type="email" autocomplete="email" required />
        <button type="submit" class="button button-primary">Send nulstillingslink</button>
      </form>
      <p class="auth-link-row"><button type="button" class="auth-link-button" data-auth-nav="login">Tilbage til log ind</button></p>
    `;
  }

  if (page === 'reset-password') {
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
  }

  return `
    <div class="auth-actions">
      <button type="button" class="button button-primary" data-auth-nav="signup">Opret konto</button>
      <button type="button" class="button button-secondary" data-auth-nav="login">Log ind</button>
    </div>
  `;
}

export function createAuthView(rootElement, { page = 'welcome', message = '' } = {}) {
  if (!rootElement) {
    throw new Error('Root element is required.');
  }

  rootElement.innerHTML = `
    <section class="auth-shell" aria-label="Konto og login">
      <header class="card">
        <h1 class="app-title">🌟 Opgavehelte</h1>
        <p class="app-subtitle">Sikker cloud sync for familiens opgaver.</p>
      </header>
      <section class="card" data-auth-page="${page}">
        <h2 class="section-title">${authPageHeading(page)}</h2>
        <p class="app-subtitle auth-subtitle">${authPageSubheading(page)}</p>
        <p id="auth-feedback" class="feedback" role="status" aria-live="polite">${message}</p>
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
