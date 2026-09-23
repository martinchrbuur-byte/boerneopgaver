import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TINY_HEROES_BEATS,
  TINY_HEROES_DURATION_MS,
  TINY_HEROES_HEIGHT,
  TINY_HEROES_SCENE,
  TINY_HEROES_VISUAL_STYLE,
  TINY_HEROES_WIDTH,
  drawTinyHeroesAdventure,
  getTinyHeroesBeat,
  getTinyHeroesTime
} from '../../src/shared/tinyHeroesAdventure.js';

function createContext() {
  const calls = [];
  return {
    calls,
    clearRect: (...args) => calls.push(['clearRect', ...args]),
    fillRect: (...args) => calls.push(['fillRect', ...args]),
    fillText: (...args) => calls.push(['fillText', ...args]),
    set fillStyle(value) { calls.push(['fillStyle', value]); },
    set font(value) { calls.push(['font', value]); },
    set textAlign(value) { calls.push(['textAlign', value]); },
    set textBaseline(value) { calls.push(['textBaseline', value]); },
    set imageSmoothingEnabled(value) { calls.push(['imageSmoothingEnabled', value]); }
  };
}

test('Tiny Heroes timeline follows the requested one-minute mini-quest', () => {
  assert.equal(TINY_HEROES_SCENE, 'tiny-heroes-adventure');
  assert.equal(TINY_HEROES_VISUAL_STYLE, 'pastel chibi forest adventure');
  assert.deepEqual(TINY_HEROES_BEATS.map(beat => beat.id), [
    'title', 'quest-begins', 'obstacles', 'monster', 'battle', 'treasure', 'ending'
  ]);
  assert.deepEqual(TINY_HEROES_BEATS.map(beat => [beat.start, beat.end]), [
    [0, 5_000], [5_000, 12_000], [12_000, 20_000], [20_000, 30_000],
    [30_000, 40_000], [40_000, 50_000], [50_000, 60_000]
  ]);
  assert.equal(getTinyHeroesTime(TINY_HEROES_DURATION_MS), 0);
  assert.equal(getTinyHeroesBeat(5_000).id, 'quest-begins');
  assert.equal(getTinyHeroesBeat(30_000).id, 'battle');
  assert.equal(getTinyHeroesBeat(50_000).id, 'ending');
});

test('Tiny Heroes renderer paints a forest scene and holds the ending for reduced motion', () => {
  const context = createContext();
  assert.equal(drawTinyHeroesAdventure(context, 35_000).id, 'battle');
  assert.deepEqual(context.calls.find(call => call[0] === 'clearRect'), [
    'clearRect', 0, 0, TINY_HEROES_WIDTH, TINY_HEROES_HEIGHT
  ]);
  assert.ok(context.calls.some(call => call[0] === 'fillRect'));
  assert.equal(drawTinyHeroesAdventure(context, 0, { reducedMotion: true }).id, 'ending');
});
