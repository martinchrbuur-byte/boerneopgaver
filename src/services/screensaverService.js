import { SCREENSAVER_SCENES } from '../shared/screensaverScenes.js';

export const SCREENSAVER_TIMEOUT_MS = 60_000;
export const SCREENSAVER_ROTATION_MS = 90_000;
export { SCREENSAVER_SCENES };

export function createScreensaverService({
  timeoutMs = SCREENSAVER_TIMEOUT_MS,
  rotationMs = SCREENSAVER_ROTATION_MS,
  scenes = SCREENSAVER_SCENES,
  onActivate = () => {},
  onDismiss = () => {},
  setTimeoutFn = globalThis.setTimeout,
  clearTimeoutFn = globalThis.clearTimeout,
  pickScene = null
} = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
    throw new Error('Screensaver timeout must be a non-negative number.');
  }
  if (!Number.isFinite(rotationMs) || rotationMs < 0) {
    throw new Error('Screensaver rotation interval must be a non-negative number.');
  }

  const availableScenes = Array.isArray(scenes) && scenes.length > 0 ? [...scenes] : ['hero-patrol'];
  let timeoutId = null;
  let rotationTimeoutId = null;
  let enabled = false;
  let active = false;
  let disposed = false;
  let nextSceneIndex = 0;

  function chooseScene() {
    if (typeof pickScene === 'function') return pickScene(availableScenes);
    const scene = availableScenes[nextSceneIndex] ?? availableScenes[0];
    nextSceneIndex = (nextSceneIndex + 1) % availableScenes.length;
    return scene;
  }

  function resetSceneOrder() {
    nextSceneIndex = 0;
  }

  function clearTimer() {
    if (timeoutId !== null) {
      clearTimeoutFn(timeoutId);
      timeoutId = null;
    }
  }

  function clearRotationTimer() {
    if (rotationTimeoutId !== null) {
      clearTimeoutFn(rotationTimeoutId);
      rotationTimeoutId = null;
    }
  }

  function rotate() {
    if (disposed || !enabled || !active) {
      return;
    }

    onActivate(chooseScene());
    scheduleRotation();
  }

  function scheduleRotation() {
    clearRotationTimer();
    if (disposed || !enabled || !active) {
      return;
    }

    rotationTimeoutId = setTimeoutFn(rotate, rotationMs);
    rotationTimeoutId?.unref?.();
  }

  function activate() {
    if (disposed || !enabled || active) {
      return;
    }

    active = true;
    timeoutId = null;
    onActivate(chooseScene());
    scheduleRotation();
  }

  function schedule() {
    clearTimer();
    if (disposed || !enabled || active) {
      return;
    }

    timeoutId = setTimeoutFn(activate, timeoutMs);
    timeoutId?.unref?.();
  }

  function dismiss() {
    if (!active) {
      return false;
    }

    active = false;
    clearRotationTimer();
    onDismiss();
    return true;
  }

  function reset() {
    if (disposed || !enabled) {
      return;
    }

    if (active) {
      dismiss();
    }
    resetSceneOrder();
    schedule();
  }

  function setEnabled(nextEnabled) {
    const shouldEnable = Boolean(nextEnabled);
    if (shouldEnable === enabled) {
      return;
    }

    enabled = shouldEnable;
    if (!enabled) {
      clearTimer();
      dismiss();
      resetSceneOrder();
      return;
    }

    schedule();
  }

  function dispose() {
    if (disposed) {
      return;
    }

    disposed = true;
    clearTimer();
    dismiss();
    enabled = false;
  }

  return {
    activate,
    dismiss,
    dispose,
    isActive: () => active,
    isEnabled: () => enabled,
    reset,
    setEnabled
  };
}
