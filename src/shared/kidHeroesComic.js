export const KID_HEROES_COMIC_SCENE = 'kid-heroes-comic';
export const COMIC_DURATION_MS = 30_000;
export const COMIC_WIDTH = 320;
export const COMIC_HEIGHT = 450;

export const COMIC_BEATS = Object.freeze([
  { id: 'title', start: 0, end: 2_000 },
  { id: 'dragon-attack', start: 2_000, end: 5_000 },
  { id: 'heroes-ready', start: 5_000, end: 8_000 },
  { id: 'sword-battle', start: 8_000, end: 12_000 },
  { id: 'arrow-volley', start: 12_000, end: 15_000 },
  { id: 'dragon-defeat', start: 15_000, end: 18_000 },
  { id: 'victory', start: 18_000, end: 22_000 },
  { id: 'treasure', start: 22_000, end: 26_000 },
  { id: 'ending', start: 26_000, end: COMIC_DURATION_MS }
]);

const COLORS = Object.freeze({
  black: '#111428',
  navy: '#153f9d',
  blue: '#2372da',
  sky: '#54bde9',
  white: '#fff9df',
  red: '#e73532',
  darkRed: '#a91f2d',
  orange: '#f47d22',
  yellow: '#ffe13f',
  gold: '#f5af25',
  green: '#56a943',
  lightGreen: '#a7d643',
  skin: '#ffd193',
  blonde: '#f7c93a',
  grey: '#9da5ac'
});

const PIXEL_FONT = Object.freeze({
  A: ['010', '101', '111', '101', '101'], B: ['110', '101', '110', '101', '110'],
  C: ['011', '100', '100', '100', '011'], D: ['110', '101', '101', '101', '110'],
  E: ['111', '100', '110', '100', '111'], F: ['111', '100', '110', '100', '100'],
  G: ['011', '100', '101', '101', '011'], H: ['101', '101', '111', '101', '101'],
  I: ['111', '010', '010', '010', '111'], J: ['001', '001', '001', '101', '010'],
  K: ['101', '101', '110', '101', '101'], L: ['100', '100', '100', '100', '111'],
  M: ['101', '111', '111', '101', '101'], N: ['101', '111', '111', '111', '101'],
  O: ['010', '101', '101', '101', '010'], P: ['110', '101', '110', '100', '100'],
  Q: ['010', '101', '101', '111', '011'], R: ['110', '101', '110', '101', '101'],
  S: ['011', '100', '010', '001', '110'], T: ['111', '010', '010', '010', '010'],
  U: ['101', '101', '101', '101', '111'], V: ['101', '101', '101', '101', '010'],
  W: ['101', '101', '111', '111', '101'], X: ['101', '101', '010', '101', '101'],
  Y: ['101', '101', '010', '010', '010'], Z: ['111', '001', '010', '100', '111'],
  '0': ['111', '101', '101', '101', '111'], '1': ['010', '110', '010', '010', '111'],
  '2': ['110', '001', '010', '100', '111'], '3': ['110', '001', '010', '001', '110'],
  '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '110', '001', '110'],
  '6': ['011', '100', '111', '101', '111'], '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'], '9': ['111', '101', '111', '001', '110'],
  '!': ['1', '1', '1', '0', '1'], "'": ['1', '1', '0', '0', '0'],
  '.': ['0', '0', '0', '0', '1'], '-': ['000', '000', '111', '000', '000'],
  ':': ['0', '1', '0', '1', '0']
});

export function getComicTime(elapsedMs) {
  const normalized = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  return normalized % COMIC_DURATION_MS;
}

export function getComicBeat(elapsedMs) {
  const time = getComicTime(elapsedMs);
  return COMIC_BEATS.find(beat => time >= beat.start && time < beat.end) ?? COMIC_BEATS[0];
}

function fill(ctx, color, x, y, width, height) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
}

