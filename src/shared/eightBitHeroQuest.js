import {
  easeOutCubic,
  getBeatProgress,
  getTimelineBeat,
  loopTime,
  pixelStep,
  pixelWipeColumns,
  screenShake
} from './sceneTimeline.js';

export const EIGHT_BIT_HERO_QUEST_SCENE = 'eight-bit-hero-quest';
export const QUEST_DURATION_MS = 60_000;
export const QUEST_WIDTH = 320;
export const QUEST_HEIGHT = 180;

/** The entire narrative is editable here instead of being scattered across draw calls. */
export const QUEST_BEATS = Object.freeze([
  { id: 'title', start: 0, end: 5_000, camera: 'title', text: '8-BIT HERO QUEST!', effects: ['titlePulse'] },
  { id: 'village-beacon', start: 5_000, end: 12_000, camera: 'village', text: 'THE CRYSTAL OF DAWN HAS BEEN STOLEN!', effects: ['beaconGlow'] },
  { id: 'forest-journey', start: 12_000, end: 20_000, camera: 'scroll', text: '', effects: ['bushSlash', 'targetArrow'] },
  { id: 'goblin-battle', start: 20_000, end: 30_000, camera: 'battle', text: 'K.O!', effects: ['slash', 'arrowVolley', 'screenShake', 'highFive'] },
  { id: 'dragon-warning', start: 30_000, end: 40_000, camera: 'cave', text: 'THE DRAGON RETURNS!', effects: ['pixelWipe', 'caveGlow'] },
  { id: 'dragon-battle', start: 40_000, end: 50_000, camera: 'battle', text: 'VICTORY!', effects: ['fireBreath', 'slash', 'arrowVolley', 'screenShake'] },
  { id: 'treasure', start: 50_000, end: 57_000, camera: 'treasure', text: 'CRYSTAL OF DAWN', effects: ['crystalSparkles'] },
  { id: 'ending', start: 57_000, end: QUEST_DURATION_MS, camera: 'ending', text: 'QUEST COMPLETE!', effects: ['victorySparkles'] }
]);

const COLORS = Object.freeze({
  ink: '#111428', navy: '#1b2865', blue: '#2576d4', sky: '#57c3e8', white: '#fff9df',
  red: '#e73832', darkRed: '#a91f2d', orange: '#f47d22', yellow: '#ffe13f', gold: '#f5af25',
  green: '#58a942', lightGreen: '#a8d544', skin: '#ffd195', blonde: '#f7c93a', grey: '#9ea6ad',
  brown: '#86502d', purple: '#7647a9', cave: '#472947'
});

const FONT = Object.freeze({
  A: ['010', '101', '111', '101', '101'], B: ['110', '101', '110', '101', '110'], C: ['011', '100', '100', '100', '011'],
  D: ['110', '101', '101', '101', '110'], E: ['111', '100', '110', '100', '111'], F: ['111', '100', '110', '100', '100'],
  G: ['011', '100', '101', '101', '011'], H: ['101', '101', '111', '101', '101'], I: ['111', '010', '010', '010', '111'],
  J: ['001', '001', '001', '101', '010'], K: ['101', '101', '110', '101', '101'], L: ['100', '100', '100', '100', '111'],
  M: ['101', '111', '111', '101', '101'], N: ['101', '111', '111', '111', '101'], O: ['010', '101', '101', '101', '010'],
  P: ['110', '101', '110', '100', '100'], Q: ['010', '101', '101', '111', '011'], R: ['110', '101', '110', '101', '101'],
  S: ['011', '100', '010', '001', '110'], T: ['111', '010', '010', '010', '010'], U: ['101', '101', '101', '101', '111'],
  V: ['101', '101', '101', '101', '010'], W: ['101', '101', '111', '111', '101'], X: ['101', '101', '010', '101', '101'],
  Y: ['101', '101', '010', '010', '010'], Z: ['111', '001', '010', '100', '111'], '!': ['1', '1', '1', '0', '1'],
  '.': ['0', '0', '0', '0', '1'], '-': ['000', '000', '111', '000', '000'], '?': ['110', '001', '010', '000', '010']
});

function fill(ctx, color, x, y, width, height) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
}

