import { isSameLocalDay, toDateTimeLabel } from '../shared/dateTime.js';

function formatMoney(value) {
  return `${value.toFixed(2)} kr`;
}

function renderChoreList(chores, activeRole) {
  const filteredChores = activeRole === 'parent'
    ? chores
    : chores.filter(chore => chore.assignedTo?.includes(activeRole));

  if (filteredChores.length === 0) {
    return '<li class="chore-item"><p class="chore-meta">Ingen opgaver endnu — tilføj en for at komme i gang.</p></li>';
  }

  return filteredChores
    .map((chore) => {
      const isKidView = activeRole !== 'parent';
      const actionButton =
        isKidView
          ? chore.isCompleted
            ? `<button class="button button-secondary" data-action="undo" data-chore-id="${chore.id}">↩️ Fortryd</button>`
            : `<button class="button button-success" data-action="complete" data-chore-id="${chore.id}">✅ Fuldfør</button>`
          : `<button class="button button-secondary" data-action="delete" data-chore-id="${chore.id}">🗑️ Slet</button>`;

      const meta = chore.isCompleted
        ? `Fuldført kl. ${toDateTimeLabel(chore.activeCompletedAt)}`
        : chore.lastCompletedAt
          ? `Sidst udført kl. ${toDateTimeLabel(chore.lastCompletedAt)}`
          : 'Ikke fuldført endnu';

      return `
        <li class="chore-item">
          <div class="chore-main">
            <h3 class="chore-title">${chore.name}</h3>
            <div class="actions">${actionButton}</div>
          </div>
          <p class="chore-meta">${meta}</p>
          <p class="chore-meta">Værdi: ${formatMoney(chore.value ?? 0)}</p>
        </li>
      `;
    })
    .join('');
}

function renderRecentCompletions(items) {
  if (items.length === 0) {
    return '<li class="chore-item"><p class="chore-meta">Ingen fuldføringer endnu.</p></li>';
  }

  return items
    .map((item) => {
      const resetText = item.undoneAt ? ` (fortrudt ${toDateTimeLabel(item.undoneAt)})` : ' (aktiv)';
      return `
        <li class="chore-item">
          <p class="chore-meta">
            ${item.choreName} fuldført ${toDateTimeLabel(item.completedAt)}${resetText}
          </p>
        </li>
      `;
    })
    .join('');
}

function renderRoleSwitch(viewRefs, activeRole) {
  const buttons = viewRefs.roleSwitch.querySelectorAll('button[data-role]');
  for (const button of buttons) {
    const buttonRole = button.getAttribute('data-role');
    button.setAttribute('aria-pressed', buttonRole === activeRole ? 'true' : 'false');
    button.classList.toggle('role-selected', buttonRole === activeRole);
  }
}

function renderTabs(viewRefs, activeTab, activeRole) {
  const isParent = activeRole === 'parent';

  for (const button of viewRefs.tabNav.querySelectorAll('.tab-btn')) {
    const tabName = button.getAttribute('data-tab');
    const isActive = tabName === activeTab;
    button.classList.toggle('tab-active', isActive);
    button.setAttribute('aria-selected', isActive ? 'true' : 'false');

    if (button.classList.contains('tab-parent-only')) {
      button.hidden = !isParent;
    }
  }

  viewRefs.tabOpgaver.hidden = activeTab !== 'opgaver';
  viewRefs.tabSprint.hidden = activeTab !== 'sprint';
  viewRefs.tabHistorik.hidden = activeTab !== 'historik' || !isParent;
}

