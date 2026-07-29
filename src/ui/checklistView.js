import { toDateTimeLabel } from '../shared/dateTime.js';
import { getChoreVisual } from '../shared/choreMarker.js';
import { getIconSvgMarkup } from '../shared/iconRegistry.js';
import { CHECKLIST_ASSIGNEES, canKidToggleItem } from '../shared/checklistModel.js';
import { renderEditAssigneeCheckboxes } from './choreView.js';

function escape(value) { return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])); }
function marker(title, id) { const visual = getChoreVisual(title, id); return `<span class="chore-marker" aria-hidden="true">${getIconSvgMarkup(visual.iconKey)}</span>`; }

export function renderChecklistParentPanel(element, checklist, { onCreate, onAddItem } = {}) {
  if (!element) return;
  if (!checklist) {
    element.innerHTML = `<h2 class="section-title">Daglig checklist</h2><p class="chore-meta">Ingen checklist for i dag endnu.</p><button class="button button-primary" data-checklist-action="create">Opret dagens checklist</button>`;
  } else {
    element.innerHTML = `<div class="checklist-header"><div><h2 class="section-title">Daglig checklist</h2><p class="chore-meta">${escape(checklist.dateIso)}</p></div></div><ol class="checklist-list">${checklist.items.map(item => `<li class="checklist-item"><span>${marker(item.title, item.id)} <strong>${escape(item.title)}</strong></span><div class="assign-checkboxes">${renderEditAssigneeCheckboxes(item.id, item.assignedTo)}</div><span class="chore-meta">${item.completedAt ? `Fuldført ${toDateTimeLabel(item.completedAt)}` : 'Ikke fuldført'}</span></li>`).join('')}</ol><form class="checklist-add-form" data-checklist-action="add-item"><label class="assign-label" for="checklist-item-title">Tilføj et punkt</label><div class="form-row"><input id="checklist-item-title" class="input" name="title" type="text" maxlength="120" placeholder="f.eks. Pak skoletasken" required /><button class="button button-primary" type="submit">Tilføj</button></div></form>`;
  }
  element.querySelector('[data-checklist-action="create"]')?.addEventListener('click', onCreate);
  element.querySelector('[data-checklist-action="add-item"]')?.addEventListener('submit', event => {
    event.preventDefault();
    const title = new FormData(event.currentTarget).get('title');
    onAddItem?.(title);
  });
}

export function renderChecklistFamilyView(element, checklist, actorRole, { onToggle } = {}) {
  if (!element) return;
  if (!checklist) { element.innerHTML = '<h2 class="section-title">Dagens checklist</h2><p class="chore-meta">Der er ingen checklist i dag.</p>'; return; }
  element.innerHTML = `<h2 class="section-title">Dagens checklist</h2><ul class="checklist-list checklist-family-list">${checklist.items.map(item => {
    const allowed = canKidToggleItem(item, actorRole, actorRole);
    return `<li class="checklist-item${item.completedAt ? ' checklist-item-complete' : ''}"><button type="button" class="checklist-toggle button ${item.completedAt ? 'button-success' : 'button-secondary'}" data-checklist-item-id="${escape(item.id)}" ${allowed ? '' : 'disabled'} aria-pressed="${Boolean(item.completedAt)}">${item.completedAt ? '✓' : '○'} ${marker(item.title, item.id)} ${escape(item.title)}</button>${item.description ? `<p class="chore-meta">${escape(item.description)}</p>` : ''}${item.completedAt ? `<p class="chore-meta">Fuldført ${toDateTimeLabel(item.completedAt)}${item.completedBy ? ` af ${escape(item.completedBy)}` : ''}</p>` : ''}</li>`;
  }).join('')}</ul>`;
  element.querySelectorAll('[data-checklist-item-id]').forEach(button => button.addEventListener('click', () => onToggle?.(button.dataset.checklistItemId)));
}

export function bindChecklistPanel(element, handlers = {}) {
  element?.addEventListener('click', event => {
    const action = event.target.closest('[data-checklist-action]')?.dataset.checklistAction;
    if (action === 'create') handlers.onCreate?.();
    if (action === 'template') handlers.onSaveTemplate?.();
    if (action === 'apply-template') handlers.onApplyTemplate?.();
  });
}

export { CHECKLIST_ASSIGNEES };