function textWidth(value, scale) {
  return [...String(value)].reduce((width, character) => {
    if (character === ' ') return width + 3 * scale;
    return width + ((FONT[character]?.[0].length ?? 3) + 1) * scale;
  }, -scale);
}

function drawText(ctx, value, x, y, scale, color = COLORS.white, align = 'left') {
  const text = String(value).toUpperCase();
  let cursor = align === 'center' ? Math.round(x - textWidth(text, scale) / 2) : x;
  for (const character of text) {
    if (character === ' ') {
      cursor += 3 * scale;
      continue;
    }
    const glyph = FONT[character] ?? FONT['?'];
    glyph.forEach((row, rowIndex) => [...row].forEach((pixel, columnIndex) => {
      if (pixel === '1') fill(ctx, color, cursor + columnIndex * scale, y + rowIndex * scale, scale, scale);
    }));
    cursor += (glyph[0].length + 1) * scale;
  }
}

function drawOutlinedText(ctx, value, x, y, scale, color, align = 'center') {
  [[-scale, 0], [scale, 0], [0, -scale], [0, scale]].forEach(([offsetX, offsetY]) => {
    drawText(ctx, value, x + offsetX, y + offsetY, scale, COLORS.ink, align);
  });
  drawText(ctx, value, x, y, scale, color, align);
}

function drawSpeechBubble(ctx, lines, x, y, width) {
  const height = 9 + lines.length * 8;
  fill(ctx, COLORS.ink, x, y, width, height);
  fill(ctx, COLORS.white, x + 2, y + 2, width - 4, height - 4);
  fill(ctx, COLORS.white, x + 8, y + height, 7, 4);
  lines.forEach((line, index) => drawText(ctx, line, x + width / 2, y + 4 + index * 8, 1, COLORS.ink, 'center'));
}

function drawStars(ctx, time, dark = false) {
  fill(ctx, dark ? COLORS.navy : COLORS.sky, 0, 0, QUEST_WIDTH, QUEST_HEIGHT);
  for (let index = 0; index < 28; index += 1) {
    const twinkle = (index + Math.floor(time / 280)) % 3;
    fill(ctx, twinkle === 0 ? COLORS.yellow : COLORS.white, 4 + (index * 43) % 312, 7 + (index * 29) % 95, twinkle === 0 ? 2 : 1, twinkle === 0 ? 2 : 1);
  }
}

function drawGround(ctx, color = COLORS.green) {
  fill(ctx, color, 0, 127, QUEST_WIDTH, 53);
  fill(ctx, COLORS.lightGreen, 0, 148, QUEST_WIDTH, 32);
  for (let x = 0; x < QUEST_WIDTH; x += 17) fill(ctx, COLORS.ink, x, 158 + (x % 3), 10, 2);
}

function drawBoy(ctx, x, y, { sword = false, attack = false, handsUp = false, frame = 0 } = {}) {
  const bob = frame % 2;
  fill(ctx, COLORS.ink, x + 7, y + 23 + bob, 15, 22);
  fill(ctx, COLORS.red, x + 9, y + 23 + bob, 11, 17);
  fill(ctx, COLORS.ink, x + 8, y + 8 + bob, 13, 16);
  fill(ctx, COLORS.red, x + 9, y + 3 + bob, 12, 9);
  fill(ctx, COLORS.skin, x + 11, y + 11 + bob, 8, 8);
  fill(ctx, COLORS.ink, x + 12, y + 14 + bob, 2, 2);
  fill(ctx, COLORS.ink, x + 17, y + 14 + bob, 2, 2);
  const armY = handsUp ? y + 16 : y + 27;
  fill(ctx, COLORS.skin, x + 3, armY, 7, 4);
  fill(ctx, COLORS.skin, x + 20, handsUp ? y + 12 : y + 27, 7, 4);
  fill(ctx, COLORS.ink, x + 9, y + 42 + bob, 4, 6);
  fill(ctx, COLORS.ink, x + 17, y + 42 + bob, 4, 6);
  if (sword) {
    const offset = attack ? 11 : 0;
    fill(ctx, COLORS.ink, x + 25 + offset, y + 5, 3, 26);
    fill(ctx, COLORS.white, x + 26 + offset, y + 5, 1, 20);
    fill(ctx, COLORS.gold, x + 22 + offset, y + 22, 9, 3);
  }
}

