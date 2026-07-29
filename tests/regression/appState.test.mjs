import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppState } from '../../src/state/appState.js';

test('app state exposes defaults, updates, snapshots, and reset', () => {
  const state = createAppState();

  assert.deepEqual(state.snapshot(), {
    activeMode: 'chores',
    activeTab: 'opgaver',
    kidChorePage: 1
  });

  state.activeTab = 'periode';
  state.activeMode = 'chores';
  state.kidChorePage = 3;
  assert.equal(state.activeTab, 'periode');
  assert.equal(state.kidChorePage, 3);

  state.kidChorePage = 0;
  assert.equal(state.kidChorePage, 1);
  state.reset();
  assert.deepEqual(state.snapshot(), {
    activeMode: 'chores',
    activeTab: 'opgaver',
    kidChorePage: 1
  });
});
