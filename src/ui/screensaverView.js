import { SCREENSAVER_SCENES } from '../shared/screensaverScenes.js';
import { KID_HEROES_COMIC_SCENE, createKidHeroesComicRenderer } from '../shared/kidHeroesComic.js';
import { EIGHT_BIT_HERO_QUEST_SCENE, createEightBitHeroQuestRenderer } from '../shared/eightBitHeroQuest.js';
import { TINY_HEROES_SCENE, createTinyHeroesAdventureRenderer } from '../shared/tinyHeroesAdventure.js';

export { SCREENSAVER_SCENES };

export function createScreensaverView(overlay, {
  createComicRenderer = createKidHeroesComicRenderer,
  createQuestRenderer = createEightBitHeroQuestRenderer,
  createTinyHeroesRenderer = createTinyHeroesAdventureRenderer
} = {}) {
  if (!overlay) {
    throw new Error('Screensaver overlay is required.');
  }

  const comicCanvas = overlay.querySelector('#kid-heroes-comic-canvas');
  const questCanvas = overlay.querySelector('#eight-bit-hero-quest-canvas');
  const tinyHeroesCanvas = overlay.querySelector('#tiny-heroes-adventure-canvas');
  let comicRenderer = null;
  let questRenderer = null;
  let tinyHeroesRenderer = null;

  function stopComic() {
    comicRenderer?.stop();
  }

  function stopQuest() {
    questRenderer?.stop();
  }

  function stopTinyHeroes() {
    tinyHeroesRenderer?.stop();
  }

  function startComic() {
    comicRenderer ??= comicCanvas ? createComicRenderer(comicCanvas) : null;
    comicRenderer?.start();
  }

  function startQuest() {
    questRenderer ??= questCanvas ? createQuestRenderer(questCanvas) : null;
    questRenderer?.start();
  }

  function startTinyHeroes() {
    tinyHeroesRenderer ??= tinyHeroesCanvas ? createTinyHeroesRenderer(tinyHeroesCanvas) : null;
    tinyHeroesRenderer?.start();
  }

  function show(scene = SCREENSAVER_SCENES[0]) {
    const nextScene = SCREENSAVER_SCENES.includes(scene) ? scene : SCREENSAVER_SCENES[0];
    stopComic();
    stopQuest();
    stopTinyHeroes();
    overlay.dataset.scene = nextScene;
    overlay.classList.remove('screensaver-waking');
    overlay.classList.add('screensaver-active');
    overlay.hidden = false;
    if (nextScene === KID_HEROES_COMIC_SCENE) {
      startComic();
    }
    if (nextScene === EIGHT_BIT_HERO_QUEST_SCENE) {
      startQuest();
    }
    if (nextScene === TINY_HEROES_SCENE) {
      startTinyHeroes();
    }
  }

  function hide() {
    stopComic();
    stopQuest();
    stopTinyHeroes();
    overlay.classList.remove('screensaver-active');
    overlay.classList.add('screensaver-waking');
    overlay.hidden = true;
  }

  return {
    hide,
    show,
    isVisible: () => !overlay.hidden,
    isComicRunning: () => comicRenderer?.isRunning?.() ?? false,
    isQuestRunning: () => questRenderer?.isRunning?.() ?? false,
    isTinyHeroesRunning: () => tinyHeroesRenderer?.isRunning?.() ?? false
  };
}