function drawGirl(ctx, x, y, { bow = false, firing = false, handsUp = false, frame = 0 } = {}) {
  const bob = frame % 2;
  fill(ctx, COLORS.ink, x + 7, y + 23 + bob, 16, 22);
  fill(ctx, COLORS.purple, x + 9, y + 23 + bob, 12, 17);
  fill(ctx, COLORS.blonde, x + 7, y + 4 + bob, 16, 18);
  fill(ctx, COLORS.ink, x + 10, y + 10 + bob, 11, 13);
  fill(ctx, COLORS.skin, x + 12, y + 12 + bob, 7, 7);
  fill(ctx, COLORS.ink, x + 13, y + 15 + bob, 2, 2);
  fill(ctx, COLORS.ink, x + 17, y + 15 + bob, 2, 2);
  fill(ctx, COLORS.skin, x + 3, handsUp ? y + 12 : y + 27, 8, 4);
  fill(ctx, COLORS.skin, x + 21, handsUp ? y + 15 : y + 27, 8, 4);
  fill(ctx, COLORS.ink, x + 10, y + 42 + bob, 4, 6);
  fill(ctx, COLORS.ink, x + 18, y + 42 + bob, 4, 6);
  if (bow) {
    fill(ctx, COLORS.brown, x + 28, y + 12, 2, 22);
    fill(ctx, COLORS.yellow, x + 29, y + 14, 1, 17);
    if (firing) {
      fill(ctx, COLORS.ink, x + 30, y + 22, 29, 2);
      fill(ctx, COLORS.white, x + 31, y + 21, 25, 1);
    }
  }
}

function drawGoblin(ctx, x, y, knockedOut = false, frame = 0) {
  const fall = knockedOut ? 18 : 0;
  fill(ctx, COLORS.ink, x + 4, y + 17 + fall, 25, 17);
  fill(ctx, COLORS.green, x + 6, y + 18 + fall, 21, 13);
  fill(ctx, COLORS.ink, x + 7, y + 4 + fall, 18, 16);
  fill(ctx, COLORS.lightGreen, x + 9, y + 6 + fall, 14, 11);
  fill(ctx, COLORS.ink, x + 10, y + 10 + fall, 3, 3);
  fill(ctx, COLORS.ink, x + 19, y + 10 + fall, 3, 3);
  fill(ctx, COLORS.ink, x + 7, y + 31 + fall, 5, 8);
  fill(ctx, COLORS.ink, x + 21, y + 31 + fall, 5, 8);
  if (knockedOut) drawOutlinedText(ctx, 'K.O!', x + 16, y - 5 + (frame % 2), 3, COLORS.yellow);
}

function drawDragon(ctx, x, y, { fire = false, defeated = false, frame = 0 } = {}) {
  const fall = defeated ? 33 : 0;
  fill(ctx, COLORS.ink, x + 10, y + 25 + fall, 76, 26);
  fill(ctx, COLORS.red, x + 13, y + 26 + fall, 70, 21);
  fill(ctx, COLORS.darkRed, x + 12, y + 6 + fall, 26, 29);
  fill(ctx, COLORS.red, x + 15, y + 9 + fall, 20, 22);
  fill(ctx, COLORS.ink, x + 68, y + 14 + fall, 32, 25);
  fill(ctx, COLORS.red, x + 71, y + 16 + fall, 26, 19);
  fill(ctx, COLORS.yellow, x + 74, y + 7 + fall, 6, 9);
  fill(ctx, COLORS.yellow, x + 86, y + 6 + fall, 6, 9);
  fill(ctx, COLORS.ink, x + 82, y + 21 + fall, 4, 4);
  const wingOffset = frame % 2 ? 4 : 0;
  fill(ctx, COLORS.ink, x + 20, y - 4 + fall - wingOffset, 23, 31 + wingOffset);
  fill(ctx, COLORS.red, x + 23, y - 1 + fall - wingOffset, 17, 25 + wingOffset);
  fill(ctx, COLORS.ink, x + 47, y - 7 + fall + wingOffset, 24, 34 - wingOffset);
  fill(ctx, COLORS.red, x + 50, y - 4 + fall + wingOffset, 18, 28 - wingOffset);
  if (fire && !defeated) {
    fill(ctx, COLORS.orange, x + 99, y + 23, 39, 11);
    fill(ctx, COLORS.yellow, x + 101, y + 25, 24, 6);
  }
}

