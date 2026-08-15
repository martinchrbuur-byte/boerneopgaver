import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createScreensaverService,
  SCREENSAVER_SCENES,
  SCREENSAVER_ROTATION_MS,
  SCREENSAVER_TIMEOUT_MS
} from '../../src/services/screensaverService.js';

function createFakeScheduler() {
  let nextId = 1;
  const pending = new Map();
  const delays = [];

  return {
    clearTimeout(id) {
      pending.delete(id);
    },
    delays,
    fireNext() {
      const [id, callback] = pending.entries().next().value ?? [];
      if (!id) return false;
      pending.delete(id);
      callback();
      return true;
    },
    pendingCount() {
      return pending.size;
    },
    setTimeout(callback, delay) {
      const id = nextId++;
      pending.set(id, callback);
      delays.push(delay);
      return id;
    }
  };
}

test('screensaver registry starts with the sixty-second quest and contains all adventure scenes', () => {
  assert.deepEqual(SCREENSAVER_SCENES, [
    'eight-bit-hero-quest',
    'kid-heroes-comic',
    'cave-quest',
    'wizard-dragon',
    'slime-forest',
    'monster-friend',
    'dragon-boat'
  ]);
});

test('screensaver waits exactly one minute before activating', () => {
  const scheduler = createFakeScheduler();
  const activations = [];
  const service = createScreensaverService({
    onActivate: scene => activations.push(scene),
    setTimeoutFn: scheduler.setTimeout,
    clearTimeoutFn: scheduler.clearTimeout
  });

  service.setEnabled(true);
  assert.equal(scheduler.delays.at(-1), SCREENSAVER_TIMEOUT_MS);
  assert.equal(scheduler.pendingCount(), 1);
  assert.deepEqual(activations, []);

  scheduler.fireNext();
  assert.equal(activations.length, 1);
  assert.equal(activations[0], 'eight-bit-hero-quest');
  assert.equal(service.isActive(), true);
});

test('active screensaver rotates scenes in registry order every 90 seconds', () => {
  const scheduler = createFakeScheduler();
  const activations = [];
  const scenes = ['hero-patrol', 'treasure-hunt'];
  const service = createScreensaverService({
    scenes,
    onActivate: scene => activations.push(scene),
    setTimeoutFn: scheduler.setTimeout,
    clearTimeoutFn: scheduler.clearTimeout
  });

  service.setEnabled(true);
  scheduler.fireNext();
  assert.deepEqual(activations, ['hero-patrol']);
  assert.equal(scheduler.delays.at(-1), SCREENSAVER_ROTATION_MS);

  scheduler.fireNext();
  assert.deepEqual(activations, ['hero-patrol', 'treasure-hunt']);
  assert.equal(scheduler.delays.at(-1), SCREENSAVER_ROTATION_MS);

  scheduler.fireNext();
  assert.deepEqual(activations, ['hero-patrol', 'treasure-hunt', 'hero-patrol']);
});

test('activity resets the timer and dismisses an active screensaver', () => {
  const scheduler = createFakeScheduler();
  const events = [];
  const service = createScreensaverService({
    onActivate: scene => events.push(`activate:${scene}`),
    onDismiss: () => events.push('dismiss'),
    pickScene: () => 'hero-patrol',
    setTimeoutFn: scheduler.setTimeout,
    clearTimeoutFn: scheduler.clearTimeout
  });

  service.setEnabled(true);
  scheduler.fireNext();
  service.reset();

  assert.deepEqual(events, ['activate:hero-patrol', 'dismiss']);
  assert.equal(service.isActive(), false);
  assert.equal(scheduler.pendingCount(), 1);

  service.reset();
  assert.equal(scheduler.pendingCount(), 1);
});

test('disabling or disposing clears timers and hides the screensaver', () => {
  const scheduler = createFakeScheduler();
  let dismissCount = 0;
  const service = createScreensaverService({
    onDismiss: () => dismissCount++,
    pickScene: () => 'treasure-hunt',
    setTimeoutFn: scheduler.setTimeout,
    clearTimeoutFn: scheduler.clearTimeout
  });

  service.setEnabled(true);
  scheduler.fireNext();
  service.setEnabled(false);

  assert.equal(service.isEnabled(), false);
  assert.equal(service.isActive(), false);
  assert.equal(scheduler.pendingCount(), 0);
  assert.equal(dismissCount, 1);

  service.setEnabled(true);
  assert.equal(scheduler.pendingCount(), 1);
  service.dispose();
  assert.equal(scheduler.pendingCount(), 0);
  assert.equal(service.isEnabled(), false);
  assert.equal(service.isActive(), false);
});