function outline(ctx, color, x, y, width, height, thickness = 2) {
  fill(ctx, color, x, y, width, thickness);
  fill(ctx, color, x, y + height - thickness, width, thickness);
  fill(ctx, color, x, y, thickness, height);
  fill(ctx, color, x + width - thickness, y, thickness, height);
}

function textWidth(text, scale) {
  return [...text].reduce((width, char) => width + ((PIXEL_FONT[char] ?? PIXEL_FONT.A)[0].length + 1) * scale, 0) - scale;
}

function drawText(ctx, value, x, y, scale, color = COLORS.white, align = 'left') {
  const text = String(value).toUpperCase();
  const width = textWidth(text, scale);
  let cursorX = align === 'center' ? Math.round(x - width / 2) : x;
  ctx.fillStyle = color;

  for (const char of text) {
    if (char === ' ') {
      cursorX += 3 * scale;
      continue;
    }
    const glyph = PIXEL_FONT[char] ?? PIXEL_FONT.A;
    glyph.forEach((row, rowIndex) => {
      [...row].forEach((pixel, columnIndex) => {
        if (pixel === '1') fill(ctx, color, cursorX + columnIndex * scale, y + rowIndex * scale, scale, scale);
      });
    });
    cursorX += (glyph[0].length + 1) * scale;
  }
}

function drawTextOutlined(ctx, value, x, y, scale, color, outlineColor, align = 'left') {
  const offsets = [[-scale, 0], [scale, 0], [0, -scale], [0, scale]];
  offsets.forEach(([offsetX, offsetY]) => drawText(ctx, value, x + offsetX, y + offsetY, scale, outlineColor, align));
  drawText(ctx, value, x, y, scale, color, align);
}

function drawPanel(ctx, title, color = COLORS.blue) {
  fill(ctx, COLORS.black, 8, 8, COMIC_WIDTH - 16, COMIC_HEIGHT - 16);
  fill(ctx, color, 14, 14, COMIC_WIDTH - 28, 42);
  fill(ctx, COLORS.black, 14, 50, COMIC_WIDTH - 28, COMIC_HEIGHT - 64);
  drawTextOutlined(ctx, title, COMIC_WIDTH / 2, 25, 4, COLORS.yellow, COLORS.red, 'center');
}

function drawGround(ctx) {
  fill(ctx, COLORS.sky, 18, 56, 284, 225);
  fill(ctx, COLORS.white, 20, 110, 38, 8);
  fill(ctx, COLORS.white, 52, 100, 20, 13);
  fill(ctx, COLORS.white, 245, 95, 42, 10);
  fill(ctx, COLORS.green, 18, 248, 284, 66);
  fill(ctx, COLORS.lightGreen, 18, 280, 284, 34);
  fill(ctx, COLORS.grey, 18, 313, 284, 42);
  for (let x = 25; x < 290; x += 24) fill(ctx, COLORS.black, x, 335 + (x % 3) * 3, 17, 3);
}

function drawBoy(ctx, x, y, { sword = false, charging = false, armsUp = false, blink = false } = {}) {
  const bob = blink ? 1 : 0;
  fill(ctx, COLORS.black, x + 12, y + 55 + bob, 20, 26);
  fill(ctx, COLORS.red, x + 14, y + 53 + bob, 16, 20);
  fill(ctx, COLORS.black, x + 14, y + 22 + bob, 17, 20);
  fill(ctx, COLORS.red, x + 16, y + 16 + bob, 15, 16);
  fill(ctx, COLORS.skin, x + 17, y + 26 + bob, 13, 13);
  fill(ctx, COLORS.black, x + 19, y + 30 + bob, 3, blink ? 1 : 3);
  fill(ctx, COLORS.black, x + 27, y + 30 + bob, 3, blink ? 1 : 3);
  fill(ctx, COLORS.skin, x + 8, y + (armsUp ? 42 : 50) + bob, 8, 5);
  fill(ctx, COLORS.skin, x + 29, y + (armsUp ? 35 : 50) + bob, 9, 5);
  fill(ctx, COLORS.black, x + 15, y + 78 + bob, 6, 9);
  fill(ctx, COLORS.black, x + 26, y + 78 + bob, 6, 9);
  if (sword) {
    const swordX = charging ? x + 32 : x + 37;
    const swordY = charging ? y + 15 : y + 25;
    fill(ctx, COLORS.black, swordX, swordY, 4, 39);
    fill(ctx, COLORS.white, swordX + 1, swordY, 2, 32);
    fill(ctx, COLORS.gold, swordX - 4, swordY + 29, 12, 4);
  }
}

