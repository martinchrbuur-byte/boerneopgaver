import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import {
  COMIC_BEATS,
  COMIC_DURATION_MS,
  COMIC_HEIGHT,
  COMIC_WIDTH,
  KID_HEROES_COMIC_SCENE,
  createKidHeroesComicRenderer,
  drawKidHeroesComic,
  getComicBeat,
  getComicTime
} from '../../src/shared/kidHeroesComic.js';
import { createScreensaverView } from '../../src/ui/screensaverView.js';

function createContext() {
  const calls = [];
  return {
    calls,
    clearRect: (...args) => calls.push(['clearRect', ...args]),
    fillRect: (...args) => calls.push(['fillRect', ...args]),
    set fillStyle(value) { calls.push(['fillStyle', value]); },
    set imageSmoothingEnabled(value) { calls.push(['imageSmoothingEnabled', value]); }
  };
}

test('comic timeline supplies every requested story beat and loops exactly at 30 seconds', () => {
  assert.deepEqual(COMIC_BEATS.map(beat => beat.id), [
    'title',
    'dragon-attack',
    'heroes-ready',
    'sword-battle',
    'arrow-volley',
    'dragon-defeat',
    'victory',
    'treasure',
    'ending'
  ]);
  assert.equal(getComicTime(COMIC_DURATION_MS), 0);
  assert.equal(getComicBeat(1_999).id, 'title');
  assert.equal(getComicBeat(2_000).id, 'dragon-attack');
  assert.equal(getComicBeat(29_999).id, 'ending');
  assert.equal(getComicBeat(COMIC_DURATION_MS).id, 'title');
});

test('comic draws only on its fixed pixel canvas with smoothing disabled', () => {
  const context = createContext();
  const beat = drawKidHeroesComic(context, 14_000);

  assert.equal(beat.id, 'arrow-volley');
  assert.ok(context.calls.some(call => call[0] === 'imageSmoothingEnabled' && call[1] === false));
  assert.deepEqual(context.calls.find(call => call[0] === 'clearRect'), ['clearRect', 0, 0, COMIC_WIDTH, COMIC_HEIGHT]);
  assert.ok(context.calls.some(call => call[0] === 'fillRect'));
});

test('reduced-motion rendering selects the static readable ending frame', () => {
  const context = createContext();
  const beat = drawKidHeroesComic(context, 1_000, { reducedMotion: true });

  assert.equal(beat.id, 'ending');
});

test('comic renderer starts, schedules frames, and cancels them on stop', () => {
  const context = createContext();
  const canvas = { getContext: () => context, width: 0, height: 0 };
  let callback = null;
  let cancelledId = null;
  const renderer = createKidHeroesComicRenderer(canvas, {
    now: () => 500,
    requestAnimationFrameFn: frame => {
      callback = frame;
      return 7;
    },
    cancelAnimationFrameFn: id => { cancelledId = id; },
    reducedMotion: () => false
  });

  renderer.start();
  assert.equal(canvas.width, COMIC_WIDTH);
  assert.equal(canvas.height, COMIC_HEIGHT);
  assert.equal(renderer.isRunning(), true);
  assert.ok(callback);
  callback(2_500);
  renderer.stop();
  assert.equal(renderer.isRunning(), false);
  assert.equal(cancelledId, 7);
});

test('screensaver view starts the comic only for its registered scene and stops it on hide', () => {
  const dom = new JSDOM('<div id="overlay" hidden><canvas id="kid-heroes-comic-canvas"></canvas></div>');
  const overlay = dom.window.document.querySelector('#overlay');
  let starts = 0;
  let stops = 0;
  const view = createScreensaverView(overlay, {
    createComicRenderer: () => ({
      start: () => { starts += 1; },
      stop: () => { stops += 1; },
      isRunning: () => starts > stops
    })
  });

  view.show('cave-quest');
  assert.equal(starts, 0);
  view.show(KID_HEROES_COMIC_SCENE);
  assert.equal(starts, 1);
  assert.equal(view.isComicRunning(), true);
  view.hide();
  assert.equal(stops, 1);
  assert.equal(view.isComicRunning(), false);
  dom.window.close();
});
