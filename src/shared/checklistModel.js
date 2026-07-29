import { isValidIsoTimestamp, nowIsoTimestamp } from './dateTime.js';

export const CHECKLIST_ASSIGNEES = Object.freeze(['Hans Jørgen', 'Andrea']);

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function isRoleAllowed(role, allowedRoles) {
  return Array.isArray(allowedRoles) && allowedRoles.includes(role);
}

export function isKidRole(role) {
  return typeof role === 'string' && role.length > 0 && role !== 'parent';
}

export function isValidChecklistDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime());
}

export function canKidToggleItem(item, actorRole, actorId = actorRole) {
  if (!isKidRole(actorRole)) return false;
  const assignees = Array.isArray(item?.assignedTo) ? item.assignedTo : [];
  if (assignees.length > 0) return assignees.includes(actorId);
  return !item?.requiredRole || item.requiredRole === actorRole || item.requiredRole === actorId;
}

export function normalizeChecklistItem(item, index = 0, { nowIso = nowIsoTimestamp() } = {}) {
  if (!item || typeof item !== 'object') return null;
  const title = cleanString(item.title);
  const assignedTo = Array.isArray(item.assignedTo)
    ? [...new Set(item.assignedTo.filter(value => CHECKLIST_ASSIGNEES.includes(value)))]
    : [];
  const requiredRole = cleanString(item.requiredRole) || null;
  const completedAt = item.completedAt === null || item.completedAt === undefined
    ? null
    : (isValidIsoTimestamp(item.completedAt) ? item.completedAt : null);
  return {
    id: cleanString(item.id),
    title,
    description: cleanString(item.description) || undefined,
    requiredRole,
    assignedTo,
    completedAt,
    completedBy: cleanString(item.completedBy) || null,
    orderIndex: Number.isInteger(item.orderIndex) ? item.orderIndex : index,
    updatedAt: isValidIsoTimestamp(item.updatedAt) ? item.updatedAt : nowIso
  };
}

export function normalizeChecklist(checklist, dateIso = checklist?.dateIso, { nowIso = nowIsoTimestamp() } = {}) {
  if (!checklist || typeof checklist !== 'object' || !isValidChecklistDate(dateIso)) return null;
  const checklistUpdatedAt = isValidIsoTimestamp(checklist.updatedAt) ? checklist.updatedAt : nowIso;
  const seen = new Set();
  const items = (Array.isArray(checklist.items) ? checklist.items : [])
    .map((item, index) => normalizeChecklistItem(item, index, { nowIso: checklistUpdatedAt }))
    .filter(item => item && item.id && !seen.has(item.id) && (seen.add(item.id), true))
    .sort((left, right) => left.orderIndex - right.orderIndex || left.id.localeCompare(right.id))
    .map((item, index) => ({ ...item, orderIndex: index }));
  return {
    dateIso,
    items,
    meta: checklist.meta && typeof checklist.meta === 'object' ? { ...checklist.meta } : {},
    updatedAt: checklistUpdatedAt,
    conflicts: Array.isArray(checklist.conflicts) ? checklist.conflicts : []
  };
}

export function validateChecklistItems(items) {
  if (!Array.isArray(items)) return { ok: false, message: 'Checklist-items skal være en liste.' };
  const ids = new Set();
  const orderIndexes = new Set();
  for (const [index, item] of items.entries()) {
    const normalized = normalizeChecklistItem(item, index);
    if (!normalized?.title) return { ok: false, message: 'Alle checklist-items skal have en titel.' };
    if (Array.isArray(item?.assignedTo) && item.assignedTo.some(id => !CHECKLIST_ASSIGNEES.includes(id))) return { ok: false, message: 'En tildeling er ugyldig.' };
    if (ids.has(normalized.id)) return { ok: false, message: 'Checklist-items skal have unikke id’er.' };
    if (orderIndexes.has(normalized.orderIndex)) return { ok: false, message: 'Checklist-items skal have unik rækkefølge.' };
    if (normalized.assignedTo.some(id => !CHECKLIST_ASSIGNEES.includes(id))) return { ok: false, message: 'En tildeling er ugyldig.' };
    ids.add(normalized.id);
    orderIndexes.add(normalized.orderIndex);
  }
  return { ok: true };
}

export function reorderChecklistItems(items, orderedItemIds) {
  if (!Array.isArray(items) || !Array.isArray(orderedItemIds)) return null;
  const byId = new Map(items.map(item => [item.id, item]));
  if (orderedItemIds.length !== byId.size || new Set(orderedItemIds).size !== orderedItemIds.length || orderedItemIds.some(id => !byId.has(id))) return null;
  return orderedItemIds.map((id, index) => ({ ...byId.get(id), orderIndex: index }));
}

function latestCompletion(left, right) {
  if (!left?.completedAt) return right;
  if (!right?.completedAt) return left;
  return new Date(left.completedAt) >= new Date(right.completedAt) ? left : right;
}

export function mergeChecklists(localChecklist, remoteChecklist) {
  if (!localChecklist) return normalizeChecklist(remoteChecklist);
  if (!remoteChecklist) return normalizeChecklist(localChecklist);
  const local = normalizeChecklist(localChecklist);
  const remote = normalizeChecklist(remoteChecklist);
  const remoteById = new Map(remote.items.map(item => [item.id, item]));
  const localById = new Map(local.items.map(item => [item.id, item]));
  const ids = [...new Set([...localById.keys(), ...remoteById.keys()])];
  const conflicts = [...(local.conflicts || []), ...(remote.conflicts || [])];
  const items = ids.map(id => {
    const left = localById.get(id);
    const right = remoteById.get(id);
    if (!left) return right;
    if (!right) return left;
    const completion = latestCompletion(left, right);
    const content = (right.updatedAt || '') > (left.updatedAt || '') ? right : left;
    if (left.completedAt && right.completedAt && left.completedAt !== right.completedAt) {
      conflicts.push({ type: 'completion', itemId: id, local: left.completedAt, remote: right.completedAt, detectedAt: nowIsoTimestamp() });
    }
    return { ...content, completedAt: completion.completedAt, completedBy: completion.completedBy };
  });
  return normalizeChecklist({
    ...local,
    ...remote,
    items,
    conflicts: conflicts.slice(-50),
    updatedAt: (remote.updatedAt || '') > (local.updatedAt || '') ? remote.updatedAt : local.updatedAt
  });
}

export function normalizeChecklists(checklists) {
  return (Array.isArray(checklists) ? checklists : [])
    .map(checklist => normalizeChecklist(checklist))
    .filter(Boolean)
    .filter((checklist, index, all) => all.findIndex(item => item.dateIso === checklist.dateIso) === index);
}
