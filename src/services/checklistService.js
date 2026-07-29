import { nowIsoTimestamp, toDateTimeLabel } from '../shared/dateTime.js';
import { createEntityId } from '../shared/id.js';
import {
  canKidToggleItem,
  isKidRole,
  isRoleAllowed,
  isValidChecklistDate,
  mergeChecklists,
  normalizeChecklist,
  normalizeChecklistItem,
  normalizeChecklists,
  reorderChecklistItems,
  validateChecklistItems
} from '../shared/checklistModel.js';

export const CHECKLIST_MESSAGES = Object.freeze({
  parentOnly: 'Kun forældrevisning kan redigere tjeklisten.',
  kidOnly: 'Kun børnevisning kan markere checklisten.',
  invalidDate: 'Datoen for checklisten er ugyldig.',
  invalidItems: 'Checklist-items er ugyldige.',
  missing: 'Der findes ingen checklist for denne dato.',
  missingItem: 'Checklist-item kunne ikke findes.',
  carriedForward: 'Checklist videreført til den nye dag.',
  notAllowed: 'Du kan kun markere dine egne checklist-items.',
  saved: 'Checklist gemt.',
  completed: 'Checklist-item opdateret.'
});

function asResult(ok, message, state) { return { ok, message, state }; }

export function createChecklistService({ storageService, nowProvider = nowIsoTimestamp, telemetry = () => {} } = {}) {
  if (!storageService) throw new Error('createChecklistService requires storageService.');

  function state(dateIso = null) {
    const data = storageService.loadData();
    const checklist = dateIso ? data.checklists.find(item => item.dateIso === dateIso) || null : null;
    return { checklist, checklists: data.checklists, recentCompletions: getRecentCompletionsFromData(data, 10) };
  }

  function validDateOrResult(dateIso) {
    return isValidChecklistDate(dateIso) ? null : asResult(false, CHECKLIST_MESSAGES.invalidDate, state());
  }

  function saveChecklists(checklists, action, dateIso, extra = {}) {
    storageService.updateData(data => ({ ...data, checklists: normalizeChecklists(checklists) }));
    telemetry({ action, dateIso, ...extra });
  }

  function getChecklist(dateIso) {
    const invalid = validDateOrResult(dateIso);
    if (invalid) return invalid;
    return asResult(true, '', state(dateIso));
  }

  function createChecklist(dateIso, items = [], meta = {}, options = {}) {
    const invalid = validDateOrResult(dateIso);
    if (invalid) return invalid;
    const actorRole = options.actorRole ?? meta?.actorRole ?? 'parent';
    if (!isRoleAllowed(actorRole, ['parent'])) return asResult(false, CHECKLIST_MESSAGES.parentOnly, state(dateIso));
    if (!Array.isArray(items)) return asResult(false, CHECKLIST_MESSAGES.invalidItems, state(dateIso));
    const prepared = items.map((item, index) => normalizeChecklistItem({ ...item, id: item?.id || createEntityId('checklist-item'), orderIndex: index }, index, { nowIso: nowProvider() }));
    const validation = validateChecklistItems(prepared);
    if (!validation.ok) return asResult(false, validation.message || CHECKLIST_MESSAGES.invalidItems, state(dateIso));
    const data = storageService.loadData();
    const existing = data.checklists.find(item => item.dateIso === dateIso);
    const checklist = normalizeChecklist({ dateIso, items: prepared, meta, updatedAt: nowProvider() });
    saveChecklists(existing ? data.checklists.map(item => item.dateIso === dateIso ? checklist : item) : [...data.checklists, checklist], existing ? 'update' : 'create', dateIso);
    return asResult(true, CHECKLIST_MESSAGES.saved, state(dateIso));
  }

  function carryForwardChecklist(dateIso, { actorRole = 'parent' } = {}) {
    const invalid = validDateOrResult(dateIso);
    if (invalid) return invalid;
    if (!isRoleAllowed(actorRole, ['parent'])) return asResult(false, CHECKLIST_MESSAGES.parentOnly, state(dateIso));
    const data = storageService.loadData();
    if (data.checklists.some(item => item.dateIso === dateIso)) return asResult(true, '', state(dateIso));
    const previous = data.checklists
      .filter(item => item.dateIso < dateIso)
      .sort((left, right) => right.dateIso.localeCompare(left.dateIso))[0];
    if (!previous) return asResult(false, '', state(dateIso));
    const items = previous.items.map(item => ({
      ...item,
      id: createEntityId('checklist-item'),
      completedAt: null,
      completedBy: null
    }));
    return createChecklist(dateIso, items, previous.meta, { actorRole });
  }

  function updateChecklist(dateIso, patch = {}, options = {}) {
    const invalid = validDateOrResult(dateIso);
    if (invalid) return invalid;
    const actorRole = options.actorRole ?? patch?.actorRole ?? 'parent';
    if (!isRoleAllowed(actorRole, ['parent'])) return asResult(false, CHECKLIST_MESSAGES.parentOnly, state(dateIso));
    const data = storageService.loadData();
    const current = data.checklists.find(item => item.dateIso === dateIso);
    if (!current) return asResult(false, CHECKLIST_MESSAGES.missing, state(dateIso));
    const next = normalizeChecklist({ ...current, ...patch, dateIso, updatedAt: nowProvider() });
    const validation = validateChecklistItems(next.items);
    if (!validation.ok) return asResult(false, validation.message || CHECKLIST_MESSAGES.invalidItems, state(dateIso));
    saveChecklists(data.checklists.map(item => item.dateIso === dateIso ? next : item), 'update', dateIso);
    return asResult(true, CHECKLIST_MESSAGES.saved, state(dateIso));
  }

  function addItem(dateIso, item, options = {}) {
    const current = getChecklist(dateIso).state.checklist;
    if (!current) return asResult(false, CHECKLIST_MESSAGES.missing, state(dateIso));
    return updateChecklist(dateIso, { items: [...current.items, { ...item, id: item?.id || createEntityId('checklist-item'), orderIndex: current.items.length }] }, options);
  }

  function updateItem(dateIso, itemId, patch = {}, options = {}) {
    const current = getChecklist(dateIso).state.checklist;
    if (!current) return asResult(false, CHECKLIST_MESSAGES.missing, state(dateIso));
    if (!current.items.some(item => item.id === itemId)) return asResult(false, CHECKLIST_MESSAGES.missingItem, state(dateIso));
    return updateChecklist(dateIso, { items: current.items.map(item => item.id === itemId ? { ...item, ...patch } : item) }, options);
  }

  function removeItem(dateIso, itemId, options = {}) {
    const current = getChecklist(dateIso).state.checklist;
    if (!current) return asResult(false, CHECKLIST_MESSAGES.missing, state(dateIso));
    return updateChecklist(dateIso, { items: current.items.filter(item => item.id !== itemId).map((item, index) => ({ ...item, orderIndex: index })) }, options);
  }

  function deleteChecklist(dateIso, { actorRole = 'parent' } = {}) {
    if (!isRoleAllowed(actorRole, ['parent'])) return asResult(false, CHECKLIST_MESSAGES.parentOnly, state(dateIso));
    const data = storageService.loadData();
    if (!data.checklists.some(item => item.dateIso === dateIso)) return asResult(false, CHECKLIST_MESSAGES.missing, state(dateIso));
    saveChecklists(data.checklists.filter(item => item.dateIso !== dateIso), 'delete', dateIso);
    return asResult(true, CHECKLIST_MESSAGES.saved, state(dateIso));
  }

  function reorderItems(dateIso, orderedItemIds, { actorRole = 'parent' } = {}) {
    const current = getChecklist(dateIso).state.checklist;
    if (!current) return asResult(false, CHECKLIST_MESSAGES.missing, state(dateIso));
    const items = reorderChecklistItems(current.items, orderedItemIds);
    if (!items) return asResult(false, CHECKLIST_MESSAGES.invalidItems, state(dateIso));
    return updateChecklist(dateIso, { items }, { actorRole });
  }

  function toggleComplete(dateIso, itemId, actorRole, actorId = actorRole) {
    const invalid = validDateOrResult(dateIso);
    if (invalid) return invalid;
    if (!isKidRole(actorRole)) return asResult(false, CHECKLIST_MESSAGES.kidOnly, state(dateIso));
    const data = storageService.loadData();
    const checklist = data.checklists.find(item => item.dateIso === dateIso);
    const item = checklist?.items.find(candidate => candidate.id === itemId);
    if (!item) return asResult(false, CHECKLIST_MESSAGES.missingItem, state(dateIso));
    if (!canKidToggleItem(item, actorRole, actorId)) return asResult(false, CHECKLIST_MESSAGES.notAllowed, state(dateIso));
    const completedAt = item.completedAt ? null : nowProvider();
    const nextItem = { ...item, completedAt, completedBy: completedAt ? actorId : null, updatedAt: nowProvider() };
    const nextChecklist = { ...checklist, items: checklist.items.map(candidate => candidate.id === itemId ? nextItem : candidate), updatedAt: nowProvider() };
    saveChecklists(data.checklists.map(candidate => candidate.dateIso === dateIso ? nextChecklist : candidate), 'toggle', dateIso, { itemId, completed: Boolean(completedAt), actorRole, actorId });
    return asResult(true, CHECKLIST_MESSAGES.completed, state(dateIso));
  }

  function getRecentCompletionsFromData(data, limit = 10) {
    return data.checklists.flatMap(checklist => checklist.items
      .filter(item => item.completedAt)
      .map(item => ({ checklistDate: checklist.dateIso, itemId: item.id, title: item.title, completedAt: item.completedAt, completedBy: item.completedBy })))
      .sort((left, right) => right.completedAt.localeCompare(left.completedAt))
      .slice(0, Math.max(0, limit));
  }

  function getRecentCompletions(limit = 10) { return getRecentCompletionsFromData(storageService.loadData(), limit); }

  return { getChecklist, createChecklist, carryForwardChecklist, updateChecklist, addItem, updateItem, removeItem, deleteChecklist, reorderItems, toggleComplete, getRecentCompletions, mergeChecklists };
}

export { isRoleAllowed, isKidRole, canKidToggleItem, reorderChecklistItems, mergeChecklists };