function drawTree(ctx, x, groundY, offset = 0) {
  fill(ctx, COLORS.brown, x + 10, groundY - 51, 10, 51);
  fill(ctx, COLORS.ink, x - 5, groundY - 84 + offset, 40, 38);
  fill(ctx, COLORS.green, x - 2, groundY - 81 + offset, 34, 32);
  fill(ctx, COLORS.lightGreen, x + 5, groundY - 76 + offset, 18, 7);
}

function drawVillage(ctx, time) {
  fill(ctx, COLORS.sky, 0, 0, QUEST_WIDTH, QUEST_HEIGHT);
  drawGround(ctx);
  [24, 110, 228].forEach((x, index) => {
    fill(ctx, COLORS.ink, x, 77, 48, 49);
    fill(ctx, COLORS.white, x + 3, 81, 42, 42);
    fill(ctx, COLORS.red, x - 4, 65, 56, 20);
    fill(ctx, COLORS.brown, x + 20, 104, 9, 19);
    fill(ctx, COLORS.blue, x + 7, 94, 8, 9);
    if (index === 1) fill(ctx, COLORS.yellow, x + 21, 52 + (Math.floor(time / 220) % 2), 5, 25);
  });
  fill(ctx, COLORS.ink, 157, 53, 13, 30);
  fill(ctx, COLORS.yellow, 160, 55, 7, 19);
  [68, 86, 205, 222].forEach((x, index) => drawBoy(ctx, x, 96 + (index % 2) * 4, { frame: Math.floor(time / 280) }));
}

function drawForest(ctx, time) {
  fill(ctx, COLORS.sky, 0, 0, QUEST_WIDTH, QUEST_HEIGHT);
  drawGround(ctx, '#4eaa4d');
  const scroll = -Math.floor((time % 8_000) / 42) % 60;
  for (let x = scroll - 25; x < QUEST_WIDTH + 30; x += 60) drawTree(ctx, x, 131, (Math.floor(time / 300) + x) % 3);
  fill(ctx, COLORS.ink, 148, 109, 18, 17);
  fill(ctx, COLORS.green, 151, 111, 12, 13);
  fill(ctx, COLORS.ink, 177, 105, 14, 25);
  fill(ctx, COLORS.gold, 180, 108, 8, 19);
}

function drawCave(ctx, time) {
  fill(ctx, COLORS.cave, 0, 0, QUEST_WIDTH, QUEST_HEIGHT);
  fill(ctx, COLORS.navy, 0, 0, QUEST_WIDTH, 100);
  for (let x = 0; x < QUEST_WIDTH; x += 26) fill(ctx, COLORS.ink, x, 0, 14, 21 + (x % 4) * 6);
  fill(ctx, COLORS.darkRed, 0, 126, QUEST_WIDTH, 54);
  fill(ctx, COLORS.orange, 0, 150, QUEST_WIDTH, 30);
  const glow = Math.floor(time / 180) % 2;
  fill(ctx, glow ? COLORS.red : COLORS.darkRed, 244, 31, 28, 64);
  fill(ctx, COLORS.yellow, 253, 42, 10, 42);
}

function drawChest(ctx, x, y, open = false) {
  fill(ctx, COLORS.ink, x, y + 10, 45, 25);
  fill(ctx, COLORS.orange, x + 3, y + 13, 39, 19);
  fill(ctx, COLORS.gold, x + 3, y + 21, 39, 3);
  fill(ctx, COLORS.ink, x + 18, y + 21, 9, 9);
  fill(ctx, COLORS.yellow, x + 20, y + 23, 5, 5);
  fill(ctx, COLORS.ink, x + 2, open ? y - 5 : y, 41, 14);
  fill(ctx, COLORS.gold, x + 5, open ? y - 2 : y + 3, 35, 8);
}

