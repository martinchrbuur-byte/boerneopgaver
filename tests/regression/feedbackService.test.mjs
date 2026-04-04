import test from 'node:test';
import assert from 'node:assert/strict';
import { createFeedbackService } from '../../src/services/feedbackService.js';

function createStorageServiceDouble(initialData = {}) {
  let data = {
    feedback: [],
    ...initialData
  };

  return {
    loadData() {
      return data;
    },
    updateData(updater) {
      data = updater(data);
      return data;
    }
  };
}

test('feedback service stores parent feedback and returns newest first', () => {
  const storageService = createStorageServiceDouble();
  const timestamps = ['2026-04-04T10:00:00.000Z', '2026-04-04T11:00:00.000Z'];
  const service = createFeedbackService({
    storageService,
    nowProvider: () => timestamps.shift() || '2026-04-04T12:00:00.000Z'
  });

  const first = service.createFeedbackEntry({ actorRole: 'parent', title: 'A', message: 'First note' });
  const second = service.createFeedbackEntry({ actorRole: 'parent', title: 'B', message: 'Second note', category: 'bug' });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);

  const entries = service.listEntries();
  assert.equal(entries.length, 2);
  assert.equal(entries[0].title, 'B');
  assert.equal(entries[0].category, 'bug');
  assert.equal(entries[1].title, 'A');
});

test('feedback service rejects kid submissions and empty feedback', () => {
  const storageService = createStorageServiceDouble();
  const service = createFeedbackService({ storageService, nowProvider: () => '2026-04-04T10:00:00.000Z' });

  const kidResult = service.createFeedbackEntry({ actorRole: 'Andrea', message: 'Please add more games' });
  assert.equal(kidResult.ok, false);

  const emptyResult = service.createFeedbackEntry({ actorRole: 'parent', message: '   ' });
  assert.equal(emptyResult.ok, false);
  assert.equal(service.listEntries().length, 0);
});