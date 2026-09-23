import { getBeatProgress, getTimelineBeat, loopTime } from './sceneTimeline.js';

export const TINY_HEROES_SCENE = 'tiny-heroes-adventure';
export const TINY_HEROES_DURATION_MS = 60_000;
export const TINY_HEROES_WIDTH = 320;
export const TINY_HEROES_HEIGHT = 180;
export const TINY_HEROES_VISUAL_STYLE = 'pastel chibi forest adventure';

export const TINY_HEROES_BEATS = Object.freeze([
  { id: 'title', start: 0, end: 5_000, text: 'TINY HEROES!' },
  { id: 'quest-begins', start: 5_000, end: 12_000, text: 'A QUEST BEGINS!' },
  { id: 'obstacles', start: 12_000, end: 20_000, text: 'ONWARD!' },
  { id: 'monster', start: 20_000, end: 30_000, text: 'A FRIENDLY FOE!' },
  { id: 'battle', start: 30_000, end: 40_000, text: 'POOF! DING!' },
  { id: 'treasure', start: 40_000, end: 50_000, text: 'A HEART-GEM!' },
  { id: 'ending', start: 50_000, end: TINY_HEROES_DURATION_MS, text: 'ADVENTURE COMPLETE!' }
]);

const COLORS = Object.freeze({
  ink: '#27324f', sky: '#a8e7ee', cloud: '#effff0', hill: '#9bd69a', grass: '#69bd83',
  grassLight: '#b7e48f', tree: '#4d9f72', treeLight: '#80c98a', brown: '#a96e4b',
  wood: '#d99455', skin: '#ffd6a0', red: '#e85d5d', hair: '#d95745', blonde: '#ffd56b',
  dress: '#f58cac', blue: '#70b9e8', gold: '#ffd85c', purple: '#a77bd4', monster: '#b9a2df',
  monsterDark: '#8b70ba', white: '#fffced', heart: '#ff718c', sparkle: '#fff6a9'
});

function fill(ctx, color, x, y, width, height) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
}

