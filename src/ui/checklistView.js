import { toDateTimeLabel } from '../shared/dateTime.js';
import { getChoreVisual } from '../shared/choreMarker.js';
import { getIconSvgMarkup, renderIcon } from '../shared/iconRegistry.js';
import { CHECKLIST_ASSIGNEES, canKidToggleItem } from '../shared/checklistModel.js';
import { renderEditAssigneeCheckboxes } from './choreView.js';
import { escapeHtml } from '../shared/htmlSanitizer.js';

const escape = escapeHtml;
function marker(title, id) { const visual = getChoreVisual(title, id); return `<span class="chore-marker" aria-hidden="true">${getIconSvgMarkup(visual.iconKey)}</span>`; }

export function renderChecklistParentPanel(element, checklist, { onCreate, onAddItem, onReorder } = {}) {
  if (!element) return;
  if (!checklist) {
    element.innerHTML = `<h2 class="section-title">Daglig checklist</h2><p class="chore-meta">Ingen checklist for i dag endnu.</p><button class="button button-primary" data-checklist-action="create">Opret dagens checklist</button>`;
  } else {
    element.innerHTML = `<div class="checklist-header"><div><h2 class="section-title">Daglig checklist</h2><p class="chore-meta">${escape(checklist.dateIso)}</p></div></div><p class="chore-meta checklist-reorder-help">Træk punkterne for at ændre rækkefølgen.</p><ol class="checklist-list">${checklist.items.map(item => `<li class="checklist-item" data-checklist-item-id="${escape(item.id)}" draggable="true"><span class="checklist-drag-handle" aria-hidden="true"><span class="drag-bar"></span><span class="drag-bar"></span><span class="drag-bar"></span></span><span>${marker(item.title, item.id)} <strong>${escape(item.title)}</strong></span><div class="assign-checkboxes">${renderEditAssigneeCheckboxes(item.id, item.assignedTo)}</div><span class="chore-meta">${item.completedAt ? `Fuldført ${toDateTimeLabel(item.completedAt)}` : 'Ikke fuldført'}</span></li>`).join('')}</ol><form class="checklist-add-form" data-checklist-action="add-item"><label class="assign-label" for="checklist-item-title">Tilføj et punkt</label><div class="form-row"><input id="checklist-item-title" class="input" name="title" type="text" maxlength="120" placeholder="f.eks. Pak skoletasken" required /><button class="button button-primary" type="submit">Tilføj</button></div></form>`;
    bindChecklistReordering(element, onReorder);
  }
  element.querySelector('[data-checklist-action="create"]')?.addEventListener('click', onCreate);
  element.querySelector('[data-checklist-action="add-item"]')?.addEventListener('submit', event => {
    event.preventDefault();
    const title = new FormData(event.currentTarget).get('title');
    onAddItem?.(title);
  });
}

function bindChecklistReordering(element, onReorder) {
  const list = element.querySelector('.checklist-list');
  if (!list) return;
  let draggedItemId = null;

  list.querySelectorAll('[data-checklist-item-id]').forEach(item => {
    item.addEventListener('dragstart', event => {
      draggedItemId = item.dataset.checklistItemId;
      item.classList.add('checklist-item-dragging');
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', draggedItemId);
      }
    });
    item.addEventListener('dragover', event => {
      if (!draggedItemId || item.dataset.checklistItemId === draggedItemId) return;
      event.preventDefault();
      item.classList.add('checklist-item-drop-target');
    });
    item.addEventListener('dragleave', () => item.classList.remove('checklist-item-drop-target'));
    item.addEventListener('drop', event => {
      event.preventDefault();
      item.classList.remove('checklist-item-drop-target');
      if (!draggedItemId || item.dataset.checklistItemId === draggedItemId) return;

      const dragged = [...list.querySelectorAll('[data-checklist-item-id]')]
        .find(entry => entry.dataset.checklistItemId === draggedItemId);
      if (!dragged) return;
      const rect = item.getBoundingClientRect();
      const insertAfter = event.clientY > rect.top + rect.height / 2;
      list.insertBefore(dragged, insertAfter ? item.nextSibling : item);
      onReorder?.([...list.querySelectorAll('[data-checklist-item-id]')].map(entry => entry.dataset.checklistItemId));
    });
    item.addEventListener('dragend', () => {
      draggedItemId = null;
      list.querySelectorAll('.checklist-item-dragging, .checklist-item-drop-target').forEach(entry => entry.classList.remove('checklist-item-dragging', 'checklist-item-drop-target'));
    });
  });
}

export function renderChecklistFamilyView(element, checklist, actorRole, { onToggle } = {}) {
  if (!element) return;
  if (!checklist) { element.innerHTML = '<h2 class="section-title">Dagens checklist</h2><p class="chore-meta">Der er ingen checklist i dag.</p>'; return; }
  const totalItems = checklist.items.length;
  const completedItems = checklist.items.filter(item => item.completedAt).length;
  const completionPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  element.innerHTML = `<div class="checklist-family-header"><div><h2 class="section-title">Dagens checklist</h2><p class="chore-meta">Gør tingene i din egen rækkefølge</p></div><span class="checklist-family-count">${completedItems}/${totalItems}</span></div><ul class="checklist-list checklist-family-list">${checklist.items.map(item => {
    const allowed = canKidToggleItem(item, actorRole, actorRole);
    return `<li class="checklist-item checklist-family-item${item.completedAt ? ' checklist-item-complete' : ''}"><button type="button" class="checklist-toggle checklist-family-toggle" data-checklist-item-id="${escape(item.id)}" ${allowed ? '' : 'disabled'} aria-pressed="${Boolean(item.completedAt)}"><span class="checklist-family-item-label">${marker(item.title, item.id)}<span>${escape(item.title)}</span></span><span class="checklist-check-circle${item.completedAt ? ' checklist-check-circle-complete' : ''}" aria-hidden="true">${item.completedAt ? renderIcon('check') : ''}</span></button>${item.description ? `<p class="chore-meta checklist-family-description">${escape(item.description)}</p>` : ''}</li>`;
  }).join('')}</ul>`;
  element.insertAdjacentHTML('beforeend', `<div class="checklist-progress" role="progressbar" aria-label="Checklist-fremskridt" aria-valuemin="0" aria-valuemax="${totalItems}" aria-valuenow="${completedItems}"><span style="width: ${completionPercent}%"></span></div><p class="checklist-progress-label">${completedItems} af ${totalItems} færdige</p>`);
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
