import { isSameLocalDay, toDateTimeLabel } from '../shared/dateTime.js';

const MASCOT_MAP = Object.freeze({
  'Hans Jørgen': '🦕',
  'Andrea': '🦄',
  'parent': '🎉'
});

const BOTH_KIDS = ['Hans Jørgen', 'Andrea'];

function formatMoney(value) {
  return `${value.toFixed(2)} kr`;
}

function renderChoreList(chores, activeRole, pendingCollaborations = []) {
  const filteredChores = activeRole === 'parent'
    ? chores
    : chores.filter(chore => chore.assignedTo?.includes(activeRole));

  if (filteredChores.length === 0) {
    return '<li class="chore-item"><p class="chore-meta">Ingen opgaver endnu — tilføj en for at komme i gang.</p></li>';
  }

  return filteredChores
    .map((chore) => {
      const isKidView = activeRole !== 'parent';
      const maxPerSprint = chore.maxPerSprint ?? 1;
      const sprintCount = chore.sprintCompletionCount ?? 0;
      const isFullyDone = chore.isFullyDone ?? false;

      // Repeat badge: only show when maxPerSprint > 1 or when limit reached
      const repeatBadge = maxPerSprint > 1
        ? `<span class="repeat-badge">${sprintCount}/${maxPerSprint} gange</span>`
        : (maxPerSprint === 0 && sprintCount > 0 ? `<span class="repeat-badge">${sprintCount}× gjort</span>` : '');

      // Collab logic
      const isBothKidsChore = BOTH_KIDS.every(k => chore.assignedTo?.includes(k));
      const pendingCollab = pendingCollaborations.find(c => c.choreId === chore.id);
      const isProposer = pendingCollab?.proposedBy === activeRole;

      let actionButtons = '';
      if (isKidView) {
        if (isFullyDone) {
          actionButtons = `<button class="button button-secondary" data-action="undo" data-chore-id="${chore.id}">↩️ Fortryd</button>`;
        } else {
          actionButtons = `<button class="button button-success" data-action="complete" data-chore-id="${chore.id}">✅ Fuldfør</button>`;

          // Collab button: show for chores assigned to both kids, no pending collab, not done
          if (isBothKidsChore && !pendingCollab) {
            actionButtons += ` <button class="button button-collab" data-action="propose-collab" data-chore-id="${chore.id}">🤝 Gør det sammen</button>`;
          }

          // Undo button when partial completions exist
          if (sprintCount > 0) {
            actionButtons += ` <button class="button button-secondary" data-action="undo" data-chore-id="${chore.id}">↩️ Fortryd</button>`;
          }
        }

        // Show pending collab state
        if (pendingCollab) {
          if (isProposer) {
            actionButtons += ` <span class="collab-pending-badge">⏳ Venter på den anden…</span>`;
          } else {
            actionButtons = `
              <button class="button button-success" data-action="accept-collab" data-collab-id="${pendingCollab.id}">✅ Acceptér samarbejde</button>
              <button class="button button-secondary" data-action="decline-collab" data-collab-id="${pendingCollab.id}">❌ Afvis</button>
            `;
          }
        }
      } else {
        actionButtons = `<button class="button button-secondary" data-action="delete" data-chore-id="${chore.id}">🗑️ Slet</button>`;
      }

      const meta = chore.isCompleted
        ? `Fuldført kl. ${toDateTimeLabel(chore.activeCompletedAt)}`
        : chore.lastCompletedAt
          ? `Sidst udført kl. ${toDateTimeLabel(chore.lastCompletedAt)}`
          : 'Ikke fuldført endnu';

      const valueText = maxPerSprint > 0
        ? `${formatMoney(chore.value ?? 0)} × op til ${maxPerSprint === 0 ? '∞' : maxPerSprint} gange`
        : `${formatMoney(chore.value ?? 0)} pr. gang`;

      return `
        <li class="chore-item${isFullyDone ? ' chore-fully-done' : ''}">
          <div class="chore-main">
            <div class="chore-title-row">
              <h3 class="chore-title">${chore.name}</h3>
              ${repeatBadge}
            </div>
            <div class="actions">${actionButtons}</div>
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

export function renderCollabInbox(viewRefs, pendingCollaborations, activeRole, chores) {
  if (!viewRefs.collabInbox) return;

  // Show incoming proposals for the current kid (proposed by someone else)
  const incoming = pendingCollaborations.filter(
    c => c.proposedBy !== activeRole && activeRole !== 'parent'
  );

  if (incoming.length === 0) {
    viewRefs.collabInbox.hidden = true;
    viewRefs.collabInbox.innerHTML = '';
    return;
  }

  const choreMap = new Map((chores ?? []).map(c => [c.id, c]));
  viewRefs.collabInbox.hidden = false;
  viewRefs.collabInbox.innerHTML = `
    <div class="collab-inbox-card">
      <h3 class="collab-inbox-title">🤝 Samarbejdsforslag</h3>
      ${incoming.map(collab => {
        const chore = choreMap.get(collab.choreId);
        const choreName = chore ? chore.name : 'Ukendt opgave';
        const proposerEmoji = MASCOT_MAP[collab.proposedBy] ?? '👤';
        return `
          <div class="collab-proposal">
            <p>${proposerEmoji} <strong>${collab.proposedBy}</strong> vil gøre <strong>${choreName}</strong> sammen med dig!</p>
            <div class="actions">
              <button class="button button-success" data-action="accept-collab" data-collab-id="${collab.id}">✅ Gør det sammen!</button>
              <button class="button button-secondary" data-action="decline-collab" data-collab-id="${collab.id}">❌ Nej tak</button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

let mascotTimer = null;

export function showMascot(mascotOverlay, activeRole, message, { type = 'pop', duration = 2500 } = {}) {
  if (!mascotOverlay) return;

  const emoji = MASCOT_MAP[activeRole] ?? '⭐';
  const emojiEl = mascotOverlay.querySelector('.mascot-emoji');
  const messageEl = mascotOverlay.querySelector('.mascot-message');

  if (emojiEl) emojiEl.textContent = emoji;
  if (messageEl) messageEl.textContent = message;

  // Remove all animation classes
  mascotOverlay.classList.remove('mascot-pop', 'mascot-celebrate', 'mascot-collab', 'mascot-confetti');
  void mascotOverlay.offsetWidth; // reflow to restart animation
  mascotOverlay.classList.add(`mascot-${type}`);
  mascotOverlay.hidden = false;

  if (mascotTimer) clearTimeout(mascotTimer);
  mascotTimer = setTimeout(() => {
    mascotOverlay.hidden = true;
    mascotTimer = null;
  }, duration);
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
  viewRefs.choreList.innerHTML = renderChoreList(state.chores, activeRole, state.pendingCollaborations ?? []);
  viewRefs.recentCompletions.innerHTML = renderRecentCompletions(state.recentCompletions);
  renderRoleSwitch(viewRefs, activeRole);
  renderTabs(viewRefs, activeTab, activeRole);
  renderSprint(viewRefs, sprintUi, activeRole);
  renderHistory(viewRefs, sprintUi?.history || []);
  renderCollabInbox(viewRefs, state.pendingCollaborations ?? [], activeRole, state.chores);
}

export function renderFeedback(viewRefs, message) {
  viewRefs.feedback.textContent = message ?? '';
}
