import { toDateTimeLabel } from '../shared/dateTime.js';
import { getChoreVisual } from '../shared/choreMarker.js';
import { getIconSvgMarkup, renderIcon, renderIconText, setElementIcon } from '../shared/iconRegistry.js';

const MASCOT_MAP = Object.freeze({
  'Hans Jørgen': 'trophy',
  'Andrea': 'heart',
  'parent': 'party'
});

const MASCOT_ICON_SETS = Object.freeze({
  'Andrea': [
    'heart', 'flower', 'gift', 'diamond', 'rainbow', 'magic'
  ],
  'Hans Jørgen': [
    'rocket', 'target', 'trophy', 'build', 'ball', 'idea'
  ]
});

const lastMascotIconByRole = {
  'Andrea': null,
  'Hans Jørgen': null
};

const BOTH_KIDS = ['Hans Jørgen', 'Andrea'];

function getNextMascotIcon(role) {
  const iconSet = MASCOT_ICON_SETS[role] ?? [];
  if (iconSet.length === 0) return 'star';

  const available = iconSet.filter(iconKey => iconKey !== lastMascotIconByRole[role]);
  const nextIcon = available[Math.floor(Math.random() * available.length)];

  lastMascotIconByRole[role] = nextIcon;
  return nextIcon;
}

function formatMoney(value) {
  return `${value.toFixed(2)} kr`;
}

function formatFeedbackCategory(category) {
  switch (category) {
    case 'bug':
      return 'Fejl';
    case 'idea':
      return 'Idé';
    case 'quality':
      return 'Forbedring';
    case 'question':
      return 'Spørgsmål';
    default:
      return 'Generelt';
  }
}