function drawGirl(ctx, x, y, { bow = false, firing = false, armsUp = false, blink = false } = {}) {
  const bob = blink ? 1 : 0;
  fill(ctx, COLORS.black, x + 12, y + 54 + bob, 22, 26);
  fill(ctx, COLORS.red, x + 14, y + 53 + bob, 18, 21);
  fill(ctx, COLORS.blonde, x + 12, y + 16 + bob, 22, 26);
  fill(ctx, COLORS.black, x + 16, y + 24 + bob, 15, 16);
  fill(ctx, COLORS.skin, x + 18, y + 27 + bob, 12, 12);
  fill(ctx, COLORS.black, x + 20, y + 31 + bob, 3, blink ? 1 : 3);
  fill(ctx, COLORS.black, x + 27, y + 31 + bob, 3, blink ? 1 : 3);
  fill(ctx, COLORS.skin, x + 6, y + (armsUp ? 32 : 49) + bob, 9, 5);
  fill(ctx, COLORS.skin, x + 31, y + (armsUp ? 35 : 49) + bob, 9, 5);
  fill(ctx, COLORS.black, x + 15, y + 78 + bob, 6, 9);
  fill(ctx, COLORS.black, x + 27, y + 78 + bob, 6, 9);
  if (bow) {
    fill(ctx, COLORS.black, x + 42, y + 24, 3, 34);
    fill(ctx, COLORS.gold, x + 43, y + 25, 2, 30);
    if (firing) {
      fill(ctx, COLORS.black, x + 45, y + 37, 42, 2);
      fill(ctx, COLORS.white, x + 45, y + 36, 38, 2);
      fill(ctx, COLORS.yellow, x + 80, y + 33, 6, 8);
    }
  }
}

function drawDragon(ctx, x, y, { fire = false, knockedOut = false, flinch = false } = {}) {
  const dy = knockedOut ? 52 : flinch ? 8 : 0;
  fill(ctx, COLORS.black, x + 18, y + 48 + dy, 76, 28);
  fill(ctx, COLORS.red, x + 20, y + 47 + dy, 70, 24);
  fill(ctx, COLORS.darkRed, x + 12, y + 26 + dy, 29, 30);
  fill(ctx, COLORS.red, x + 14, y + 29 + dy, 23, 24);
  fill(ctx, COLORS.black, x + 70, y + 34 + dy, 34, 27);
  fill(ctx, COLORS.red, x + 73, y + 36 + dy, 28, 21);
  fill(ctx, COLORS.yellow, x + 75, y + 25 + dy, 7, 13);
  fill(ctx, COLORS.yellow, x + 87, y + 24 + dy, 7, 13);
  fill(ctx, COLORS.black, x + 85, y + 42 + dy, 4, 4);
  fill(ctx, COLORS.black, x + 23, y + 10 + dy, 23, 40);
  fill(ctx, COLORS.red, x + 26, y + 13 + dy, 17, 32);
  fill(ctx, COLORS.black, x + 49, y + 7 + dy, 25, 42);
  fill(ctx, COLORS.red, x + 52, y + 10 + dy, 19, 34);
  fill(ctx, COLORS.darkRed, x, y + 60 + dy, 23, 7);
  if (fire && !knockedOut) {
    fill(ctx, COLORS.orange, x + 104, y + 42, 34, 12);
    fill(ctx, COLORS.yellow, x + 105, y + 45, 22, 6);
  }
  if (knockedOut) drawTextOutlined(ctx, 'K.O!', x + 62, y + 25, 5, COLORS.yellow, COLORS.black, 'center');
}

