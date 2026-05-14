import { toDateTimeLabel } from '../shared/dateTime.js';
import { getChoreVisual } from '../shared/choreMarker.js';
import { getIconSvgMarkup, renderIcon, renderIconText, setElementIcon } from '../shared/iconRegistry.js';
import { getHelperByTrigger, pickPhrase } from '../shared/helperCast.js';
import { playSound, unlockAudio, toggleMute, isMuted } from '../shared/soundManager.js';

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
  const safeCollabId = escapeAttribute(collabId);

  return `
    <button class="button button-success" data-action="accept-collab" data-collab-id="${safeCollabId}">${renderIconText('check', acceptText)}</button>
    <button class="button button-secondary" data-action="decline-collab" data-collab-id="${safeCollabId}">${renderIconText('cancel', declineText)}</button>
  `;
}

function renderEditAssigneeCheckboxes(choreId, selectedKids = []) {
  const safeChoreId = escapeAttribute(choreId);
  const selected = new Set(Array.isArray(selectedKids) ? selectedKids : []);

  return BOTH_KIDS.map((kid) => `
    <label class="checkbox-label">
      <input
        type="checkbox"
        data-edit-field="assignedTo"
        data-chore-id="${safeChoreId}"
        data-kid="${escapeAttribute(kid)}"
        ${selected.has(kid) ? 'checked' : ''}
      /> ${escapeHtml(kid)}
    </label>
  `).join('');
}

function renderParentEditFields(chore, draft) {
  const safeChoreId = escapeAttribute(chore.id);

  return `
    <div class="chore-edit-fields">
      <div class="form-row form-row-3">
        <input
          class="input"
          type="text"
          maxlength="80"
          data-edit-field="name"
          data-chore-id="${safeChoreId}"
          value="${escapeAttribute(draft.name)}"
        />
        <div class="value-input-wrapper">
          <input
            class="input input-narrow"
            type="number"
            min="0"
            step="0.5"
            data-edit-field="value"
            data-chore-id="${safeChoreId}"
            value="${escapeAttribute(draft.value)}"
          />
          <span class="value-unit">kr</span>
        </div>
        <input
          class="input input-narrow"
          type="number"
          min="0"
          data-edit-field="maxPerPeriod"
          data-chore-id="${safeChoreId}"
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
        <button class="button button-success" data-action="save-edit" data-chore-id="${safeChoreId}">${renderIconText('save', 'Gem')}</button>
        <button class="button button-secondary" data-action="cancel-edit" data-chore-id="${safeChoreId}">${renderIconText('cancel', 'Annuller')}</button>
      </div>
    </div>
  `;
}