function asMoneyValue(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

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

function renderEmptyChoreItem(text) {
  return `<li class="chore-item"><p class="chore-meta">${text}</p></li>`;
}

function renderCollabDecisionButtons(collabId, acceptText = 'Acceptér samarbejde', declineText = 'Afvis') {
  return `
    <button class="button button-success" data-action="accept-collab" data-collab-id="${collabId}">${renderIconText('check', acceptText)}</button>
    <button class="button button-secondary" data-action="decline-collab" data-collab-id="${collabId}">${renderIconText('cancel', declineText)}</button>
  `;
}

function renderEditAssigneeCheckboxes(choreId, selectedKids = []) {
  const selected = new Set(Array.isArray(selectedKids) ? selectedKids : []);

  return BOTH_KIDS.map((kid) => `
    <label class="checkbox-label">
      <input
        type="checkbox"
        data-edit-field="assignedTo"
        data-chore-id="${choreId}"
        data-kid="${kid}"
        ${selected.has(kid) ? 'checked' : ''}
      /> ${kid}
    </label>
  `).join('');
}

function renderParentEditFields(chore, draft) {
  return `
    <div class="chore-edit-fields">
      <div class="form-row form-row-3">
        <input
          class="input"
          type="text"
          maxlength="80"
          data-edit-field="name"
          data-chore-id="${chore.id}"
          value="${escapeAttribute(draft.name)}"
        />
        <div class="value-input-wrapper">
          <input
            class="input input-narrow"
            type="number"
            min="0"
            step="0.5"
            data-edit-field="value"
            data-chore-id="${chore.id}"
            value="${escapeAttribute(draft.value)}"
          />
          <span class="value-unit">kr</span>
        </div>
        <input
          class="input input-narrow"
          type="number"
          min="0"
          data-edit-field="maxPerPeriod"
          data-chore-id="${chore.id}"
          value="${escapeAttribute(draft.maxPerPeriod)}"
        />
      </div>
      <div class="assign-to-section">
        <span class="assign-label">Tildelt til</span>
        <div class="assign-checkboxes">
          ${renderEditAssigneeCheckboxes(chore.id, draft.assignedTo)}
        </div>
      </div>
      <div class="actions">
        <button class="button button-success" data-action="save-edit" data-chore-id="${chore.id}">${renderIconText('save', 'Gem')}</button>
        <button class="button button-secondary" data-action="cancel-edit" data-chore-id="${chore.id}">${renderIconText('cancel', 'Annuller')}</button>
      </div>
    </div>
  `;
}

function renderChoreMarker(choreName) {
  const visual = getChoreVisual(choreName);
  return `<span class="chore-marker" role="img" aria-label="${escapeAttribute(visual.label)} opgave" data-icon-key="${escapeAttribute(visual.iconKey)}">${getIconSvgMarkup(visual.iconKey)}</span>`;
}

function renderMoneySliders(viewRefs, activeRole, periodUi) {
  const statusText = viewRefs.statusText;
  const sliderGroup = viewRefs.moneySliderGroup;
  const coinIcon = viewRefs.coinIcon;
  const moneyProgress = periodUi?.moneyProgress;
  const byKid = moneyProgress?.byKid ?? {};
  const total = moneyProgress?.total ?? { earned: 0, target: 0 };

  const entries = activeRole === 'parent'
    ? [
      { label: 'Samlet', earned: asMoneyValue(total.earned), target: asMoneyValue(total.target) },
      {
        label: 'Hans Jørgen',
        earned: asMoneyValue(byKid['Hans Jørgen']?.earned),
        target: asMoneyValue(byKid['Hans Jørgen']?.target)
      },
      {
        label: 'Andrea',
        earned: asMoneyValue(byKid.Andrea?.earned),
        target: asMoneyValue(byKid.Andrea?.target)
      }
    ]
    : [
      {
        label: activeRole,
        earned: asMoneyValue(byKid[activeRole]?.earned),
        target: asMoneyValue(byKid[activeRole]?.target)
      }
    ];

  if (statusText) {
    const roleLabel = activeRole === 'parent' ? 'Forældretilstand' : `${activeRole}s visning`;
    statusText.textContent = `${roleLabel} • Periodemål:`;
  }

  if (sliderGroup) {
    sliderGroup.innerHTML = entries.map((entry) => {
      const sliderMax = Math.max(1, entry.target);
      const sliderValue = Math.min(entry.earned, sliderMax);
      const fillPercent = sliderMax > 0 ? (sliderValue / sliderMax) * 100 : 0;

      return `
        <div class="money-slider-item">
          <p class="money-slider-title">${entry.label}</p>
          <div class="slider-wrapper">
            <input
              type="range"
              class="progress-slider"
              min="0"
              max="${sliderMax}"
              value="${sliderValue}"
              disabled
              style="--slider-fill:${fillPercent}%"
            />
            <span class="slider-label"><span class="money-slider-count">${formatMoney(entry.earned)} / ${formatMoney(entry.target)}</span></span>
          </div>
        </div>
      `;
    }).join('');
  }

  if (coinIcon) {
    const allTargetsReached = entries.length > 0 && entries.every(entry => entry.target > 0 && entry.earned >= entry.target);
    if (allTargetsReached) {
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
}

function renderChoreList(chores, activeRole, pendingCollaborations = [], editState = null) {
  const filteredChores = activeRole === 'parent'
    ? chores
    : chores.filter(chore => chore.assignedTo?.includes(activeRole));

  if (filteredChores.length === 0) {
    return renderEmptyChoreItem('Ingen opgaver endnu — tilføj en for at komme i gang.');
  }

  return filteredChores
    .map((chore) => {
      const maxPerPeriod = chore.maxPerPeriod ?? 1;
      const periodCount = chore.periodCompletionCount ?? 0;
      const isFullyDone = chore.isFullyDone ?? false;
      const choreMarker = renderChoreMarker(chore.name);

      const repeatBadge = maxPerPeriod > 1
        ? `<span class="repeat-badge">${periodCount}/${maxPerPeriod} gange</span>`
        : (maxPerPeriod === 0 && periodCount > 0 ? `<span class="repeat-badge">${periodCount}× gjort</span>` : '');

      const isBothKidsChore = BOTH_KIDS.every(k => chore.assignedTo?.includes(k));
      const pendingCollab = pendingCollaborations.find(c => c.choreId === chore.id);
      const isProposer = pendingCollab?.proposedBy === activeRole;

      let actionButtons = '';
      if (activeRole !== 'parent') {
        if (isFullyDone) {
          actionButtons = `<button class="button button-secondary" data-action="undo" data-chore-id="${chore.id}">${renderIconText('undo', 'Fortryd')}</button>`;
        } else {
          actionButtons = `<button class="button button-success" data-action="complete" data-chore-id="${chore.id}">${renderIconText('check', 'Fuldfør')}</button>`;

          if (isBothKidsChore && !pendingCollab) {
            actionButtons += ` <button class="button button-collab" data-action="propose-collab" data-chore-id="${chore.id}">${renderIconText('collab', 'Gør det sammen')}</button>`;
          }

          if (periodCount > 0) {
            actionButtons += ` <button class="button button-secondary" data-action="undo" data-chore-id="${chore.id}">${renderIconText('undo', 'Fortryd')}</button>`;
          }
        }

        if (pendingCollab) {
          if (isProposer) {
            actionButtons += ` <span class="collab-pending-badge">${renderIconText('pending', 'Venter på den anden…')}</span>`;
          } else {
            actionButtons = renderCollabDecisionButtons(pendingCollab.id);
          }
        }
      } else {
        actionButtons = `
          <button class="button button-secondary" data-action="edit" data-chore-id="${chore.id}">${renderIconText('edit', 'Rediger')}</button>
          <button class="button button-secondary" data-action="delete" data-chore-id="${chore.id}">${renderIconText('delete', 'Slet')}</button>
        `;
      }

      const meta = chore.isCompleted
        ? `Fuldført kl. ${toDateTimeLabel(chore.activeCompletedAt)}`
        : chore.lastCompletedAt
          ? `Sidst udført kl. ${toDateTimeLabel(chore.lastCompletedAt)}`
          : 'Ikke fuldført endnu';

      const isEditing = editState?.choreId === chore.id;
      const editDraft = isEditing ? editState?.draft : null;
      const detailsMarkup = isEditing && editDraft
        ? renderParentEditFields(chore, editDraft)
        : `
          <p class="chore-meta">${meta}</p>
          <p class="chore-meta">Værdi: ${formatMoney(chore.value ?? 0)}</p>
        `;

      return `
        <li class="chore-item${isFullyDone ? ' chore-fully-done' : ''}">
          <div class="chore-main">
            <div class="chore-title-row">
              <h3 class="chore-title">${choreMarker}<span>${chore.name}</span></h3>
              ${repeatBadge}
            </div>
            <div class="actions">${actionButtons}</div>
          </div>
          ${detailsMarkup}
        </li>
      `;
    })
    .join('');
}

function renderRecentCompletions(items) {
  if (items.length === 0) {
    return renderEmptyChoreItem('Ingen fuldføringer endnu.');
  }

  return items
    .map((item) => {
      const choreMarker = renderChoreMarker(item.choreName);
      const resetText = item.undoneAt ? ` (fortrudt ${toDateTimeLabel(item.undoneAt)})` : ' (aktiv)';
      return `
        <li class="chore-item">
          <p class="chore-meta">
            ${choreMarker} ${item.choreName} fuldført ${toDateTimeLabel(item.completedAt)}${resetText}
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
      <h3 class="collab-inbox-title">${renderIconText('collab', 'Samarbejdsforslag')}</h3>
      ${incoming.map(collab => {
        const chore = choreMap.get(collab.choreId);
        const choreName = chore ? chore.name : 'Ukendt opgave';
        const choreMarker = renderChoreMarker(choreName);
        const proposerIcon = MASCOT_MAP[collab.proposedBy] ?? 'user';
        return `
          <div class="collab-proposal">
            <p>${renderIcon(proposerIcon)} <strong>${collab.proposedBy}</strong> vil gøre <strong>${choreMarker} ${choreName}</strong> sammen med dig!</p>
            <div class="actions">
              ${renderCollabDecisionButtons(collab.id, 'Gør det sammen!', 'Nej tak')}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

let mascotTimer = null;
let roleSwitchWalkTimer = null;
let walletHitTimer = null;

function clearMascotTimers() {
  if (mascotTimer) {
    clearTimeout(mascotTimer);
    mascotTimer = null;
  }

  if (roleSwitchWalkTimer) {
    clearTimeout(roleSwitchWalkTimer);
    roleSwitchWalkTimer = null;
  }
}

function resetMascotAnimations(mascotOverlay) {
  mascotOverlay.classList.remove(
    'mascot-pop',
    'mascot-celebrate',
    'mascot-collab',
    'mascot-confetti',
    'mascot-role-walk'
  );
}

function triggerWalletHit(walletIcon) {
  if (!walletIcon) {
    return;
  }

  if (walletHitTimer) {
    clearTimeout(walletHitTimer);
    walletHitTimer = null;
  }

  walletIcon.classList.remove('wallet-hit');
  void walletIcon.offsetWidth;
  walletIcon.classList.add('wallet-hit');

  walletHitTimer = setTimeout(() => {
    walletIcon.classList.remove('wallet-hit');
    walletHitTimer = null;
  }, 320);
}

export function showCoinToWallet(viewRefs) {
  const statusRow = viewRefs?.statusRow;
  const walletIcon = viewRefs?.walletIcon;

  if (!statusRow || !walletIcon || statusRow.getBoundingClientRect().width === 0) {
    return;
  }

  const rowRect = statusRow.getBoundingClientRect();
  const walletRect = walletIcon.getBoundingClientRect();
  const startX = Math.max(36, rowRect.width * 0.28);
  const startY = Math.max(24, rowRect.height * 0.62);
  const endX = walletRect.left - rowRect.left + (walletRect.width / 2);
  const endY = walletRect.top - rowRect.top + (walletRect.height / 2);

  const coin = document.createElement('span');
  coin.className = 'coin-flight';
  setElementIcon(coin, 'coin', { decorative: true });
  coin.style.left = `${startX}px`;
  coin.style.top = `${startY}px`;
  statusRow.appendChild(coin);

  const dx = endX - startX;
  const dy = endY - startY;

  const animation = coin.animate(
    [
      { transform: 'translate(-50%, -50%) scale(0.9)', opacity: 0 },
      { transform: 'translate(-50%, -50%) scale(1.08)', opacity: 1, offset: 0.2 },
      { transform: `translate(${dx * 0.55}px, ${dy - 16}px) scale(1.12)`, opacity: 1, offset: 0.6 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.6)`, opacity: 0.2 }
    ],
    {
      duration: 980,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      fill: 'forwards'
    }
  );

  animation.onfinish = () => {
    coin.remove();
    triggerWalletHit(walletIcon);
  };
}

export function showRoleSwitchWalk(mascotOverlay, role, { duration = 2000 } = {}) {
  if (!mascotOverlay || !BOTH_KIDS.includes(role)) return;

  const emojiEl = mascotOverlay.querySelector('.mascot-emoji');
  const messageEl = mascotOverlay.querySelector('.mascot-message');

  if (emojiEl) setElementIcon(emojiEl, getNextMascotIcon(role), { decorative: true });
  if (messageEl) messageEl.textContent = '';

  clearMascotTimers();
  resetMascotAnimations(mascotOverlay);
  void mascotOverlay.offsetWidth;
  mascotOverlay.classList.add('mascot-role-walk');
  mascotOverlay.hidden = false;

  roleSwitchWalkTimer = setTimeout(() => {
    mascotOverlay.hidden = true;
    roleSwitchWalkTimer = null;
  }, duration);
}

export function showMascot(mascotOverlay, activeRole, message, { type = 'pop', duration = 2500 } = {}) {
  if (!mascotOverlay) return;

  const iconKey = BOTH_KIDS.includes(activeRole) ? getNextMascotIcon(activeRole) : MASCOT_MAP[activeRole] ?? 'star';
  const emojiEl = mascotOverlay.querySelector('.mascot-emoji');
  const messageEl = mascotOverlay.querySelector('.mascot-message');

  if (emojiEl) setElementIcon(emojiEl, iconKey, { decorative: true });
  if (messageEl) messageEl.textContent = message;

  clearMascotTimers();
  resetMascotAnimations(mascotOverlay);
  void mascotOverlay.offsetWidth;
  mascotOverlay.classList.add(`mascot-${type}`);
  mascotOverlay.hidden = false;

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
  viewRefs.tabPeriode.hidden = activeTab !== 'periode' || !isParent;
  viewRefs.tabFeedback.hidden = activeTab !== 'feedback' || !isParent;
  viewRefs.tabHistorik.hidden = activeTab !== 'historik' || !isParent;
}

function renderPeriod(viewRefs, periodUi, activeRole) {
  const isParent = activeRole === 'parent';

  if (!periodUi?.activePeriod) {
    viewRefs.periodTitle.textContent = 'Ingen aktiv periode';
    viewRefs.periodDates.textContent = '';
    viewRefs.periodDaysLeft.textContent = '';
    viewRefs.periodEarnings.innerHTML = '<p class="chore-meta">Ingen aktiv periode fundet.</p>';
    viewRefs.periodParentActions.hidden = true;
    return;
  }

  const { activePeriod, earnings, settings, daysLeft } = periodUi;

  viewRefs.periodTitle.textContent = 'Aktuel periode';
  viewRefs.periodDates.textContent = `${activePeriod.startDate} → ${activePeriod.endDate}`;
  viewRefs.periodDaysLeft.textContent = `${daysLeft} dage tilbage`;

  viewRefs.periodEarnings.innerHTML = `
    <div class="earnings-grid">
      <div class="earning-card">
        <h3>${renderIconText('kidHans', 'Hans Jørgen')}</h3>
        <p>${formatMoney(earnings['Hans Jørgen'] ?? 0)}</p>
      </div>
      <div class="earning-card">
        <h3>${renderIconText('kidAndrea', 'Andrea')}</h3>
        <p>${formatMoney(earnings.Andrea ?? 0)}</p>
      </div>
    </div>
  `;

  viewRefs.periodParentActions.hidden = !isParent;
  if (isParent) {
    viewRefs.periodLengthInput.value = String(settings.periodLengthDays ?? 7);
  }
}

function renderHistory(viewRefs, history) {
  if (!history || history.length === 0) {
    viewRefs.periodHistory.innerHTML = '<p class="chore-meta">Ingen afsluttede perioder endnu.</p>';
    return;
  }

  viewRefs.periodHistory.innerHTML = history.map(period => `
    <article class="history-item">
      <h3>${period.startDate} → ${period.endDate}</h3>
      <p class="chore-meta">Betalt: ${period.paidAt ? toDateTimeLabel(period.paidAt) : 'Ukendt'}</p>
      <div class="history-earnings">
        <p>${renderIconText('kidHans', 'Hans Jørgen:')} <strong>${formatMoney(period.earnings['Hans Jørgen'] ?? 0)}</strong></p>
        <p>${renderIconText('kidAndrea', 'Andrea:')} <strong>${formatMoney(period.earnings.Andrea ?? 0)}</strong></p>
      </div>
    </article>
  `).join('');
}

function renderFeedbackHistory(viewRefs, entries) {
  if (!viewRefs.feedbackHistory) {
    return;
  }

  if (!entries || entries.length === 0) {
    viewRefs.feedbackHistory.innerHTML = '<p class="chore-meta">Ingen feedback endnu.</p>';
    return;
  }

  viewRefs.feedbackHistory.innerHTML = entries.map((entry) => `
    <article class="history-item feedback-entry">
      <div class="feedback-entry-header">
        <h3>${escapeHtml(entry.title || 'Uden overskrift')}</h3>
        <span class="feedback-category-badge">${formatFeedbackCategory(entry.category)}</span>
      </div>
      <p class="chore-meta">Sendt ${toDateTimeLabel(entry.createdAt)}</p>
      <p class="feedback-entry-message">${escapeHtml(entry.message)}</p>
    </article>
  `).join('');
}

export function renderState(viewRefs, state, { activeRole, activeTab, periodUi, feedbackUi, editState = null }) {
  renderMoneySliders(viewRefs, activeRole, periodUi);

  viewRefs.addChoreSection.hidden = activeRole !== 'parent';
  viewRefs.choreList.innerHTML = renderChoreList(state.chores, activeRole, state.pendingCollaborations ?? [], editState);
  viewRefs.recentCompletions.innerHTML = renderRecentCompletions(state.recentCompletions);
  renderRoleSwitch(viewRefs, activeRole);
  renderTabs(viewRefs, activeTab, activeRole);
  renderPeriod(viewRefs, periodUi, activeRole);
  renderFeedbackHistory(viewRefs, feedbackUi?.entries || []);
  renderHistory(viewRefs, periodUi?.history || []);
  renderCollabInbox(viewRefs, state.pendingCollaborations ?? [], activeRole, state.chores);
}

export function renderFeedback(viewRefs, message) {
  viewRefs.feedback.textContent = message ?? '';
}