function renderSprint(viewRefs, sprintUi, activeRole) {
  const isParent = activeRole === 'parent';

  if (!sprintUi?.activeSprint) {
    viewRefs.sprintTitle.textContent = 'Ingen aktiv sprint';
    viewRefs.sprintDates.textContent = '';
    viewRefs.sprintDaysLeft.textContent = '';
    viewRefs.sprintEarnings.innerHTML = '<p class="chore-meta">Ingen aktiv sprint fundet.</p>';
    viewRefs.sprintParentActions.hidden = true;
    return;
  }

  const { activeSprint, earnings, settings, daysLeft } = sprintUi;

  viewRefs.sprintTitle.textContent = 'Aktuel sprint';
  viewRefs.sprintDates.textContent = `${activeSprint.startDate} → ${activeSprint.endDate}`;
  viewRefs.sprintDaysLeft.textContent = `${daysLeft} dage tilbage`;

  viewRefs.sprintEarnings.innerHTML = `
    <div class="earnings-grid">
      <div class="earning-card">
        <h3>👦 Hans Jørgen</h3>
        <p>${formatMoney(earnings['Hans Jørgen'] ?? 0)}</p>
      </div>
      <div class="earning-card">
        <h3>👱‍♀️ Andrea</h3>
        <p>${formatMoney(earnings.Andrea ?? 0)}</p>
      </div>
    </div>
  `;

  viewRefs.sprintParentActions.hidden = !isParent;
  if (isParent) {
    viewRefs.sprintLengthInput.value = String(settings.sprintLengthDays ?? 7);
  }
}

function renderHistory(viewRefs, history) {
  if (!history || history.length === 0) {
    viewRefs.sprintHistory.innerHTML = '<p class="chore-meta">Ingen afsluttede sprints endnu.</p>';
    return;
  }

  viewRefs.sprintHistory.innerHTML = history.map(sprint => `
    <article class="history-item">
      <h3>${sprint.startDate} → ${sprint.endDate}</h3>
      <p class="chore-meta">Betalt: ${sprint.paidAt ? toDateTimeLabel(sprint.paidAt) : 'Ukendt'}</p>
      <div class="history-earnings">
        <p>👦 Hans Jørgen: <strong>${formatMoney(sprint.earnings['Hans Jørgen'] ?? 0)}</strong></p>
        <p>👱‍♀️ Andrea: <strong>${formatMoney(sprint.earnings.Andrea ?? 0)}</strong></p>
      </div>
    </article>
  `).join('');
}

export function renderState(viewRefs, state, { activeRole, activeTab, sprintUi }) {
  const roleLabel = activeRole === 'parent' ? 'Forældretilstand' : `${activeRole}s visning`;
  const statusText = document.querySelector('#status-text');
  const progressSlider = document.querySelector('#progress-slider');
  const sliderCount = document.querySelector('#slider-count');
  const coinIcon = document.querySelector('#coin-icon');

  let totalChores = state.totalChores;
  let doneTodayCount = state.doneTodayCount;

  if (activeRole !== 'parent') {
    const kidChores = state.chores.filter(chore => chore.assignedTo?.includes(activeRole));
    totalChores = kidChores.length;
    doneTodayCount = kidChores.filter(
      chore => chore.isCompleted && chore.activeCompletedAt && isSameLocalDay(chore.activeCompletedAt)
    ).length;
  }

  if (statusText) statusText.textContent = `${roleLabel} • I dag:`;
  if (progressSlider) {
    progressSlider.max = totalChores;
    progressSlider.value = doneTodayCount;
    const fillPercent = totalChores > 0 ? (doneTodayCount / totalChores) * 100 : 0;
    progressSlider.style.setProperty('--slider-fill', `${fillPercent}%`);
  }
  if (sliderCount) sliderCount.textContent = `${doneTodayCount} ud af ${totalChores}`;

  if (coinIcon) {
    const allTasksDone = totalChores > 0 && doneTodayCount === totalChores;

    if (allTasksDone) {
      if (coinIcon.hidden) {
        coinIcon.hidden = false;
        coinIcon.classList.remove('celebrate');
        void coinIcon.offsetWidth;
        coinIcon.classList.add('celebrate');
      }
    } else {
      coinIcon.hidden = true;
      coinIcon.classList.remove('celebrate');
    }
  }

  viewRefs.addChoreSection.hidden = activeRole !== 'parent';
  viewRefs.choreList.innerHTML = renderChoreList(state.chores, activeRole);
  viewRefs.recentCompletions.innerHTML = renderRecentCompletions(state.recentCompletions);
  renderRoleSwitch(viewRefs, activeRole);
  renderTabs(viewRefs, activeTab, activeRole);
  renderSprint(viewRefs, sprintUi, activeRole);
  renderHistory(viewRefs, sprintUi?.history || []);
}

export function renderFeedback(viewRefs, message) {
  viewRefs.feedback.textContent = message ?? '';
}
