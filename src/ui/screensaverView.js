import { SCREENSAVER_SCENES } from '../shared/screensaverScenes.js';
import { KID_HEROES_COMIC_SCENE, createKidHeroesComicRenderer } from '../shared/kidHeroesComic.js';

export { SCREENSAVER_SCENES };

export function createScreensaverView(overlay, { createComicRenderer = createKidHeroesComicRenderer } = {}) {
  if (!overlay) {
    throw new Error('Screensaver overlay is required.');
  }

  const comicCanvas = overlay.querySelector('#kid-heroes-comic-canvas');
  let comicRenderer = null;

  function stopComic() {
    comicRenderer?.stop();
  }

  function startComic() {
    comicRenderer ??= comicCanvas ? createComicRenderer(comicCanvas) : null;
    comicRenderer?.start();
  }

  function show(scene = SCREENSAVER_SCENES[0]) {
    const nextScene = SCREENSAVER_SCENES.includes(scene) ? scene : SCREENSAVER_SCENES[0];
    stopComic();
    overlay.dataset.scene = nextScene;
    overlay.classList.remove('screensaver-waking');
    overlay.classList.add('screensaver-active');
    overlay.hidden = false;
    if (nextScene === KID_HEROES_COMIC_SCENE) {
      startComic();
    }
  }

  function hide() {
    stopComic();
    overlay.classList.remove('screensaver-active');
    overlay.classList.add('screensaver-waking');
    overlay.hidden = true;
  }

  return {
    hide,
    show,
    isVisible: () => !overlay.hidden,
    isComicRunning: () => comicRenderer?.isRunning?.() ?? false
  };
}
