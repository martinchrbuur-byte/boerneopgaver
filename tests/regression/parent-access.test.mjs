import test from 'node:test';
import assert from 'node:assert/strict';

import { createParentAccessService } from '../../src/services/parentAccessService.js';

test('parent access unlocks only with the exact hardcoded PIN', () => {
  const access = createParentAccessService();

  assert.equal(access.isUnlocked(), false);
  assert.equal(access.verifyPin('2106'), false);
  assert.equal(access.verifyPin('2107 '), false);
  assert.equal(access.verifyPin(' 2107'), false);
  assert.equal(access.verifyPin(''), false);
  assert.equal(access.verifyPin(2107), false);
  assert.equal(access.isUnlocked(), false);

  assert.equal(access.verifyPin('2107'), true);
  assert.equal(access.isUnlocked(), true);
});

test('parent access is in-memory and can be locked again', () => {
  const firstAccess = createParentAccessService();
  assert.equal(firstAccess.verifyPin('2107'), true);
  firstAccess.lock();
  assert.equal(firstAccess.isUnlocked(), false);

  const newAccess = createParentAccessService();
  assert.equal(newAccess.isUnlocked(), false);
});
