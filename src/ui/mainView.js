export function createMainView(rootElement) {
  if (!rootElement) {
    throw new Error('Root element is required.');
  }

  rootElement.innerHTML = `
    <section class="app-shell" aria-label="Børnenes opgaveskema">
      <header class="card">
        <h1 class="app-title">🌟 Opgavehelte</h1>
        <p class="app-subtitle">Fuldfør opgaver, saml sejre, og gør samarbejdet derhjemme sjovt.</p>
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
            <div class="slider-wrapper">
              <input id="progress-slider" type="range" class="progress-slider" min="0" max="0" value="0" disabled />
              <span class="slider-label"><span id="slider-count">0 ud af 0</span> færdige</span>
            </div>
          </div>
          <span id="coin-icon" class="coin-icon" title="Optjente lommepenge" hidden>🪙</span>
        </div>
        <p id="feedback" class="feedback" role="status" aria-live="polite"></p>
      </section>

      <section id="add-chore-section" class="card" aria-label="Tilføj opgave">
        <h2 class="section-title">Tilføj en opgave</h2>
        <form id="add-chore-form">
          <div class="form-row">
            <input
              id="chore-name-input"
              class="input"
              name="choreName"
              type="text"
              placeholder="f.eks. Giv katten mad"
              maxlength="80"
              required
            />
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
        </form>
      </section>

      <section class="card" aria-label="Opgaveliste">
        <h2 class="section-title">Opgaver</h2>
        <ul id="chore-list" class="list"></ul>
      </section>

      <section class="card" aria-label="Seneste fuldføringer">
        <h2 class="section-title">Seneste fuldføringer</h2>
        <ul id="recent-completions" class="list"></ul>
      </section>
    </section>
  `;

  return {
    roleSwitch: rootElement.querySelector('#role-switch'),
    addChoreForm: rootElement.querySelector('#add-chore-form'),
    addChoreSection: rootElement.querySelector('#add-chore-section'),
    choreNameInput: rootElement.querySelector('#chore-name-input'),
    choreList: rootElement.querySelector('#chore-list'),
    recentCompletions: rootElement.querySelector('#recent-completions'),
    feedback: rootElement.querySelector('#feedback')
  };
}
