import test from 'node:test';
import assert from 'node:assert/strict';
import { createChecklistService } from '../../src/services/checklistService.js';
import { canKidToggleItem, mergeChecklists, reorderChecklistItems } from '../../src/shared/checklistModel.js';
import { createStorageService } from '../../src/services/storageService.js';

function memoryStorage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}
function build() {
  const storageService = createStorageService({ storage: memoryStorage() });
  return { storageService, service: createChecklistService({ storageService, nowProvider: () => '2026-01-01T10:00:00.000Z' }) };
}

const date = '2026-01-01';

test('checklist permission helpers enforce parent editing and kid assignment', () => {
  assert.equal(canKidToggleItem({ assignedTo: ['Andrea'] }, 'Hans Jørgen', 'Hans Jørgen'), false);
  assert.equal(canKidToggleItem({ assignedTo: [] }, 'Andrea', 'Andrea'), true);
  assert.equal(canKidToggleItem({ requiredRole: 'Andrea', assignedTo: [] }, 'Andrea', 'Andrea'), true);
  assert.equal(canKidToggleItem({ requiredRole: 'Andrea', assignedTo: [] }, 'Hans Jørgen', 'Hans Jørgen'), false);
});

test('parent creates and edits a date-scoped checklist; kids cannot edit', () => {
  const { service } = build();
  const created = service.createChecklist(date, [{ title: 'Put shoes away' }], { label: 'Morning' }, { actorRole: 'parent' });
  assert.equal(created.ok, true);
  const itemId = created.state.checklist.items[0].id;
  assert.equal(service.updateItem(date, itemId, { title: 'Put all shoes away' }, { actorRole: 'Hans Jørgen' }).ok, false);
  assert.equal(service.updateItem(date, itemId, { title: 'Put all shoes away' }, { actorRole: 'parent' }).ok, true);
});

test('new day carries checklist items forward without checkmarks', () => {
  const { service } = build();
  service.createChecklist(date, [{ title: 'Feed cat', assignedTo: ['Andrea'] }], {}, { actorRole: 'parent' });
  service.toggleComplete(date, service.getChecklist(date).state.checklist.items[0].id, 'Andrea', 'Andrea');
  const nextDate = '2026-01-02';
  const carried = service.carryForwardChecklist(nextDate, { actorRole: 'parent' });
  const item = carried.state.checklist.items[0];
  assert.equal(carried.ok, true);
  assert.equal(item.title, 'Feed cat');
  assert.equal(item.completedAt, null);
  assert.equal(item.completedBy, null);
  assert.deepEqual(item.assignedTo, ['Andrea']);
  assert.notEqual(item.id, service.getChecklist(date).state.checklist.items[0].id);
});

test('kid toggles assigned item and undo is offline-persisted', () => {
  const { service, storageService } = build();
  service.createChecklist(date, [{ id: 'a', title: 'Feed cat', assignedTo: ['Andrea'] }], {}, { actorRole: 'parent' });
  assert.equal(service.toggleComplete(date, 'a', 'Andrea', 'Andrea').ok, true);
  assert.equal(storageService.loadData().checklists[0].items[0].completedBy, 'Andrea');
  assert.equal(service.toggleComplete(date, 'a', 'Andrea', 'Andrea').state.checklist.items[0].completedAt, null);
});

test('reorder helper rejects incomplete orders and assigns unique indexes', () => {
  const items = [{ id: 'a', orderIndex: 0 }, { id: 'b', orderIndex: 1 }];
  assert.equal(reorderChecklistItems(items, ['a']) , null);
  assert.deepEqual(reorderChecklistItems(items, ['b', 'a']).map(item => item.orderIndex), [0, 1]);
});

test('parent can reorder checklist items and the order is persisted', () => {
  const { service, storageService } = build();
  service.createChecklist(date, [{ id: 'a', title: 'First' }, { id: 'b', title: 'Second' }], {}, { actorRole: 'parent' });

  const reordered = service.reorderItems(date, ['b', 'a'], { actorRole: 'parent' });
  assert.equal(reordered.ok, true);
  assert.deepEqual(reordered.state.checklist.items.map(item => item.id), ['b', 'a']);
  assert.deepEqual(reordered.state.checklist.items.map(item => item.orderIndex), [0, 1]);
  assert.deepEqual(storageService.loadData().checklists[0].items.map(item => item.id), ['b', 'a']);
  assert.equal(service.reorderItems(date, ['a', 'b'], { actorRole: 'Andrea' }).ok, false);
});

test('merge keeps latest completion and surfaces conflicting timestamps', () => {
  const local = { dateIso: date, updatedAt: '2026-01-01T10:00:00.000Z', items: [{ id: 'a', title: 'Task', completedAt: '2026-01-01T09:00:00.000Z', completedBy: 'Andrea', orderIndex: 0 }] };
  const remote = { dateIso: date, updatedAt: '2026-01-01T11:00:00.000Z', items: [{ id: 'a', title: 'Task edited', completedAt: '2026-01-01T10:30:00.000Z', completedBy: 'Hans Jørgen', orderIndex: 0 }] };
  const merged = mergeChecklists(local, remote);
  assert.equal(merged.items[0].completedBy, 'Hans Jørgen');
  assert.equal(merged.conflicts.length, 1);
  assert.equal(merged.items[0].title, 'Task edited');
});