function text(ctx, value, x, y, size, color = COLORS.ink) {
  ctx.font = `bold ${size}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}

function drawSparkles(ctx, time, count = 18) {
  for (let index = 0; index < count; index += 1) {
    const x = 12 + (index * 53) % 296;
    const y = 12 + (index * 31) % 128;
    const twinkle = Math.sin(time / 180 + index) > 0;
    if (twinkle) {
      fill(ctx, COLORS.sparkle, x, y, 3, 3);
      fill(ctx, COLORS.white, x - 2, y + 1, 7, 1);
      fill(ctx, COLORS.white, x + 1, y - 2, 1, 7);
    }
  }
}

function drawForest(ctx, time) {
  fill(ctx, COLORS.sky, 0, 0, TINY_HEROES_WIDTH, TINY_HEROES_HEIGHT);
  fill(ctx, COLORS.cloud, 25, 27, 34, 5);
  fill(ctx, COLORS.cloud, 245, 40, 43, 5);
  fill(ctx, COLORS.hill, 0, 84, 320, 46);
  fill(ctx, COLORS.grass, 0, 116, 320, 64);
  fill(ctx, COLORS.grassLight, 0, 143, 320, 37);
  for (let x = -20; x < 340; x += 70) {
    const treeX = x + Math.sin(time / 2600 + x) * 5;
    fill(ctx, COLORS.tree, treeX + 14, 48, 13, 64);
    fill(ctx, COLORS.treeLight, treeX, 31, 43, 42);
    fill(ctx, COLORS.tree, treeX + 8, 22, 27, 32);
  }
  for (let x = 8; x < 320; x += 29) fill(ctx, COLORS.grassLight, x, 130 + (x % 3), 3, 8);
  drawSparkles(ctx, time);
}

function drawBoy(ctx, x, y, { jump = 0, sword = false, armsUp = false } = {}) {
  const bounce = Math.sin(jump) * 3;
  const top = y + bounce;
  fill(ctx, COLORS.ink, x + 8, top + 49, 25, 30);
  fill(ctx, COLORS.blue, x + 10, top + 48, 21, 22);
  fill(ctx, COLORS.ink, x + 8, top + 16, 26, 28);
  fill(ctx, COLORS.hair, x + 10, top + 12, 22, 20);
  fill(ctx, COLORS.skin, x + 13, top + 22, 17, 17);
  fill(ctx, COLORS.ink, x + 15, top + 28, 3, 4);
  fill(ctx, COLORS.ink, x + 25, top + 28, 3, 4);
  fill(ctx, COLORS.skin, x + (armsUp ? 1 : 2), top + (armsUp ? 37 : 48), 8, 5);
  fill(ctx, COLORS.skin, x + 31, top + (armsUp ? 34 : 48), 8, 5);
  fill(ctx, COLORS.ink, x + 11, top + 70, 7, 11);
  fill(ctx, COLORS.ink, x + 25, top + 70, 7, 11);
  if (sword) {
    fill(ctx, COLORS.ink, x + 35, top + 13, 4, 39);
    fill(ctx, COLORS.white, x + 36, top + 14, 2, 30);
    fill(ctx, COLORS.gold, x + 31, top + 40, 12, 4);
  }
}

function drawGirl(ctx, x, y, { jump = 0, bow = false, firing = false, armsUp = false } = {}) {
  const bounce = Math.sin(jump + 1) * 3;
  const top = y + bounce;
  fill(ctx, COLORS.ink, x + 8, top + 49, 26, 30);
  fill(ctx, COLORS.dress, x + 10, top + 48, 22, 22);
  fill(ctx, COLORS.blonde, x + 8, top + 12, 27, 31);
  fill(ctx, COLORS.skin, x + 13, top + 23, 17, 16);
  fill(ctx, COLORS.ink, x + 15, top + 29, 3, 4);
  fill(ctx, COLORS.ink, x + 25, top + 29, 3, 4);
  fill(ctx, COLORS.skin, x + 1, top + (armsUp ? 35 : 48), 8, 5);
  fill(ctx, COLORS.skin, x + 32, top + (armsUp ? 34 : 48), 8, 5);
  fill(ctx, COLORS.ink, x + 11, top + 69, 7, 12);
  fill(ctx, COLORS.ink, x + 25, top + 69, 7, 12);
  fill(ctx, COLORS.red, x + 27, top + 13, 8, 7);
  if (bow) {
    fill(ctx, COLORS.purple, x + 38, top + 22, 3, 34);
    if (firing) {
      fill(ctx, COLORS.white, x + 39, top + 36, 38, 2);
      fill(ctx, COLORS.gold, x + 75, top + 32, 7, 9);
    }
  }
}

function drawButterfly(ctx, time) {
  const x = 158 + Math.sin(time / 500) * 55;
  const y = 52 + Math.sin(time / 330) * 16;
  const flap = Math.sin(time / 90) > 0 ? 2 : -2;
  fill(ctx, COLORS.purple, x - 7, y - 4 - flap, 7, 8);
  fill(ctx, COLORS.heart, x + 1, y - 4 - flap, 7, 8);
  fill(ctx, COLORS.gold, x - 1, y, 3, 8);
  drawSparkles(ctx, time + 200, 5);
}

function drawMonster(ctx, x, y, { silly = false, poof = false } = {}) {
  fill(ctx, COLORS.monsterDark, x + 2, y + 26, 70, 40);
  fill(ctx, COLORS.monster, x, y + 12, 74, 57);
  fill(ctx, COLORS.monster, x + 12, y, 50, 72);
  fill(ctx, COLORS.white, x + 19, y + 24, 12, 14);
  fill(ctx, COLORS.white, x + 43, y + 24, 12, 14);
  fill(ctx, COLORS.ink, x + (silly ? 26 : 22), y + 28, 5, 7);
  fill(ctx, COLORS.ink, x + (silly ? 47 : 47), y + 28, 5, 7);
  fill(ctx, silly ? COLORS.heart : COLORS.ink, x + 29, y + 48, 16, 5);
  if (poof) {
    for (let index = 0; index < 7; index += 1) fill(ctx, COLORS.white, x - 8 + index * 13, y + 4 + (index % 2) * 57, 7, 7);
  }
}

function drawHeartGem(ctx, x, y, time) {
  const float = Math.sin(time / 220) * 3;
  fill(ctx, COLORS.heart, x - 12, y + float, 11, 13);
  fill(ctx, COLORS.heart, x + 1, y + float, 11, 13);
  fill(ctx, COLORS.heart, x - 7, y + 9 + float, 15, 12);
  fill(ctx, COLORS.white, x - 5, y + 3 + float, 4, 4);
  drawSparkles(ctx, time + 400, 7);
}

export function getTinyHeroesTime(elapsedMs) {
  return loopTime(elapsedMs, TINY_HEROES_DURATION_MS);
}

export function getTinyHeroesBeat(elapsedMs) {
  return getTimelineBeat(TINY_HEROES_BEATS, elapsedMs, TINY_HEROES_DURATION_MS);
}

export function drawTinyHeroesAdventure(context, elapsedMs, { reducedMotion = false } = {}) {
  if (!context) return null;
  const time = reducedMotion ? 50_000 : getTinyHeroesTime(elapsedMs);
  const beat = getTinyHeroesBeat(time);
  const progress = getBeatProgress(beat, time, TINY_HEROES_DURATION_MS);
  context.imageSmoothingEnabled = true;
  context.clearRect(0, 0, TINY_HEROES_WIDTH, TINY_HEROES_HEIGHT);
  drawForest(context, time);
  const bounce = time / 180;

  if (beat.id === 'title') {
    text(context, 'TINY HEROES!', 160, 35, 25, COLORS.red);
    text(context, 'A magical mini-quest', 160, 57, 11, COLORS.ink);
    drawBoy(context, 80, 87, { jump: bounce, sword: true, armsUp: true });
    drawGirl(context, 196, 87, { jump: bounce, bow: true, armsUp: true });
  } else if (beat.id === 'quest-begins') {
    drawButterfly(context, time);
    drawBoy(context, 77, 88, { jump: bounce });
    drawGirl(context, 126, 88, { jump: bounce });
    text(context, 'A QUEST BEGINS!', 160, 22, 17, COLORS.purple);
  } else if (beat.id === 'obstacles') {
    fill(context, COLORS.brown, 128, 121, 63, 13);
    fill(context, COLORS.wood, 130, 122, 60, 8);
    drawBoy(context, 72 + progress * 45, 78, { jump: bounce + 2 });
    drawGirl(context, 181 + progress * 24, 83, { jump: bounce });
    text(context, 'ONWARD!', 160, 21, 17, COLORS.red);
  } else if (beat.id === 'monster') {
    drawBoy(context, 51, 88, { jump: bounce, sword: true });
    drawGirl(context, 102, 88, { jump: bounce, bow: true });
    drawMonster(context, 216, 78, { silly: progress > 0.5 });
    text(context, 'A FRIENDLY FOE!', 160, 21, 15, COLORS.purple);
  } else if (beat.id === 'battle') {
    drawBoy(context, 48 + progress * 35, 86, { jump: bounce, sword: true });
    drawGirl(context, 105, 86, { jump: bounce, bow: true, firing: progress > 0.35 });
    drawMonster(context, 218, 78, { silly: true, poof: progress > 0.2 });
    text(context, progress > 0.45 ? 'DING!' : 'POOF!', 175, 52, 22, COLORS.gold);
  } else if (beat.id === 'treasure') {
    drawMonster(context, 214, 80, { silly: true });
    drawBoy(context, 57, 82, { jump: bounce, armsUp: true });
    drawGirl(context, 110, 82, { jump: bounce, armsUp: true });
    drawHeartGem(context, 170, 60, time);
    text(context, 'A HEART-GEM!', 160, 22, 17, COLORS.heart);
  } else {
    drawBoy(context, 73, 80, { jump: bounce, sword: true, armsUp: true });
    drawGirl(context, 192, 80, { jump: bounce, bow: true, armsUp: true });
    drawHeartGem(context, 156, 47, time);
    text(context, 'ADVENTURE COMPLETE!', 160, 22, 16, COLORS.red);
  }
  return beat;
}

export function createTinyHeroesAdventureRenderer(canvas, {
  requestAnimationFrameFn = globalThis.requestAnimationFrame,
  cancelAnimationFrameFn = globalThis.cancelAnimationFrame,
  now = () => globalThis.performance?.now?.() ?? Date.now(),
  reducedMotion = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
} = {}) {
  const context = canvas?.getContext?.('2d', { alpha: false }) ?? null;
  let frameId = null;
  let startedAt = 0;
  let running = false;
  if (canvas) {
    canvas.width = TINY_HEROES_WIDTH;
    canvas.height = TINY_HEROES_HEIGHT;
  }
  function render(elapsedMs = 0) {
    return drawTinyHeroesAdventure(context, elapsedMs, { reducedMotion: reducedMotion() });
  }
  function stop() {
    running = false;
    if (frameId !== null && typeof cancelAnimationFrameFn === 'function') cancelAnimationFrameFn(frameId);
    frameId = null;
  }
  function frame(timestamp) {
    if (!running) return;
    render(timestamp - startedAt);
    frameId = typeof requestAnimationFrameFn === 'function' ? requestAnimationFrameFn(frame) : null;
  }
  function start() {
    stop();
    startedAt = now();
    running = true;
    render(0);
    if (!reducedMotion() && typeof requestAnimationFrameFn === 'function') frameId = requestAnimationFrameFn(frame);
  }
  return { render, start, stop, isRunning: () => running };
}
