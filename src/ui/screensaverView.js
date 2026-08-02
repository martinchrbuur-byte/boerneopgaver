import { SCREENSAVER_SCENES } from '../shared/screensaverScenes.js';

export { SCREENSAVER_SCENES };

export function createScreensaverView(overlay) {
  if (!overlay) {
    throw new Error('Screensaver overlay is required.');
  }

  function show(scene = SCREENSAVER_SCENES[0]) {
    const nextScene = SCREENSAVER_SCENES.includes(scene) ? scene : SCREENSAVER_SCENES[0];
    overlay.dataset.scene = nextScene;
    overlay.classList.remove('screensaver-waking');
    overlay.classList.add('screensaver-active');
    overlay.hidden = false;
  }

  function hide() {
    overlay.classList.remove('screensaver-active');
    overlay.classList.add('screensaver-waking');
    overlay.hidden = true;
  }

  return {
    hide,
    show,
    isVisible: () => !overlay.hidden
  };
}
