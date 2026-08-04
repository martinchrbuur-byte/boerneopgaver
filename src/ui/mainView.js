import { renderIcon, renderIconText } from '../shared/iconRegistry.js';
import { escapeHtml } from '../shared/htmlSanitizer.js';

export function createMainView(rootElement) {
  if (!rootElement) {
    throw new Error('Root element is required.');
  }

  rootElement.innerHTML = `
    <section class="app-shell" aria-label="Børnenes opgaveskema">
      <header id="app-header-card" class="card app-header-card">
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

      <section id="app-mode-card" class="card app-mode-card app-top-card" aria-label="Hovedvisning">
        <h2 class="section-title">Hovedvisning</h2>
        <div id="mode-switch" class="role-switch" role="group" aria-label="Vælg hovedvisning">
          <button type="button" class="button button-secondary" data-mode="chores" aria-pressed="true">
            Opgaver
          </button>
        </div>
      </section>

      <div id="chores-workspace">

      <section id="kid-dashboard" class="kid-dashboard" aria-label="Dagens heltemission" hidden>
        <div class="kid-dashboard-header">
          <div>
            <p class="kid-eyebrow">Dagens heltemission</p>
            <h2 id="kid-dashboard-title" class="kid-dashboard-title"></h2>
          </div>
          <button id="kid-parent-exit" type="button" class="button button-secondary kid-parent-exit">Forældre</button>
        </div>
        <div class="kid-role-switch" role="group" aria-label="Skift barn">
          <span class="kid-role-switch-label">Skift helt:</span>
          <button type="button" class="button button-secondary" data-kid-role="Hans Jørgen">${renderIconText('kidHans', 'Hans Jørgen')}</button>
          <button type="button" class="button button-secondary" data-kid-role="Andrea">${renderIconText('kidAndrea', 'Andrea')}</button>
        </div>
        <div class="kid-dashboard-stats">
          <div class="kid-progress-card">
            <div class="kid-stat-heading"><span aria-hidden="true">⭐</span> Dagens mål</div>
            <strong id="kid-progress-label" class="kid-progress-label" aria-live="polite"></strong>
            <div class="kid-progress-track" role="progressbar" aria-label="Dagens opgaver" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0">
              <span id="kid-progress-fill" class="kid-progress-fill"></span>
            </div>
          </div>
          <div class="kid-treasure-card">
            <div class="kid-stat-heading">${renderIcon('coin')} <span>Skattekiste</span></div>
            <strong id="kid-treasure-label" class="kid-treasure-label" aria-live="polite"></strong>
            <span id="kid-level-label" class="kid-level-label"></span>
          </div>
        </div>
      </section>

      <section id="app-role-card" class="card app-role-card app-top-card" aria-label="Rolleskift">
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

      <section id="app-status-card" class="card app-status-card app-top-card" aria-label="Status">
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

      <nav class="tab-nav app-tab-nav" role="tablist" aria-label="Sektioner">
        <button class="tab-btn tab-active" role="tab" data-tab="opgaver" aria-selected="true">${renderIconText('tabChores', 'Opgaver')}</button>
        <button class="tab-btn tab-parent-only" role="tab" data-tab="periode" aria-selected="false">${renderIconText('tabPeriod', 'Periode')}</button>
        <button class="tab-btn tab-parent-only" role="tab" data-tab="feedback" aria-selected="false">${renderIconText('tabFeedback', 'Feedback')}</button>
        <button class="tab-btn tab-parent-only" role="tab" data-tab="historik" aria-selected="false">${renderIconText('tabHistory', 'Historik')}</button>
      </nav>

      <div id="tab-opgaver" class="tab-panel tab-panel-chores" role="tabpanel">
        <section id="checklist-panel" class="card checklist-panel" aria-label="Daglig checklist"></section>
        <div id="roulette-panel"></div>
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
            <div id="kid-chore-pagination" class="kid-pagination" hidden>
              <button id="kid-chore-prev-btn" class="button button-secondary" type="button">Forrige</button>
              <p id="kid-chore-page-label" class="chore-meta" aria-live="polite"></p>
              <button id="kid-chore-next-btn" class="button button-secondary" type="button">Næste</button>
            </div>
          </section>

          <section id="recent-completions-card" class="card recent-completions-card" aria-label="Seneste fuldføringer">
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

      <div
        id="screensaver-overlay"
        class="screensaver-overlay"
        role="status"
        aria-live="polite"
        aria-label="Helteskærm. Tryk eller tast for at vågne."
        hidden
      >
        <div class="screensaver-scene" aria-hidden="true">
          <div class="scene-art scene-cave-quest">
            <svg class="scene-canvas" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice" aria-label="Ridderen finder en grøn drage og en skat i en hule">
              <defs>
                <linearGradient id="cave-background" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stop-color="#171a38" />
                  <stop offset="0.62" stop-color="#49305b" />
                  <stop offset="0.63" stop-color="#8a564b" />
                  <stop offset="1" stop-color="#e1a05b" />
                </linearGradient>
                <linearGradient id="cave-crystal" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stop-color="#f0c4ff" />
                  <stop offset="0.5" stop-color="#a761dc" />
                  <stop offset="1" stop-color="#5e73ce" />
                </linearGradient>
                <linearGradient id="cave-dragon" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stop-color="#b2ee36" />
                  <stop offset="1" stop-color="#4abf39" />
                </linearGradient>
                <filter id="cave-glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="8" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              <rect width="1200" height="700" fill="url(#cave-background)" />
              <path class="svg-cave-ceiling" d="M0 0H1200V155L1140 132 1085 190 1015 140 940 215 865 145 790 198 715 124 650 180 570 115 505 175 425 126 350 204 275 146 195 190 110 120 0 175Z" fill="#262043" />
              <path d="M0 540C160 492 300 520 440 492S720 478 860 515s240 12 340-25V700H0Z" fill="#b77450" opacity=".75" />
              <path d="M0 610C190 575 350 620 515 590s340-25 500 5 100 10 185-6V700H0Z" fill="#e1a05b" />
              <g class="svg-cave-crystal" filter="url(#cave-glow)">
                <path d="M116 548 148 370 190 548Z" fill="url(#cave-crystal)" stroke="#27234a" stroke-width="10" />
                <path d="M170 550 200 416 234 550Z" fill="#6db8ed" stroke="#27234a" stroke-width="10" />
                <path d="M1040 540 1070 355 1115 540Z" fill="url(#cave-crystal)" stroke="#27234a" stroke-width="10" />
              </g>
              <g class="svg-cave-bat" fill="#17152e">
                <path d="M510 206 542 226 558 205 573 226 608 208 588 252 558 239 528 252Z" />
                <path d="M790 280 816 294 828 276 842 294 870 280 851 317 828 308 804 318Z" opacity=".7" />
              </g>
              <g class="svg-chest" transform="translate(875 475)">
                <path d="M0 48Q78 0 156 48V116H0Z" fill="#f3b741" stroke="#4b2b3b" stroke-width="12" />
                <rect y="48" width="156" height="78" rx="8" fill="#cf7538" stroke="#4b2b3b" stroke-width="12" />
                <rect x="68" y="75" width="22" height="31" rx="4" fill="#ffef9d" stroke="#4b2b3b" stroke-width="7" />
                <circle class="svg-chest-spark" cx="30" cy="18" r="9" fill="#fff3a8" />
                <circle class="svg-chest-spark" cx="126" cy="6" r="7" fill="#fff3a8" />
              </g>
              <g class="svg-knight" transform="translate(205 280)">
                <g class="svg-knight-motion">
                  <ellipse class="svg-shadow" cx="85" cy="360" rx="92" ry="18" />
                  <path d="M32 160 6 208 30 332 95 300 120 176Z" fill="#e44355" stroke="#252448" stroke-width="11" />
                  <rect x="43" y="150" width="82" height="130" rx="14" fill="#a9c9db" stroke="#252448" stroke-width="11" />
                  <path d="M43 197H125M72 155V276M98 155V276" fill="none" stroke="#6a8ba8" stroke-width="10" />
                  <rect x="38" y="111" width="96" height="57" rx="20" fill="#dcebf1" stroke="#252448" stroke-width="11" />
                  <path d="M42 142H132M64 112V166M91 112V166M116 112V166" fill="none" stroke="#7897ae" stroke-width="9" />
                  <path d="M75 99 92 61 113 101Z" fill="#ef4553" stroke="#252448" stroke-width="9" />
                  <circle cx="68" cy="195" r="8" fill="#252448" /><circle cx="102" cy="195" r="8" fill="#252448" />
                  <path d="M118 193 172 164" fill="none" stroke="#ffd18b" stroke-width="25" stroke-linecap="round" />
                  <path d="M165 170 224 66" fill="none" stroke="#f8fbff" stroke-width="13" stroke-linecap="round" />
                  <path d="M149 193 183 205" fill="none" stroke="#b97a35" stroke-width="13" stroke-linecap="round" />
                  <path d="M16 205 2 275 57 302 76 241Z" fill="#ef8d3b" stroke="#252448" stroke-width="11" />
                  <path d="M58 280 51 350M105 278 119 350" fill="none" stroke="#252448" stroke-width="25" stroke-linecap="round" />
                </g>
              </g>
              <g class="svg-dragon svg-dragon-green" transform="translate(590 300)">
                <g class="svg-dragon-motion">
                  <ellipse class="svg-shadow" cx="153" cy="270" rx="128" ry="17" />
                  <path d="M75 194C20 206 4 252 52 259L120 235" fill="none" stroke="#2d7441" stroke-width="35" stroke-linecap="round" />
                  <ellipse cx="153" cy="174" rx="119" ry="72" fill="url(#cave-dragon)" stroke="#252448" stroke-width="12" />
                  <path class="svg-dragon-wing svg-wing-left" d="M90 129 48 30 124 79 162 20 181 137Z" fill="#9be734" stroke="#252448" stroke-width="12" />
                  <path class="svg-dragon-wing svg-wing-right" d="M160 130 196 28 226 88 274 55 246 159Z" fill="#87d72e" stroke="#252448" stroke-width="12" />
                  <circle cx="245" cy="139" r="58" fill="#76cf2d" stroke="#252448" stroke-width="12" />
                  <path d="M268 142 329 161 273 179Z" fill="#4aa93a" stroke="#252448" stroke-width="10" />
                  <path d="M214 91 227 50 248 94M255 90 278 59 279 106" fill="#ffe173" stroke="#252448" stroke-width="9" />
                  <circle cx="247" cy="130" r="10" fill="#252448" /><circle cx="249" cy="126" r="3" fill="#fff" />
                  <circle cx="294" cy="174" r="14" fill="#f5899b" opacity=".8" />
                  <path d="M88 222 82 265M177 230 181 268" fill="none" stroke="#288e3b" stroke-width="25" stroke-linecap="round" />
                  <path d="M117 165 121 195M208 166 212 195" fill="none" stroke="#d6f36f" stroke-width="15" stroke-linecap="round" opacity=".85" />
                </g>
              </g>
            </svg>
          </div>

          <div class="scene-art scene-wizard-dragon">
            <svg class="scene-canvas" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice" aria-label="En troldmand møder en rød drage under en blå himmel">
              <defs>
                <linearGradient id="wizard-background" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stop-color="#28aee9" /><stop offset=".65" stop-color="#c5f4ef" /><stop offset=".66" stop-color="#6bbb4b" /><stop offset="1" stop-color="#f3c94c" />
                </linearGradient>
                <linearGradient id="wizard-dragon" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stop-color="#ff4b2f" /><stop offset="1" stop-color="#e72730" />
                </linearGradient>
                <radialGradient id="wizard-fireball"><stop offset="0" stop-color="#fff8a4" /><stop offset=".5" stop-color="#ffe022" /><stop offset="1" stop-color="#ff5337" /></radialGradient>
              </defs>
              <rect width="1200" height="700" fill="url(#wizard-background)" />
              <g class="svg-cloud svg-cloud-left" fill="#fff" opacity=".9"><path d="M70 145h195c0-39-27-60-62-60-18-40-82-38-98 5-41-7-65 22-65 55Z" /></g>
              <g class="svg-cloud svg-cloud-right" fill="#fff" opacity=".82"><path d="M780 120h180c0-32-27-52-56-48-25-35-75-22-83 15-29-3-49 14-49 33Z" /></g>
              <path d="M0 490 180 280 310 490 470 235 670 490 825 290 1035 490 1200 275V700H0Z" fill="#7aa4cf" opacity=".8" />
              <path d="M0 555 175 410 310 555 470 360 655 555 830 405 1030 555 1200 390V700H0Z" fill="#3b8dbd" opacity=".64" />
              <g class="svg-castle" transform="translate(83 265)">
                <path d="M0 220V50H55V0H112V50H170V220Z" fill="#f4dd9b" stroke="#3d3868" stroke-width="11" />
                <path d="M8 50V0H55V50M112 50V0H170V50" fill="#8066a9" stroke="#3d3868" stroke-width="11" />
                <path d="M72 220V148Q85 120 98 148V220Z" fill="#76506d" stroke="#3d3868" stroke-width="9" />
                <rect x="26" y="100" width="22" height="35" fill="#77cce2" stroke="#3d3868" stroke-width="7" /><rect x="127" y="100" width="22" height="35" fill="#77cce2" stroke="#3d3868" stroke-width="7" />
              </g>
              <path d="M0 592Q200 545 395 585T790 580 1200 558V700H0Z" fill="#f4c84e" />
              <g class="svg-wizard" transform="translate(245 300)">
                <g class="svg-wizard-motion">
                  <ellipse class="svg-shadow" cx="94" cy="316" rx="95" ry="17" />
                  <path d="M32 170 13 315H177L152 170Z" fill="#6f4eaf" stroke="#302650" stroke-width="12" />
                  <path d="M61 176 107 201 145 177" fill="none" stroke="#a182d7" stroke-width="15" />
                  <circle cx="92" cy="141" r="49" fill="#ffd18c" stroke="#302650" stroke-width="11" />
                  <path d="M26 119 70 24 172 118Z" fill="#6545a4" stroke="#302650" stroke-width="12" />
                  <path d="M33 107Q98 83 165 108L173 132Q92 113 25 132Z" fill="#f4c449" stroke="#302650" stroke-width="9" />
                  <circle cx="78" cy="145" r="7" fill="#302650" /><circle cx="110" cy="145" r="7" fill="#302650" />
                  <path d="M133 181 194 158" stroke="#ffd18c" stroke-width="24" stroke-linecap="round" />
                  <path d="M173 310 215 91" stroke="#8c522e" stroke-width="12" stroke-linecap="round" />
                  <circle class="svg-staff-orb" cx="215" cy="79" r="22" fill="#ffe030" stroke="#302650" stroke-width="9" />
                </g>
              </g>
              <g class="svg-fireball" transform="translate(560 300)"><circle r="36" fill="url(#wizard-fireball)" stroke="#ef342e" stroke-width="12" /><path d="M-55 14-88 28M50-4l34-20M-30-47-43-72" stroke="#ffdc39" stroke-width="14" stroke-linecap="round" /></g>
              <g class="svg-dragon svg-dragon-red" transform="translate(675 135)">
                <g class="svg-dragon-motion">
                  <path d="M75 197C18 215 15 255 64 263L127 232" fill="none" stroke="#a92c34" stroke-width="34" stroke-linecap="round" />
                  <ellipse cx="164" cy="172" rx="126" ry="76" fill="url(#wizard-dragon)" stroke="#252448" stroke-width="12" />
                  <path class="svg-dragon-wing svg-wing-left" d="M88 130 44 26 128 78 169 17 183 144Z" fill="#f58b31" stroke="#252448" stroke-width="12" />
                  <path class="svg-dragon-wing svg-wing-right" d="M172 131 218 32 244 91 298 58 254 164Z" fill="#f58b31" stroke="#252448" stroke-width="12" />
                  <circle cx="260" cy="139" r="60" fill="#f03d2d" stroke="#252448" stroke-width="12" />
                  <path d="M281 146 340 165 281 184Z" fill="#c72e31" stroke="#252448" stroke-width="10" />
                  <path d="M230 90 244 47 266 94M272 90 296 58 296 106" fill="#ffd34b" stroke="#252448" stroke-width="9" />
                  <circle cx="262" cy="131" r="10" fill="#252448" /><circle cx="265" cy="127" r="3" fill="#fff" />
                  <circle cx="309" cy="177" r="14" fill="#ff8990" opacity=".8" />
                  <path d="M103 225 100 264M192 229 196 267" stroke="#ad2936" stroke-width="25" stroke-linecap="round" />
                  <path class="svg-flame" d="M337 169Q390 141 370 181 394 175 352 210Z" fill="#ffe033" stroke="#ef342e" stroke-width="8" />
                </g>
              </g>
            </svg>
          </div>

          <div class="scene-art scene-slime-forest">
            <svg class="scene-canvas" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice" aria-label="En bueskytte sigter på en blå slime i en grøn skov">
              <defs>
                <linearGradient id="slime-background" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#43bce9" /><stop offset=".62" stop-color="#c5f4ee" /><stop offset=".63" stop-color="#7bca49" /><stop offset="1" stop-color="#c7e54c" /></linearGradient>
                <linearGradient id="slime-body" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5de1f2" /><stop offset=".55" stop-color="#18aee2" /><stop offset="1" stop-color="#177aca" /></linearGradient>
              </defs>
              <rect width="1200" height="700" fill="url(#slime-background)" />
              <g class="svg-forest-tree svg-tree-left"><rect x="118" y="220" width="64" height="320" rx="18" fill="#87502d" stroke="#2d4b4d" stroke-width="11" /><path d="M20 290Q130 112 279 286L231 370H65Z" fill="#67be36" stroke="#2d4b4d" stroke-width="12" /><path d="M48 233Q126 112 221 230" fill="none" stroke="#91d743" stroke-width="32" stroke-linecap="round" /></g>
              <g class="svg-forest-tree svg-tree-right"><rect x="1012" y="226" width="64" height="310" rx="18" fill="#87502d" stroke="#2d4b4d" stroke-width="11" /><path d="M913 294Q1021 104 1177 286L1125 370H955Z" fill="#5aac37" stroke="#2d4b4d" stroke-width="12" /><path d="M941 233Q1020 112 1119 230" fill="none" stroke="#8bd443" stroke-width="32" stroke-linecap="round" /></g>
              <path d="M0 540Q180 436 355 510T705 488 1200 450V700H0Z" fill="#4aa95b" />
              <path d="M0 600Q170 530 337 585T704 564 1200 520V700H0Z" fill="#a9d94b" />
              <g class="svg-archer" transform="translate(190 300)">
                <g class="svg-archer-motion">
                  <ellipse class="svg-shadow" cx="108" cy="318" rx="95" ry="16" />
                  <path d="M44 174 30 318H171L157 174Z" fill="#549d45" stroke="#2d3155" stroke-width="12" />
                  <path d="M55 205 106 231 146 204" fill="none" stroke="#7dc35b" stroke-width="14" />
                  <path d="M76 177 126 177 154 125 45 125Z" fill="#e59b35" stroke="#2d3155" stroke-width="11" />
                  <ellipse cx="102" cy="133" rx="47" ry="42" fill="#ffd18c" stroke="#2d3155" stroke-width="10" />
                  <path d="M35 112Q104 72 177 112L175 139Q98 118 34 140Z" fill="#f3bd38" stroke="#2d3155" stroke-width="11" />
                  <path d="M78 76 109 29 141 79" fill="#f3bd38" stroke="#2d3155" stroke-width="10" />
                  <circle cx="92" cy="140" r="7" fill="#2d3155" /><circle cx="124" cy="140" r="7" fill="#2d3155" />
                  <path d="M48 191 9 229M152 193 222 167" stroke="#ffd18c" stroke-width="22" stroke-linecap="round" />
                  <path d="M184 110Q245 187 184 263" fill="none" stroke="#9a542c" stroke-width="14" />
                  <path d="M184 110Q184 187 184 263" fill="none" stroke="#fff3bc" stroke-width="6" />
                  <path class="svg-arrow" d="M121 189 273 155M273 155 246 144M273 155 253 174" fill="none" stroke="#fff3bc" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M66 305 61 355M124 305 137 355" stroke="#2d3155" stroke-width="24" stroke-linecap="round" />
                </g>
              </g>
              <g class="svg-slime" transform="translate(700 350)">
                <g class="svg-slime-motion">
                  <ellipse class="svg-shadow" cx="126" cy="242" rx="140" ry="18" />
                  <path d="M0 210Q0 65 126 49T252 210Q246 246 126 249T0 210Z" fill="url(#slime-body)" stroke="#24335e" stroke-width="12" />
                  <path d="M23 113Q61 62 112 66" fill="none" stroke="#b7f8ff" stroke-width="17" stroke-linecap="round" opacity=".6" />
                  <ellipse cx="85" cy="159" rx="13" ry="18" fill="#24335e" /><ellipse cx="167" cy="159" rx="13" ry="18" fill="#24335e" />
                  <ellipse cx="54" cy="203" rx="24" ry="11" fill="#f08fa5" opacity=".82" /><ellipse cx="198" cy="203" rx="24" ry="11" fill="#f08fa5" opacity=".82" />
                  <path d="M61 42 77 0 117 34 137 0 168 35 202 6 192 62Z" fill="#ffd83f" stroke="#24335e" stroke-width="11" />
                  <path class="svg-slime-glint" d="M222 89 232 109M233 99 213 99" stroke="#fff" stroke-width="7" stroke-linecap="round" />
                </g>
              </g>
            </svg>
          </div>

          <div class="scene-art scene-monster-friend">
            <svg class="scene-canvas" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice" aria-label="Et barn bliver venner med et lilla monster på en blomstermark">
              <defs>
                <linearGradient id="friend-background" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4bbbe7" /><stop offset=".64" stop-color="#c9f3ef" /><stop offset=".65" stop-color="#7bc652" /><stop offset="1" stop-color="#d6ea59" /></linearGradient>
                <linearGradient id="friend-monster" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a36ed0" /><stop offset="1" stop-color="#7048ae" /></linearGradient>
              </defs>
              <rect width="1200" height="700" fill="url(#friend-background)" />
              <g class="svg-cloud svg-cloud-left" fill="#fff" opacity=".86"><path d="M95 137h183c0-35-26-56-56-52-23-39-80-24-85 14-27-5-49 14-42 38Z" /></g>
              <g class="svg-cloud svg-cloud-right" fill="#fff" opacity=".76"><path d="M857 185h166c0-31-22-48-48-45-20-34-69-22-76 12-26-4-45 13-42 33Z" /></g>
              <path d="M0 535Q180 423 365 507T724 484 1200 447V700H0Z" fill="#55b953" />
              <path d="M0 604Q171 529 340 588T698 565 1200 520V700H0Z" fill="#b2dc4b" />
              <g class="svg-flower svg-flower-one" transform="translate(125 532)"><path d="M14 0v74" stroke="#3d9d4a" stroke-width="10" /><circle cx="14" cy="0" r="17" fill="#ffec70" /><circle cx="-7" cy="-3" r="14" fill="#f36a92" /><circle cx="35" cy="-3" r="14" fill="#f36a92" /></g>
              <g class="svg-flower svg-flower-two" transform="translate(1080 520)"><path d="M14 0v74" stroke="#3d9d4a" stroke-width="10" /><circle cx="14" cy="0" r="17" fill="#ffec70" /><circle cx="-7" cy="-3" r="14" fill="#f36a92" /><circle cx="35" cy="-3" r="14" fill="#f36a92" /></g>
              <g class="svg-girl" transform="translate(245 290)">
                <g class="svg-girl-motion">
                  <ellipse class="svg-shadow" cx="105" cy="328" rx="94" ry="16" />
                  <path d="M38 183 23 328H186L168 183Z" fill="#ee4e7d" stroke="#2d2d57" stroke-width="12" />
                  <path d="M68 191 113 216 153 191" fill="none" stroke="#ff7d99" stroke-width="16" />
                  <path d="M53 157Q25 111 74 73 117 40 164 76 203 111 172 161L157 210H56Z" fill="#f4b93a" stroke="#2d2d57" stroke-width="12" />
                  <ellipse cx="109" cy="139" rx="47" ry="43" fill="#ffd18c" stroke="#2d2d57" stroke-width="10" />
                  <circle cx="94" cy="145" r="7" fill="#2d2d57" /><circle cx="126" cy="145" r="7" fill="#2d2d57" />
                  <path d="M53 205 9 238M163 204 218 170" stroke="#ffd18c" stroke-width="22" stroke-linecap="round" />
                  <path d="M73 314 68 365M139 314 152 365" stroke="#2d2d57" stroke-width="24" stroke-linecap="round" />
                </g>
              </g>
              <g class="svg-monster" transform="translate(660 290)">
                <g class="svg-monster-motion">
                  <ellipse class="svg-shadow" cx="143" cy="335" rx="146" ry="18" />
                  <path d="M14 197Q13 81 143 74T273 197V291Q264 338 143 340T14 291Z" fill="url(#friend-monster)" stroke="#302450" stroke-width="12" />
                  <path d="M60 83 70 12 115 71M174 72 224 12 224 93" fill="#f7d474" stroke="#302450" stroke-width="12" stroke-linejoin="round" />
                  <path d="M18 226 0 272 49 297M268 226 287 272 240 298" fill="none" stroke="#8050b8" stroke-width="34" stroke-linecap="round" />
                  <ellipse cx="98" cy="193" rx="15" ry="20" fill="#302450" /><ellipse cx="189" cy="193" rx="15" ry="20" fill="#302450" />
                  <ellipse cx="144" cy="250" rx="31" ry="12" fill="#ef82a2" opacity=".9" />
                  <path class="svg-monster-tuft" d="M86 314Q143 349 201 314" fill="none" stroke="#bd8ce1" stroke-width="12" stroke-linecap="round" />
                </g>
              </g>
              <g class="svg-hearts" fill="#f04979" stroke="#7a3c74" stroke-width="6"><path d="M539 225C514 194 459 224 478 269L539 328 600 269C619 224 564 194 539 225Z" /><path d="M646 145C628 123 589 145 603 178L646 220 689 178C703 145 664 123 646 145Z" opacity=".82" /></g>
            </svg>
          </div>

          <div class="scene-art scene-dragon-boat">
            <svg class="scene-canvas" viewBox="0 0 1200 700" preserveAspectRatio="xMidYMid slice" aria-label="En ridder sejler med en orange drage på havet">
              <defs>
                <linearGradient id="boat-background" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#40b9e9" /><stop offset=".58" stop-color="#d0f4ef" /><stop offset=".59" stop-color="#39b5da" /><stop offset="1" stop-color="#147aa9" /></linearGradient>
                <linearGradient id="boat-dragon" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff9a2e" /><stop offset="1" stop-color="#ed5725" /></linearGradient>
              </defs>
              <rect width="1200" height="700" fill="url(#boat-background)" />
              <g class="svg-cloud svg-cloud-left" fill="#fff" opacity=".86"><path d="M110 150h190c0-37-28-56-58-52-19-39-82-30-88 12-31-4-53 17-44 40Z" /></g>
              <g class="svg-cloud svg-cloud-right" fill="#fff" opacity=".76"><path d="M862 122h164c0-29-23-48-48-44-20-32-66-21-74 13-25-4-45 12-42 31Z" /></g>
              <path d="M0 430 177 264 326 430 503 247 667 430 854 267 1035 430 1200 232V520H0Z" fill="#4e91c1" opacity=".8" />
              <path d="M0 498 200 356 334 498 518 345 683 498 864 365 1046 498 1200 332V550H0Z" fill="#277da9" opacity=".7" />
              <path class="svg-water-line svg-water-one" d="M0 574Q122 548 250 574T500 574 750 574 1000 574 1200 574" fill="none" stroke="#b7eff3" stroke-width="12" opacity=".9" />
              <path class="svg-water-line svg-water-two" d="M0 650Q122 624 250 650T500 650 750 650 1000 650 1200 650" fill="none" stroke="#6bd5e6" stroke-width="12" opacity=".7" />
              <g class="svg-boat" transform="translate(310 410)">
                <g class="svg-boat-motion">
                  <path d="M0 110H574L523 221Q489 259 428 265H135Q70 254 42 216Z" fill="#9a502f" stroke="#3a2b52" stroke-width="13" />
                  <path d="M39 136H535" stroke="#e19245" stroke-width="15" />
                  <path d="M308 132V-151" stroke="#81502f" stroke-width="15" />
                  <path d="M308-140 527-85V116L308 82Z" fill="#fff2b6" stroke="#3a2b52" stroke-width="12" />
                  <path d="M351-130 351 91M410-112 410 101M470-96 470 109" stroke="#e5bf66" stroke-width="12" opacity=".7" />
                  <rect x="134" y="167" width="65" height="48" rx="8" fill="#f5bd42" stroke="#3a2b52" stroke-width="10" />
                  <path d="M91 115 43 50M103 115 55 50" stroke="#5f392d" stroke-width="13" stroke-linecap="round" />
                </g>
              </g>
              <g class="svg-knight svg-knight-boat" transform="translate(425 300)">
                <g class="svg-knight-motion">
                  <ellipse class="svg-shadow" cx="81" cy="280" rx="84" ry="14" />
                  <path d="M28 117 8 172 30 254 86 230 105 128Z" fill="#e44355" stroke="#252448" stroke-width="10" />
                  <rect x="39" y="112" width="77" height="103" rx="13" fill="#a9c9db" stroke="#252448" stroke-width="10" />
                  <path d="M39 149H116M64 116V210M91 116V210" fill="none" stroke="#6a8ba8" stroke-width="8" />
                  <rect x="35" y="78" width="88" height="48" rx="18" fill="#dcebf1" stroke="#252448" stroke-width="10" />
                  <path d="M38 104H121M59 80V124M84 80V124M107 80V124" fill="none" stroke="#7897ae" stroke-width="8" />
                  <path d="M67 220 60 271M103 218 116 271" stroke="#252448" stroke-width="22" stroke-linecap="round" />
                  <path d="M110 144 159 121" stroke="#ffd18b" stroke-width="20" stroke-linecap="round" /><path d="M155 125 202 42" stroke="#f8fbff" stroke-width="11" stroke-linecap="round" />
                  <path d="M5 145 0 202 45 224 61 176Z" fill="#ef8d3b" stroke="#252448" stroke-width="10" />
                </g>
              </g>
              <g class="svg-dragon svg-dragon-orange" transform="translate(750 300)">
                <g class="svg-dragon-motion">
                  <path d="M72 193C21 207 11 245 56 254L116 231" fill="none" stroke="#c54a27" stroke-width="31" stroke-linecap="round" />
                  <ellipse cx="147" cy="174" rx="111" ry="67" fill="url(#boat-dragon)" stroke="#252448" stroke-width="11" />
                  <path class="svg-dragon-wing svg-wing-left" d="M85 127 43 32 122 77 158 22 177 136Z" fill="#ffc33f" stroke="#252448" stroke-width="11" />
                  <path class="svg-dragon-wing svg-wing-right" d="M151 127 188 28 221 84 263 55 237 151Z" fill="#ffc33f" stroke="#252448" stroke-width="11" />
                  <circle cx="231" cy="138" r="53" fill="#f47a22" stroke="#252448" stroke-width="11" />
                  <path d="M249 147 302 162 250 181Z" fill="#cf4b25" stroke="#252448" stroke-width="9" />
                  <path d="M205 91 218 50 239 93M244 90 265 59 266 104" fill="#ffe176" stroke="#252448" stroke-width="8" />
                  <circle cx="232" cy="130" r="9" fill="#252448" /><circle cx="235" cy="126" r="3" fill="#fff" /><circle cx="274" cy="171" r="12" fill="#f68187" opacity=".85" />
                  <path d="M92 219 88 254M169 223 172 257" stroke="#c04823" stroke-width="23" stroke-linecap="round" />
                </g>
              </g>
            </svg>
          </div>

          <div class="screensaver-pixel-message">
            <span class="screensaver-message-cave">Skatten venter i hulen!</span>
            <span class="screensaver-message-wizard">Magi og drager på eventyr!</span>
            <span class="screensaver-message-slime">Sigt efter stjernerne!</span>
            <span class="screensaver-message-monster">Venner gør hjertet stort!</span>
            <span class="screensaver-message-boat">Sejl med dragevennen!</span>
          </div>
        </div>
        <button id="screensaver-wake" class="screensaver-wake" type="button">Tryk for at vågne</button>
      </div>

      <button id="mute-toggle" type="button" class="mute-toggle-btn" aria-label="Slå lyd fra" title="Lyd til/fra">
      </button>

      </div>

    </section>
  `;

  return {
    appShell: rootElement.querySelector('.app-shell'),
    appHeaderCard: rootElement.querySelector('#app-header-card'),
    appModeCard: rootElement.querySelector('#app-mode-card'),
    appRoleCard: rootElement.querySelector('#app-role-card'),
    appStatusCard: rootElement.querySelector('#app-status-card'),
    modeSwitch: rootElement.querySelector('#mode-switch'),
    choresWorkspace: rootElement.querySelector('#chores-workspace'),
    kidDashboard: rootElement.querySelector('#kid-dashboard'),
    kidDashboardTitle: rootElement.querySelector('#kid-dashboard-title'),
    kidProgressLabel: rootElement.querySelector('#kid-progress-label'),
    kidProgressTrack: rootElement.querySelector('.kid-progress-track'),
    kidProgressFill: rootElement.querySelector('#kid-progress-fill'),
    kidTreasureLabel: rootElement.querySelector('#kid-treasure-label'),
    kidLevelLabel: rootElement.querySelector('#kid-level-label'),
    kidParentExit: rootElement.querySelector('#kid-parent-exit'),
    kidRoleSwitch: rootElement.querySelector('.kid-role-switch'),
    roleSwitch: rootElement.querySelector('#role-switch'),
    addChoreForm: rootElement.querySelector('#add-chore-form'),
    addChoreSection: rootElement.querySelector('#add-chore-section'),
    checklistPanel: rootElement.querySelector('#checklist-panel'),
    roulettePanel: rootElement.querySelector('#roulette-panel'),
    choreNameInput: rootElement.querySelector('#chore-name-input'),
    choreValueInput: rootElement.querySelector('#chore-value-input'),
    choreList: rootElement.querySelector('#chore-list'),
    kidChorePagination: rootElement.querySelector('#kid-chore-pagination'),
    kidChorePrevButton: rootElement.querySelector('#kid-chore-prev-btn'),
    kidChoreNextButton: rootElement.querySelector('#kid-chore-next-btn'),
    kidChorePageLabel: rootElement.querySelector('#kid-chore-page-label'),
    recentCompletionsCard: rootElement.querySelector('#recent-completions-card'),
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
    screensaverOverlay: rootElement.querySelector('#screensaver-overlay'),
    screensaverWake: rootElement.querySelector('#screensaver-wake'),
    muteToggle: rootElement.querySelector('#mute-toggle'),
    statusText: rootElement.querySelector('#status-text'),
    moneySliderGroup: rootElement.querySelector('#money-slider-group'),
    statusRow: rootElement.querySelector('#status-row'),
    walletIcon: rootElement.querySelector('#wallet-icon'),
    coinIcon: rootElement.querySelector('#coin-icon'),
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
