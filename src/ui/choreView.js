import { isSameLocalDay, toDateTimeLabel } from '../shared/dateTime.js';

function renderChoreList(chores, activeRole) {
  // Filter chores based on active role (kids only see their own chores)
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

export function renderState(viewRefs, state, { activeRole }) {
  const roleLabel = activeRole === 'parent' ? 'Forældretilstand' : `${activeRole}s visning`;
  const statusText = document.querySelector('#status-text');
  const progressSlider = document.querySelector('#progress-slider');
  const sliderCount = document.querySelector('#slider-count');
  const coinIcon = document.querySelector('#coin-icon');
  
  // Calculate counts based on active role
  let totalChores = state.totalChores;
  let doneTodayCount = state.doneTodayCount;
  
  if (activeRole !== 'parent') {
    // Filter chores for specific kid
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
  
  // Show coin with animation when all tasks are done
  if (coinIcon) {
    const allTasksDone = totalChores > 0 && doneTodayCount === totalChores;
    
    if (allTasksDone) {
      // Only remove and re-add animation if it wasn't already showing
      if (coinIcon.hidden) {
        coinIcon.hidden = false;
        coinIcon.classList.remove('celebrate');
        // Trigger reflow to restart animation
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
}

export function renderFeedback(viewRefs, message) {
  viewRefs.feedback.textContent = message ?? '';
}