function drawChest(ctx, x, y, open = false) {
  fill(ctx, COLORS.black, x, y + 18, 56, 34);
  fill(ctx, COLORS.orange, x + 3, y + 21, 50, 27);
  fill(ctx, COLORS.gold, x + 5, y + 30, 46, 4);
  fill(ctx, COLORS.black, x + 22, y + 31, 11, 13);
  fill(ctx, COLORS.yellow, x + 25, y + 33, 5, 8);
  fill(ctx, COLORS.black, x + 2, open ? y - 8 : y, 52, 19);
  fill(ctx, COLORS.gold, x + 5, open ? y - 5 : y + 3, 46, 13);
  if (open) {
    [8, 20, 35, 48].forEach((offset, index) => {
      fill(ctx, COLORS.yellow, x + offset, y - 24 - (index % 2) * 9, 5, 5);
      fill(ctx, COLORS.white, x + offset + 2, y - 29 - (index % 2) * 9, 2, 15);
    });
  }
}

function drawBubble(ctx, lines, x, y, width = 104) {
  const height = 15 + lines.length * 10;
  fill(ctx, COLORS.black, x, y, width, height);
  fill(ctx, COLORS.white, x + 3, y + 3, width - 6, height - 6);
  fill(ctx, COLORS.white, x + 13, y + height - 1, 9, 7);
  fill(ctx, COLORS.black, x + 18, y + height + 3, 5, 4);
  lines.forEach((line, index) => drawText(ctx, line, x + width / 2, y + 7 + index * 10, 2, COLORS.black, 'center'));
}

function drawEffects(ctx, label, x, y, scale = 3) {
  drawTextOutlined(ctx, label, x, y, scale, COLORS.yellow, COLORS.black, 'center');
}

function drawBattle(ctx, beat, time) {
  drawGround(ctx);
  const flash = Math.floor(time / 200) % 2 === 0;
  if (beat === 'dragon-attack') {
    drawBoy(ctx, 51, 224, { blink: flash });
    drawGirl(ctx, 104, 224, { bow: true, blink: !flash });
    drawDragon(ctx, 175, 173, { fire: true });
    drawEffects(ctx, 'FWOOOSH!', 245, 126, 3);
  } else if (beat === 'heroes-ready') {
    drawBoy(ctx, 70, 218, { sword: true, blink: flash });
    drawGirl(ctx, 184, 218, { bow: true, blink: !flash });
    drawBubble(ctx, ["LET'S GET", 'HIM!'], 25, 75, 111);
    drawBubble(ctx, ['WE CAN', 'DO THIS!'], 178, 75, 112);
  } else if (beat === 'sword-battle') {
    const charge = time > 10_000 ? 44 : 0;
    drawBoy(ctx, 77 + charge, 224, { sword: true, charging: true });
    drawDragon(ctx, 188, 199, { flinch: time > 10_000 });
    drawEffects(ctx, 'SLASH!', 148, 136, 4);
    if (time > 10_000) drawEffects(ctx, 'SLASH!', 232, 157, 3);
    drawBubble(ctx, ['TAKE THAT!'], 22, 72, 99);
  } else if (beat === 'arrow-volley') {
    drawBoy(ctx, 68, 229, { sword: true, blink: flash });
    drawGirl(ctx, 110, 220, { bow: true, firing: time > 13_000, blink: !flash });
    drawDragon(ctx, 207, 199, { flinch: time > 13_000 });
    if (time > 13_000) drawEffects(ctx, 'PEW!', 205, 140, 4);
    drawBubble(ctx, ['EAT ARROW!'], 184, 75, 106);
  } else if (beat === 'dragon-defeat') {
    drawBoy(ctx, 54, 224, { sword: true, blink: flash });
    drawGirl(ctx, 250, 224, { bow: true, blink: !flash });
    drawDragon(ctx, 119, 194, { knockedOut: true });
    drawBubble(ctx, ["THE DRAGON'S", 'DEFEATED!'], 19, 76, 126);
    drawBubble(ctx, ['YEAH!'], 232, 80, 64);
  } else if (beat === 'victory') {
    drawBoy(ctx, 91, 218, { armsUp: true, blink: flash });
    drawGirl(ctx, 181, 218, { armsUp: true, blink: !flash });
    drawEffects(ctx, 'WE DID IT!', 160, 108, 5);
    for (let index = 0; index < 18; index += 1) {
      const x = 22 + (index * 37) % 274;
      const y = 70 + (index * 31) % 142;
      fill(ctx, [COLORS.red, COLORS.yellow, COLORS.blue][index % 3], x, y, 5, 8);
    }
  } else if (beat === 'treasure') {
    drawBoy(ctx, 62, 223, { armsUp: true, blink: flash });
    drawGirl(ctx, 211, 223, { armsUp: true, blink: !flash });
    drawChest(ctx, 132, 242, true);
    drawBubble(ctx, ['AWESOME!'], 19, 80, 86);
    drawBubble(ctx, ['WOW!', 'TREASURE!'], 201, 74, 101);
  } else if (beat === 'ending') {
    drawBoy(ctx, 67, 223, { sword: true, armsUp: true, blink: flash });
    drawGirl(ctx, 213, 223, { bow: true, armsUp: true, blink: !flash });
    drawChest(ctx, 132, 249, true);
    drawEffects(ctx, 'LEVEL COMPLETE!', 160, 105, 4);
  }
}