function drawCrystal(ctx, x, y, time) {
  const float = Math.floor(time / 220) % 2 ? -2 : 0;
  fill(ctx, COLORS.ink, x - 7, y + float, 15, 23);
  fill(ctx, '#a761dc', x - 4, y + 3 + float, 9, 17);
  fill(ctx, COLORS.white, x - 1, y + 5 + float, 3, 12);
  for (let index = 0; index < 7; index += 1) {
    const angle = (index * 47 + Math.floor(time / 90) * 7) * Math.PI / 180;
    fill(ctx, COLORS.yellow, x + Math.cos(angle) * 20, y + 10 + Math.sin(angle) * 16, 2, 2);
  }
}

function drawTitle(ctx, time) {
  drawStars(ctx, time, true);
  const pulse = pixelStep((time % 900) / 900, 3);
  drawOutlinedText(ctx, '8-BIT', 160, 31 - pulse, 7, COLORS.yellow);
  drawOutlinedText(ctx, 'HERO QUEST!', 160, 71 + pulse, 5, COLORS.red);
  drawBoy(ctx, 69, 110, { sword: true, handsUp: true, frame: Math.floor(time / 240) });
  drawGirl(ctx, 216, 110, { bow: true, handsUp: true, frame: Math.floor(time / 240) });
  drawDragon(ctx, 119, 95, { fire: true, frame: Math.floor(time / 220) });
}

function drawForestJourney(ctx, time) {
  drawForest(ctx, time);
  const attack = (time % 1600) > 720;
  drawBoy(ctx, 65, 83, { sword: true, attack, frame: Math.floor(time / 180) });
  drawGirl(ctx, 112, 83, { bow: true, firing: (time % 1400) > 900, frame: Math.floor(time / 180) });
  if (attack) drawOutlinedText(ctx, 'SLASH!', 121, 74, 3, COLORS.yellow);
  if ((time % 1400) > 900) drawOutlinedText(ctx, 'PEW!', 220, 85, 3, COLORS.yellow);
  drawSpeechBubble(ctx, ['ONWARD!'], 21, 22, 53);
}

function drawGoblinBattle(ctx, time, progress) {
  drawForest(ctx, time);
  const knockedOut = progress > 0.72;
  const highFive = progress > 0.82;
  const attacking = progress > 0.24 && progress < 0.64;
  drawBoy(ctx, highFive ? 96 : 64 + (attacking ? 24 : 0), highFive ? 75 : 84, { sword: !highFive, attack: attacking, handsUp: highFive, frame: Math.floor(time / 160) });
  drawGirl(ctx, highFive ? 142 : 111, highFive ? 75 : 84, { bow: !highFive, firing: progress > 0.46 && progress < 0.67, handsUp: highFive, frame: Math.floor(time / 160) });
  drawGoblin(ctx, 205, 92, knockedOut, Math.floor(time / 160));
  if (attacking) drawOutlinedText(ctx, 'CLANG!', 163, 69, 3, COLORS.yellow);
  if (highFive) drawOutlinedText(ctx, 'HIGH FIVE!', 160, 43, 4, COLORS.yellow);
}

function drawDragonWarning(ctx, time, progress) {
  drawCave(ctx, time);
  const visibleColumns = pixelWipeColumns(progress, 16);
  drawBoy(ctx, 61, 88, { sword: true, frame: Math.floor(time / 240) });
  drawGirl(ctx, 111, 88, { bow: true, frame: Math.floor(time / 240) });
  drawDragon(ctx, 194, 75, { frame: Math.floor(time / 180) });
  drawOutlinedText(ctx, 'THE DRAGON', 160, 35, 5, COLORS.yellow);
  drawOutlinedText(ctx, 'RETURNS!', 160, 65, 5, COLORS.red);
  for (let column = visibleColumns; column < 16; column += 1) fill(ctx, COLORS.ink, column * 20, 0, 20, QUEST_HEIGHT);
}