function renderChoreMarker(choreName, choreId) {
  const visual = getChoreVisual(choreName, choreId);
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

function renderChoreList(chores, activeRole, pendingCollaborations = [], editState = null, pagination = null) {
  const filteredChores = activeRole === 'parent'
    ? chores
    : chores.filter(chore => chore.assignedTo?.includes(activeRole));

  if (filteredChores.length === 0) {
    return {
      markup: renderEmptyChoreItem('Ingen opgaver endnu — tilføj en for at komme i gang.'),
      page: 1,
      totalPages: 1,
      totalItems: 0
    };
  }

  const rawPageSize = Number(pagination?.pageSize);
  const pageSize = Number.isFinite(rawPageSize) && rawPageSize > 0
    ? Math.floor(rawPageSize)
    : filteredChores.length;
  const totalPages = Math.max(1, Math.ceil(filteredChores.length / pageSize));
  const rawPage = Number(pagination?.page ?? 1);
  const requestedPage = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
  const page = Math.min(requestedPage, totalPages);
  const startIndex = (page - 1) * pageSize;
  const visibleChores = pagination
    ? filteredChores.slice(startIndex, startIndex + pageSize)
    : filteredChores;

  const markup = visibleChores
    .map((chore) => {
      const safeChoreId = escapeAttribute(chore.id);
      const safeChoreName = escapeHtml(chore.name);
      const maxPerPeriod = chore.maxPerPeriod ?? 1;
      const periodCount = chore.periodCompletionCount ?? 0;
      const isFullyDone = chore.isFullyDone ?? false;
      const choreMarker = renderChoreMarker(chore.name, chore.id);

      const repeatBadge = maxPerPeriod > 1
        ? `<span class="repeat-badge">${periodCount}/${maxPerPeriod} gange</span>`
        : (maxPerPeriod === 0 && periodCount > 0 ? `<span class="repeat-badge">${periodCount}× gjort</span>` : '');

      const isBothKidsChore = BOTH_KIDS.every(k => chore.assignedTo?.includes(k));
      const pendingCollab = pendingCollaborations.find(c => c.choreId === chore.id);
      const isProposer = pendingCollab?.proposedBy === activeRole;

      let actionButtons = '';
      if (activeRole !== 'parent') {
        if (isFullyDone) {
          actionButtons = `<button class="button button-secondary" data-action="undo" data-chore-id="${safeChoreId}">${renderIconText('undo', 'Fortryd')}</button>`;
        } else {
          actionButtons = `<button class="button button-success" data-action="complete" data-chore-id="${safeChoreId}">${renderIconText('check', 'Fuldfør')}</button>`;

          if (isBothKidsChore && !pendingCollab) {
            actionButtons += ` <button class="button button-collab" data-action="propose-collab" data-chore-id="${safeChoreId}">${renderIconText('collab', 'Gør det sammen')}</button>`;
          }

          if (periodCount > 0) {
            actionButtons += ` <button class="button button-secondary" data-action="undo" data-chore-id="${safeChoreId}">${renderIconText('undo', 'Fortryd')}</button>`;
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
          <button class="button button-secondary" data-action="edit" data-chore-id="${safeChoreId}">${renderIconText('edit', 'Rediger')}</button>
          <button class="button button-secondary" data-action="delete" data-chore-id="${safeChoreId}">${renderIconText('delete', 'Slet')}</button>
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
        : activeRole === 'parent'
          ? `
            <p class="chore-meta">${meta}</p>
            <p class="chore-meta">Værdi: ${formatMoney(chore.value ?? 0)}</p>
          `
          : `
            <p class="chore-meta">${meta} • ${formatMoney(chore.value ?? 0)}</p>
          `;

      return `
        <li class="chore-item${isFullyDone ? ' chore-fully-done' : ''}">
          <div class="chore-main">
            <div class="chore-title-row">
              <h3 class="chore-title">${choreMarker}<span>${safeChoreName}</span></h3>
              ${repeatBadge}
            </div>
            <div class="actions">${actionButtons}</div>
          </div>
          ${detailsMarkup}
        </li>
      `;
    })
    .join('');

  return {
    markup,
    page,
    totalPages,
    totalItems: filteredChores.length
  };
}

function renderRecentCompletions(items, { maxItems = null } = {}) {
  const visibleItems = Number.isInteger(maxItems) && maxItems > 0
    ? items.slice(0, maxItems)
    : items;

  if (visibleItems.length === 0) {
    return renderEmptyChoreItem('Ingen fuldføringer endnu.');
  }

  return visibleItems
    .map((item) => {
      const choreMarker = renderChoreMarker(item.choreName);
      const safeChoreName = escapeHtml(item.choreName);
      const resetText = item.undoneAt ? ` (fortrudt ${toDateTimeLabel(item.undoneAt)})` : ' (aktiv)';
      return `
        <li class="chore-item">
          <p class="chore-meta">
            ${choreMarker} ${safeChoreName} fuldført ${toDateTimeLabel(item.completedAt)}${resetText}
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
        const safeProposedBy = escapeHtml(collab.proposedBy);
        const safeChoreName = escapeHtml(choreName);
        return `
          <div class="collab-proposal">
            <p>${renderIcon(proposerIcon)} <strong>${safeProposedBy}</strong> vil gøre <strong>${choreMarker} ${safeChoreName}</strong> sammen med dig!</p>
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
let cinematicTimer = null;

/**
 * Safe reduced-motion check — works in Node/JSDOM where matchMedia doesn't exist.
 */
function prefersReducedMotion() {
  return typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Fire canvas-confetti if the library is available on the page. */
function fireConfetti({ particleCount = 120, spread = 80, origin = { y: 0.65 }, big = false } = {}) {
  if (typeof window.confetti !== 'function') return;
  if (prefersReducedMotion()) return;

  if (big) {
    // Three cannons: left, right, and center for the cinematic celebration
    window.confetti({ particleCount: 120, angle: 60, spread: 80, origin: { x: 0, y: 0.75 } });
    window.confetti({ particleCount: 120, angle: 120, spread: 80, origin: { x: 1, y: 0.75 } });
    setTimeout(() => {
      window.confetti({ particleCount: 100, angle: 90, spread: 130, origin: { x: 0.5, y: 0.5 } });
    }, 350);
    setTimeout(() => {
      window.confetti({ particleCount: 80, angle: 75, spread: 100, origin: { x: 0.25, y: 0.3 } });
      window.confetti({ particleCount: 80, angle: 105, spread: 100, origin: { x: 0.75, y: 0.3 } });
    }, 700);
  } else {
    window.confetti({ particleCount, spread, origin });
  }
}

/**
 * Rain emoji icons down the screen (Act 3 of the cinematic celebration).
 * Creates lightweight <span> elements, animates them with CSS, then removes them.
 */
function fireEmojiRain(iconKeys = ['star', 'sparkle', 'trophy', 'rocket', 'party', 'magic'], count = 35) {
  if (prefersReducedMotion()) return;

  for (let i = 0; i < count; i++) {
    const iconKey = iconKeys[Math.floor(Math.random() * iconKeys.length)];
    const span = document.createElement('span');
    span.className = 'emoji-rain-drop';
    span.innerHTML = getIconSvgMarkup(iconKey);
    span.style.setProperty('--rain-left', `${Math.random() * 100}vw`);
    span.style.setProperty('--rain-delay', `${Math.random() * 2.2}s`);
    span.style.setProperty('--rain-duration', `${1.4 + Math.random() * 1.2}s`);
    span.style.setProperty('--rain-rotate', `${(Math.random() - 0.5) * 60}deg`);
    span.style.setProperty('--rain-size', `${1.6 + Math.random() * 1.6}rem`);
    document.body.appendChild(span);
    span.addEventListener('animationend', () => span.remove(), { once: true });
  }
}

/**
 * Attach emoji trail sparkles to pointer movement on a chore list item.
 * Called once per chore item element.
 */
function attachEmojiTrail(itemEl, iconKey) {
  if (prefersReducedMotion()) return;

  itemEl.addEventListener('pointermove', (e) => {
    if (Math.random() > 0.35) return; // throttle — fire ~35% of events
    const trail = document.createElement('span');
    trail.className = 'emoji-trail-spark';
    trail.innerHTML = getIconSvgMarkup(iconKey);
    const rect = itemEl.getBoundingClientRect();
    trail.style.left = `${e.clientX - rect.left}px`;
    trail.style.top = `${e.clientY - rect.top}px`;
    itemEl.appendChild(trail);
    trail.addEventListener('animationend', () => trail.remove(), { once: true });
  });
}

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
    'mascot-role-walk',
    'helper-fall-from-top',
    'helper-zoom-from-right',
    'helper-spiral-center',
    'helper-crawl-up',
    'helper-float-from-left',
    'helper-drop-from-star'
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

export function showRoleSwitchWalk(mascotOverlay, role, { duration = 2200 } = {}) {
  if (!mascotOverlay || !BOTH_KIDS.includes(role)) return;

  const emojiEl = mascotOverlay.querySelector('.mascot-emoji');
  const messageEl = mascotOverlay.querySelector('.mascot-message');

  // Use the dedicated kid avatar for the walk-across animation
  const walkIcon = role === 'Andrea' ? 'kidAndrea' : 'kidHans';
  if (emojiEl) setElementIcon(emojiEl, walkIcon, { decorative: true });
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

/** Map mascot type → helper cast trigger for routing. */
const TYPE_TO_HELPER_TRIGGER = Object.freeze({
  celebrate: 'allChoresDone',
  confetti:  'periodPaid',
  collab:    null, // collab keeps its own animation for now
});

/** The full icon pool used for emoji rain per kid. */
const KID_RAIN_ICONS = Object.freeze({
  'Andrea':      ['heart', 'flower', 'gift', 'diamond', 'rainbow', 'magic', 'sparkle', 'butterfly'],
  'Hans Jørgen': ['rocket', 'target', 'trophy', 'build', 'idea', 'star', 'fire', 'sparkle'],
  parent:        ['star', 'sparkle', 'party', 'trophy', 'magic', 'rainbow'],
});

/**
 * Three-act cinematic celebration for all-chores-done.
 *  Act 1 (0–1.2s)  : Party Fairy flies in, speech bubble appears.
 *  Act 2 (1.2–3s)  : Triple confetti cannons.
 *  Act 3 (2–4.5s)  : Emoji rain from above.
 */
export function showCinematicCelebration(mascotOverlay, activeRole) {
  if (!mascotOverlay) return;

  const helper = getHelperByTrigger('allChoresDone');
  if (!helper) return;

  const emojiEl = mascotOverlay.querySelector('.mascot-emoji');
  const messageEl = mascotOverlay.querySelector('.mascot-message');

  if (emojiEl) setElementIcon(emojiEl, helper.iconKey, { decorative: true });
  if (messageEl) messageEl.textContent = pickPhrase(helper);

  clearMascotTimers();
  resetMascotAnimations(mascotOverlay);
  void mascotOverlay.offsetWidth;

  // Act 1: hero entrance
  mascotOverlay.classList.add('helper-spiral-center');
  mascotOverlay.hidden = false;
  playSound('firework');

  // Act 2: confetti cannons
  if (cinematicTimer) clearTimeout(cinematicTimer);
  cinematicTimer = setTimeout(() => {
    fireConfetti({ big: true });
  }, 1200);

  // Act 3: emoji rain overlapping with confetti
  setTimeout(() => {
    const rainIcons = KID_RAIN_ICONS[activeRole] ?? KID_RAIN_ICONS.parent;
    fireEmojiRain([...rainIcons, 'party', 'sparkle'], 40);
  }, 2000);

  // Hide mascot after full sequence
  mascotTimer = setTimeout(() => {
    mascotOverlay.hidden = true;
    mascotTimer = null;
    cinematicTimer = null;
  }, 4500);
}

export function showMascot(mascotOverlay, activeRole, message, { type = 'pop', duration = 2500 } = {}) {
  if (!mascotOverlay) return;

  // Route celebration/confetti types to their helper characters
  const helperTrigger = TYPE_TO_HELPER_TRIGGER[type];
  if (helperTrigger !== undefined && helperTrigger !== null) {
    const helper = getHelperByTrigger(helperTrigger);
    if (helper) {
      const emojiEl = mascotOverlay.querySelector('.mascot-emoji');
      const messageEl = mascotOverlay.querySelector('.mascot-message');
      if (emojiEl) setElementIcon(emojiEl, helper.iconKey, { decorative: true });
      if (messageEl) messageEl.textContent = pickPhrase(helper);

      clearMascotTimers();
      resetMascotAnimations(mascotOverlay);
      void mascotOverlay.offsetWidth;

      const entranceClass = `helper-${helper.entrance.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      mascotOverlay.classList.add(entranceClass);
      mascotOverlay.hidden = false;
      playSound(helper.soundCue ?? 'chime');

      if (type === 'confetti') fireConfetti({ big: true });

      mascotTimer = setTimeout(() => {
        mascotOverlay.hidden = true;
        mascotTimer = null;
      }, duration);
      return;
    }
  }

  // Default: use the rotating per-kid icon with pop/collab animation
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
  playSound(type === 'collab' ? 'chime' : 'pop');

  mascotTimer = setTimeout(() => {
    mascotOverlay.hidden = true;
    mascotTimer = null;
  }, duration);
}

/**
 * Attach a single delegated pointer-trail listener to the chore list container.
 * Call this once after the view is created.  It auto-picks the icon from the
 * chore item's data-icon-key attribute so it works after every re-render.
 */
export function initChoreTrails(choreListEl) {
  if (!choreListEl || choreListEl.dataset.trailsAttached) return;
  choreListEl.dataset.trailsAttached = '1';

  if (prefersReducedMotion()) return;

  choreListEl.addEventListener('pointermove', (e) => {
    if (Math.random() > 0.3) return; // throttle to ~30%
    const itemEl = e.target.closest('.chore-item');
    if (!itemEl) return;

    const marker = itemEl.querySelector('[data-icon-key]');
    const iconKey = marker?.dataset.iconKey ?? 'sparkle';

    const trail = document.createElement('span');
    trail.className = 'emoji-trail-spark';
    trail.innerHTML = getIconSvgMarkup(iconKey);
    const rect = itemEl.getBoundingClientRect();
    trail.style.left = `${e.clientX - rect.left}px`;
    trail.style.top = `${e.clientY - rect.top}px`;
    itemEl.style.position = 'relative'; // ensure containment
    itemEl.appendChild(trail);
    trail.addEventListener('animationend', () => trail.remove(), { once: true });
  });
}

/**
 * Show a specific helper character from the cast by their trigger name.
 * @param {Element} mascotOverlay
 * @param {string}  trigger  – one of the HELPER_CAST trigger values
 */
export function showHelperByTrigger(mascotOverlay, trigger) {
  if (!mascotOverlay) return;
  const helper = getHelperByTrigger(trigger);
  if (!helper) return;

  const emojiEl = mascotOverlay.querySelector('.mascot-emoji');
  const messageEl = mascotOverlay.querySelector('.mascot-message');
  if (emojiEl) setElementIcon(emojiEl, helper.iconKey, { decorative: true });
  if (messageEl) messageEl.textContent = pickPhrase(helper);

  clearMascotTimers();
  resetMascotAnimations(mascotOverlay);
  void mascotOverlay.offsetWidth;

  // Convert camelCase entrance → kebab-case CSS class
  const entranceClass = `helper-${helper.entrance.replace(/([A-Z])/g, (_, c) => `-${c.toLowerCase()}`)}`;
  mascotOverlay.classList.add(entranceClass);
  mascotOverlay.hidden = false;
  playSound(helper.soundCue ?? 'chime');

  mascotTimer = setTimeout(() => {
    mascotOverlay.hidden = true;
    mascotTimer = null;
  }, 3200);
}

function renderTabs(viewRefs, activeTab, activeRole) {
  const isParent = activeRole === 'parent';
  const resolvedTab = isParent ? activeTab : 'opgaver';

  for (const button of viewRefs.tabNav.querySelectorAll('.tab-btn')) {
    const tabName = button.getAttribute('data-tab');
    const isActive = tabName === resolvedTab;
    button.classList.toggle('tab-active', isActive);
    button.setAttribute('aria-selected', isActive ? 'true' : 'false');

    if (button.classList.contains('tab-parent-only')) {
      button.hidden = !isParent;
    }
  }
  viewRefs.tabNav.hidden = !isParent;

  viewRefs.tabOpgaver.hidden = resolvedTab !== 'opgaver';
  viewRefs.tabPeriode.hidden = resolvedTab !== 'periode' || !isParent;
  viewRefs.tabFeedback.hidden = resolvedTab !== 'feedback' || !isParent;
  viewRefs.tabHistorik.hidden = resolvedTab !== 'historik' || !isParent;
}

function renderModeSwitch(viewRefs, activeMode, activeRole) {
  if (!viewRefs.modeSwitch) {
    return;
  }

  const isParent = activeRole === 'parent';
  const resolvedMode = isParent ? activeMode : 'chores';

  for (const button of viewRefs.modeSwitch.querySelectorAll('button[data-mode]')) {
    const modeName = button.getAttribute('data-mode');
    const isActive = modeName === resolvedMode;
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  }
  viewRefs.modeSwitch.closest('.app-mode-card')?.toggleAttribute('hidden', !isParent);

  if (viewRefs.choresWorkspace) {
    viewRefs.choresWorkspace.hidden = resolvedMode !== 'chores';
  }

  if (viewRefs.spotifyWorkspace) {
    viewRefs.spotifyWorkspace.hidden = resolvedMode !== 'spotify';
  }
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
      <h3>${escapeHtml(period.startDate)} → ${escapeHtml(period.endDate)}</h3>
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

export function renderState(viewRefs, state, { activeRole, activeMode = 'chores', activeTab, periodUi, feedbackUi, editState = null, kidUi = null }) {
  const isParent = activeRole === 'parent';
  const isKid = !isParent;
  const kidPageSize = Number(kidUi?.pageSize) > 0 ? Number(kidUi.pageSize) : 3;

  renderMoneySliders(viewRefs, activeRole, periodUi);

  viewRefs.addChoreSection.hidden = !isParent;
  if (viewRefs.appShell) {
    viewRefs.appShell.classList.toggle('app-shell-kid', isKid);
  }
  if (viewRefs.appHeaderCard) {
    viewRefs.appHeaderCard.hidden = isKid;
  }

  const choreListResult = renderChoreList(
    state.chores,
    activeRole,
    state.pendingCollaborations ?? [],
    editState,
    isKid
      ? {
        page: Number(kidUi?.page ?? 1),
        pageSize: kidPageSize
      }
      : null
  );

  viewRefs.choreList.innerHTML = choreListResult.markup;
  viewRefs.recentCompletions.innerHTML = renderRecentCompletions(state.recentCompletions);
  if (viewRefs.recentCompletionsCard) {
    viewRefs.recentCompletionsCard.hidden = isKid;
  }

  if (viewRefs.kidChorePagination && viewRefs.kidChorePrevButton && viewRefs.kidChoreNextButton && viewRefs.kidChorePageLabel) {
    const showPaging = isKid && choreListResult.totalPages > 1;
    viewRefs.kidChorePagination.hidden = !showPaging;
    viewRefs.kidChorePrevButton.disabled = choreListResult.page <= 1;
    viewRefs.kidChoreNextButton.disabled = choreListResult.page >= choreListResult.totalPages;
    viewRefs.kidChorePageLabel.textContent = `Side ${choreListResult.page} af ${choreListResult.totalPages}`;
  }

  renderModeSwitch(viewRefs, activeMode, activeRole);
  renderRoleSwitch(viewRefs, activeRole);
  renderTabs(viewRefs, activeTab, activeRole);
  renderPeriod(viewRefs, periodUi, activeRole);
  renderFeedbackHistory(viewRefs, feedbackUi?.entries || []);
  renderHistory(viewRefs, periodUi?.history || []);
  renderCollabInbox(viewRefs, state.pendingCollaborations ?? [], activeRole, state.chores);

  return {
    kidChorePage: choreListResult.page,
    kidChoreTotalPages: choreListResult.totalPages
  };
}

export function renderFeedback(viewRefs, message) {
  viewRefs.feedback.textContent = message ?? '';
}