function drawTitle(ctx, time) {
  fill(ctx, COLORS.black, 0, 0, COMIC_WIDTH, COMIC_HEIGHT);
  for (let index = 0; index < 45; index += 1) {
    const x = 12 + (index * 47) % 292;
    const y = 18 + (index * 71) % 398;
    fill(ctx, index % 3 === 0 ? COLORS.yellow : COLORS.blue, x, y, 3, 3);
  }
  drawTextOutlined(ctx, 'KID HEROES!', 160, 105, 8, COLORS.yellow, COLORS.red, 'center');
  fill(ctx, COLORS.red, 37, 173, 246, 34);
  drawText(ctx, '8-BIT ADVENTURE!', 160, 185, 4, COLORS.yellow, 'center');
  drawBoy(ctx, 76, 268, { sword: true, armsUp: true, blink: Math.floor(time / 400) % 2 === 0 });
  drawGirl(ctx, 194, 268, { bow: true, armsUp: true, blink: Math.floor(time / 400) % 2 !== 0 });
  drawDragon(ctx, 109, 222, { fire: true });
}

export function drawKidHeroesComic(context, elapsedMs, { reducedMotion = false } = {}) {
  if (!context) return null;
  const time = getComicTime(reducedMotion ? 26_000 : elapsedMs);
  const beat = getComicBeat(time);
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, COMIC_WIDTH, COMIC_HEIGHT);

  if (beat.id === 'title') {
    drawTitle(context, time);
    return beat;
  }

  drawPanel(context, beat.id === 'ending' ? 'THE TREASURE IS OURS!' : 'BATTLE TIME!', beat.id === 'treasure' || beat.id === 'ending' ? COLORS.red : COLORS.blue);
  drawBattle(context, beat.id, time);
  return beat;
}

export function createKidHeroesComicRenderer(canvas, {
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
    canvas.width = COMIC_WIDTH;
    canvas.height = COMIC_HEIGHT;
  }

  function render(elapsedMs = 0) {
    return drawKidHeroesComic(context, elapsedMs, { reducedMotion: reducedMotion() });
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