function drawDragonBattle(ctx, time, progress) {
  drawCave(ctx, time);
  const defeated = progress > 0.78;
  const fire = progress > 0.08 && progress < 0.36;
  const attack = progress > 0.42 && progress < 0.68;
  drawBoy(ctx, 55 + (attack ? 26 : 0), 86, { sword: true, attack, frame: Math.floor(time / 130) });
  drawGirl(ctx, 110, 86, { bow: true, firing: progress > 0.54 && progress < 0.74, frame: Math.floor(time / 130) });
  drawDragon(ctx, 191, 71, { fire, defeated, frame: Math.floor(time / 130) });
  if (attack) drawOutlinedText(ctx, 'SLASH!', 161, 61, 4, COLORS.yellow);
  if (defeated) drawOutlinedText(ctx, 'VICTORY!', 160, 30, 6, COLORS.yellow);
}

function drawTreasure(ctx, time, ending = false) {
  drawCave(ctx, time);
  drawChest(ctx, 138, 117, true);
  drawBoy(ctx, 87, 88, { handsUp: true, sword: ending, frame: Math.floor(time / 220) });
  drawGirl(ctx, 192, 88, { handsUp: true, bow: ending, frame: Math.floor(time / 220) });
  drawCrystal(ctx, 160, ending ? 62 : 73, time);
  drawOutlinedText(ctx, ending ? 'QUEST COMPLETE!' : 'CRYSTAL OF DAWN', 160, 29, ending ? 5 : 3, COLORS.yellow);
}

export function getQuestTime(elapsedMs) {
  return loopTime(elapsedMs, QUEST_DURATION_MS);
}

export function getQuestBeat(elapsedMs) {
  return getTimelineBeat(QUEST_BEATS, elapsedMs, QUEST_DURATION_MS);
}

export function drawEightBitHeroQuest(context, elapsedMs, { reducedMotion = false } = {}) {
  if (!context) return null;
  const renderedTime = reducedMotion ? 57_000 : getQuestTime(elapsedMs);
  const beat = getQuestBeat(renderedTime);
  const progress = getBeatProgress(beat, renderedTime, QUEST_DURATION_MS);
  const shake = reducedMotion ? { x: 0, y: 0 } : screenShake(renderedTime, 23_100, 26_000, 2);
  const dragonShake = reducedMotion ? { x: 0, y: 0 } : screenShake(renderedTime, 44_000, 47_000, 2);

  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, QUEST_WIDTH, QUEST_HEIGHT);
  fill(context, COLORS.ink, 0, 0, QUEST_WIDTH, QUEST_HEIGHT);
  const offsetX = shake.x + dragonShake.x;
  const offsetY = shake.y + dragonShake.y;
  const canTransform = typeof context.save === 'function' && typeof context.translate === 'function' && typeof context.restore === 'function';
  if (canTransform && (offsetX || offsetY)) {
    context.save();
    context.translate(offsetX, offsetY);
  }

  if (beat.id === 'title') drawTitle(context, renderedTime);
  if (beat.id === 'village-beacon') {
    drawVillage(context, renderedTime);
    drawOutlinedText(context, 'THE CRYSTAL OF DAWN', 160, 23, 3, COLORS.yellow);
    drawOutlinedText(context, 'HAS BEEN STOLEN!', 160, 41, 3, COLORS.yellow);
    drawSpeechBubble(context, ['TO THE', 'FOREST!'], 235, 58, 58);
  }
  if (beat.id === 'forest-journey') drawForestJourney(context, renderedTime);
  if (beat.id === 'goblin-battle') drawGoblinBattle(context, renderedTime, progress);
  if (beat.id === 'dragon-warning') drawDragonWarning(context, renderedTime, progress);
  if (beat.id === 'dragon-battle') drawDragonBattle(context, renderedTime, progress);
  if (beat.id === 'treasure') drawTreasure(context, renderedTime);
  if (beat.id === 'ending') drawTreasure(context, renderedTime, true);

  if (canTransform && (offsetX || offsetY)) context.restore();

  return beat;
}

export function createEightBitHeroQuestRenderer(canvas, {
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
    canvas.width = QUEST_WIDTH;
    canvas.height = QUEST_HEIGHT;
  }

  function render(elapsedMs = 0) {
    return drawEightBitHeroQuest(context, elapsedMs, { reducedMotion: reducedMotion() });
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