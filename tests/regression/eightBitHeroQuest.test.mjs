import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EIGHT_BIT_HERO_QUEST_SCENE,
  QUEST_BEATS,
  QUEST_DURATION_MS,
  QUEST_HEIGHT,
  QUEST_VISUAL_STYLE,
  QUEST_WIDTH,
  createEightBitHeroQuestRenderer,
  drawEightBitHeroQuest,
  getQuestBeat,
  getQuestTime
} from '../../src/shared/eightBitHeroQuest.js';
import { createScreensaverView } from '../../src/ui/screensaverView.js';
import { JSDOM } from 'jsdom';

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

test('quest timeline covers the requested sixty-second story and loops to title', () => {
  assert.equal(QUEST_VISUAL_STYLE, '32-bit pixel adventure');
  assert.deepEqual(QUEST_BEATS.map(beat => beat.id), [
    'title', 'village-beacon', 'forest-journey', 'goblin-battle',
    'dragon-warning', 'dragon-battle', 'treasure', 'ending'
  ]);
  assert.deepEqual(QUEST_BEATS.map(beat => [beat.start, beat.end]), [
    [0, 5_000], [5_000, 12_000], [12_000, 20_000], [20_000, 30_000],
    [30_000, 40_000], [40_000, 50_000], [50_000, 57_000], [57_000, 60_000]
  ]);
  assert.equal(getQuestTime(QUEST_DURATION_MS), 0);
  assert.equal(getQuestBeat(4_999).id, 'title');
  assert.equal(getQuestBeat(5_000).id, 'village-beacon');
  assert.equal(getQuestBeat(29_999).id, 'goblin-battle');
  assert.equal(getQuestBeat(57_000).id, 'ending');
  assert.equal(getQuestBeat(QUEST_DURATION_MS).id, 'title');
});

test('quest renderer uses a fixed unsmoothed pixel canvas and static ending for reduced motion', () => {
  const context = createContext();
  const battleBeat = drawEightBitHeroQuest(context, 44_000);
  assert.equal(battleBeat.id, 'dragon-battle');
  assert.ok(context.calls.some(call => call[0] === 'imageSmoothingEnabled' && call[1] === false));
  assert.deepEqual(context.calls.find(call => call[0] === 'clearRect'), ['clearRect', 0, 0, QUEST_WIDTH, QUEST_HEIGHT]);
  assert.ok(context.calls.some(call => call[0] === 'fillRect'));
  assert.equal(drawEightBitHeroQuest(context, 1_000, { reducedMotion: true }).id, 'ending');
});

test('quest renderer schedules frames and cancels the active frame on stop', () => {
  const context = createContext();
  const canvas = { getContext: () => context, width: 0, height: 0 };
  let scheduledFrame = null;
  let cancelledId = null;
  const renderer = createEightBitHeroQuestRenderer(canvas, {
    now: () => 100,
    requestAnimationFrameFn: callback => {
      scheduledFrame = callback;
      return 11;
    },
    cancelAnimationFrameFn: id => { cancelledId = id; },
    reducedMotion: () => false
  });

  renderer.start();
  assert.equal(canvas.width, QUEST_WIDTH);
  assert.equal(canvas.height, QUEST_HEIGHT);
  assert.equal(renderer.isRunning(), true);
  assert.ok(scheduledFrame);
  scheduledFrame(1_000);
  renderer.stop();
  assert.equal(renderer.isRunning(), false);
  assert.equal(cancelledId, 11);
});

test('screensaver view runs only the quest renderer for the quest scene', () => {
  const dom = new JSDOM('<div id="overlay" hidden><canvas id="kid-heroes-comic-canvas"></canvas><canvas id="eight-bit-hero-quest-canvas"></canvas></div>');
  const overlay = dom.window.document.querySelector('#overlay');
  let comicStarts = 0;
  let questStarts = 0;
  let questStops = 0;
  const view = createScreensaverView(overlay, {
    createComicRenderer: () => ({ start: () => { comicStarts += 1; }, stop: () => {}, isRunning: () => comicStarts > 0 }),
    createQuestRenderer: () => ({ start: () => { questStarts += 1; }, stop: () => { questStops += 1; }, isRunning: () => questStarts > questStops })
  });

  view.show(EIGHT_BIT_HERO_QUEST_SCENE);
  assert.equal(questStarts, 1);
  assert.equal(comicStarts, 0);
  assert.equal(view.isQuestRunning(), true);
  view.show('cave-quest');
  assert.equal(questStops, 1);
  assert.equal(view.isQuestRunning(), false);
  dom.window.close();
});