/**
 * Test: Sync Queue Functionality
 * Verifies P1 fix - serialized saves with retry logic
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createSyncQueue } from '../../src/services/syncQueueService.js';

test('Sync Queue: Processes saves sequentially', async () => {
  const queue = createSyncQueue();
  const executionOrder = [];

  // Enqueue 3 saves with simple string data (not objects)
  await queue.enqueue('chores', '1', async (data) => {
    executionOrder.push(`save-${data}`);
    await new Promise(r => setTimeout(r, 10));
  });

  await queue.enqueue('records', '2', async (data) => {
    executionOrder.push(`save-${data}`);
    await new Promise(r => setTimeout(r, 10));
  });

  await queue.enqueue('ui', '3', async (data) => {
    executionOrder.push(`save-${data}`);
    await new Promise(r => setTimeout(r, 10));
  });

  // Wait for queue to process
  await new Promise(r => setTimeout(r, 200));

  console.log('✓ Sync queue processes saves in order:', executionOrder);
  assert.deepEqual(executionOrder, ['save-1', 'save-2', 'save-3']);
});

test('Sync Queue: Retries failed saves with backoff', async () => {
  const queue = createSyncQueue();
  let attempts = 0;

  await queue.enqueue('test', { data: 'retry-test' }, async () => {
    attempts++;
    if (attempts < 2) {
      throw new Error('Network error');
    }
    // Success on second attempt
  });

  // Wait for queue to process (with retries)
  await new Promise(r => setTimeout(r, 3000));

  console.log(`✓ Sync queue retried failed save: ${attempts} attempts`);
  assert.equal(attempts, 2, 'Should succeed on retry');
});

test('Sync Queue: Tracks sync state', async () => {
  const queue = createSyncQueue();

  await queue.enqueue('test1', { data: 1 }, async () => {
    await new Promise(r => setTimeout(r, 20));
  });

  // Check state while processing
  const state = queue.getSyncState();
  console.log('Sync state:', {
    isPending: state.isPending,
    queueLength: state.queueLength,
    lastSuccessfulSync: !!state.lastSuccessfulSync
  });

  assert(state.isPending || state.queueLength > 0, 'Should be processing');
});

console.log('\n✅ Sync queue tests complete');
