import {
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
export const QUEST_VISUAL_STYLE = '32-bit pixel adventure';

/** The entire narrative is editable here instead of being scattered across draw calls. */
export const QUEST_BEATS = Object.freeze([
  { id: 'title', start: 0, end: 5_000, camera: 'title', text: '32-BIT HERO QUEST!', effects: ['titlePulse'] },
  { id: 'village-beacon', start: 5_000, end: 12_000, camera: 'village', text: 'THE CRYSTAL OF DAWN HAS BEEN STOLEN!', effects: ['beaconGlow'] },
  { id: 'forest-journey', start: 12_000, end: 20_000, camera: 'scroll', text: '', effects: ['bushSlash', 'targetArrow'] },
  { id: 'goblin-battle', start: 20_000, end: 30_000, camera: 'battle', text: 'K.O!', effects: ['slash', 'arrowVolley', 'screenShake', 'highFive'] },
  { id: 'dragon-warning', start: 30_000, end: 40_000, camera: 'cave', text: 'THE DRAGON RETURNS!', effects: ['pixelWipe', 'caveGlow'] },
  { id: 'dragon-battle', start: 40_000, end: 50_000, camera: 'battle', text: 'VICTORY!', effects: ['fireBreath', 'slash', 'arrowVolley', 'screenShake'] },
  { id: 'treasure', start: 50_000, end: 57_000, camera: 'treasure', text: 'CRYSTAL OF DAWN', effects: ['crystalSparkles'] },
  { id: 'ending', start: 57_000, end: QUEST_DURATION_MS, camera: 'ending', text: 'QUEST COMPLETE!', effects: ['victorySparkles'] }
]);

const COLORS = Object.freeze({
  ink: '#18182d', navy: '#213b83', blue: '#2d77d0', blueLight: '#66b7f1', sky: '#56bde8', white: '#fff7d2',
  red: '#e83c31', redLight: '#ff7750', darkRed: '#8d2638', orange: '#f47628', yellow: '#ffe15a', gold: '#f1ad2e',
  green: '#4fa549', greenDark: '#256d43', lightGreen: '#a9d655', skin: '#ffc98a', skinLight: '#ffe3af',
  blonde: '#f6c53b', blondeLight: '#ffe96b', hairRed: '#d93227', hairRedLight: '#ff6b37', grey: '#9aa9c2',
  silverLight: '#e8f4ff', brown: '#86502d', brownLight: '#bf7540', purple: '#7647a9', cave: '#472947', crystal: '#bd70ef'
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

function drawCloud(ctx, x, y, width) {
  fill(ctx, COLORS.white, x, y + 7, width, 8);
  fill(ctx, COLORS.white, x + 7, y + 3, width - 14, 14);
  fill(ctx, '#d8f1fa', x + 4, y + 15, width - 8, 4);
}

function drawLandscape(ctx, time) {
  fill(ctx, COLORS.sky, 0, 0, QUEST_WIDTH, QUEST_HEIGHT);
  drawCloud(ctx, -10 + (Math.floor(time / 160) % 16), 18, 49);
  drawCloud(ctx, 205 - (Math.floor(time / 240) % 18), 35, 61);
  fill(ctx, '#8fb2e1', 0, 79, 80, 42);
  fill(ctx, '#5c89c8', 26, 57, 86, 64);
  fill(ctx, '#8fb2e1', 99, 73, 93, 48);
  fill(ctx, '#507db8', 184, 58, 104, 63);
  fill(ctx, '#8fb2e1', 267, 79, 53, 42);
  fill(ctx, '#edf7f2', 52, 67, 19, 9);
  fill(ctx, '#edf7f2', 221, 68, 20, 10);
}

function drawGround(ctx, color = COLORS.green) {
  fill(ctx, COLORS.greenDark, 0, 120, QUEST_WIDTH, 60);
  fill(ctx, color, 0, 128, QUEST_WIDTH, 52);
  fill(ctx, COLORS.lightGreen, 0, 151, QUEST_WIDTH, 29);
  for (let x = 0; x < QUEST_WIDTH; x += 17) {
    fill(ctx, COLORS.greenDark, x, 151 + (x % 4), 12, 3);
    fill(ctx, COLORS.white, x + 7, 140 + (x % 3), 2, 2);
  }
}

function drawBoy(ctx, x, y, { sword = false, attack = false, handsUp = false, frame = 0 } = {}) {
  const bob = frame % 2 ? 1 : 0;
  const swordOffset = attack ? 14 : 0;
  fill(ctx, COLORS.darkRed, x + 2, y + 27 + bob, 27, 39);
  fill(ctx, COLORS.red, x + 5, y + 28 + bob, 21, 33);
  fill(ctx, COLORS.ink, x + 10, y + 48 + bob, 9, 20);
  fill(ctx, COLORS.grey, x + 11, y + 49 + bob, 7, 14);
  fill(ctx, COLORS.ink, x + 20, y + 48 + bob, 9, 20);
  fill(ctx, COLORS.grey, x + 21, y + 49 + bob, 7, 14);
  fill(ctx, COLORS.ink, x + 7, y + 62 + bob, 14, 7);
  fill(ctx, COLORS.brown, x + 9, y + 62 + bob, 11, 5);
  fill(ctx, COLORS.ink, x + 19, y + 62 + bob, 15, 7);
  fill(ctx, COLORS.brown, x + 21, y + 62 + bob, 12, 5);
  fill(ctx, COLORS.ink, x + 6, y + 25 + bob, 27, 28);
  fill(ctx, COLORS.blue, x + 9, y + 27 + bob, 21, 22);
  fill(ctx, COLORS.blueLight, x + 12, y + 29 + bob, 5, 16);
  fill(ctx, COLORS.ink, x + 8, y + 44 + bob, 23, 6);
  fill(ctx, COLORS.gold, x + 10, y + 45 + bob, 19, 3);
  fill(ctx, COLORS.ink, x + 16, y + 43 + bob, 7, 8);
  fill(ctx, COLORS.yellow, x + 18, y + 45 + bob, 3, 4);
  fill(ctx, COLORS.ink, x + 3, y + 27 + bob, 10, 12);
  fill(ctx, COLORS.grey, x + 5, y + 28 + bob, 8, 8);
  fill(ctx, COLORS.silverLight, x + 6, y + 29 + bob, 5, 3);
  fill(ctx, COLORS.ink, x + 27, y + 27 + bob, 10, 12);
  fill(ctx, COLORS.grey, x + 27, y + 28 + bob, 8, 8);
  fill(ctx, COLORS.silverLight, x + 28, y + 29 + bob, 5, 3);
  fill(ctx, COLORS.ink, x + 8, y + 5 + bob, 23, 25);
  fill(ctx, COLORS.hairRed, x + 9, y + 2 + bob, 20, 14);
  fill(ctx, COLORS.hairRedLight, x + 13, y + 1 + bob, 5, 8);
  fill(ctx, COLORS.hairRedLight, x + 23, y + 4 + bob, 5, 5);
  fill(ctx, COLORS.skin, x + 12, y + 13 + bob, 15, 13);
  fill(ctx, COLORS.skinLight, x + 15, y + 14 + bob, 9, 5);
  fill(ctx, COLORS.navy, x + 15, y + 18 + bob, 3, 3);
  fill(ctx, COLORS.navy, x + 22, y + 18 + bob, 3, 3);
  fill(ctx, COLORS.white, x + 16, y + 18 + bob, 1, 1);
  const armY = handsUp ? y + 17 : y + 34;
  fill(ctx, COLORS.ink, x, armY, 10, 7);
  fill(ctx, COLORS.brown, x + 2, armY + 1, 7, 5);
  fill(ctx, COLORS.ink, x + 30, handsUp ? y + 12 : y + 34, 10, 7);
  fill(ctx, COLORS.brown, x + 31, (handsUp ? y + 12 : y + 34) + 1, 7, 5);
  if (sword) {
    fill(ctx, COLORS.ink, x + 33 + swordOffset, y + 2, 5, 36);
    fill(ctx, COLORS.silverLight, x + 34 + swordOffset, y + 3, 3, 29);
    fill(ctx, COLORS.blueLight, x + 35 + swordOffset, y + 4, 1, 25);
    fill(ctx, COLORS.gold, x + 28 + swordOffset, y + 27, 16, 5);
    fill(ctx, COLORS.brown, x + 33 + swordOffset, y + 32, 5, 9);
  }
}

function drawGirl(ctx, x, y, { bow = false, firing = false, handsUp = false, frame = 0 } = {}) {
  const bob = frame % 2 ? 1 : 0;
  fill(ctx, COLORS.blonde, x + 24, y + 6 + bob, 13, 31);
  fill(ctx, COLORS.blondeLight, x + 26, y + 7 + bob, 8, 25);
  fill(ctx, COLORS.ink, x + 10, y + 47 + bob, 9, 20);
  fill(ctx, COLORS.greenDark, x + 12, y + 49 + bob, 6, 14);
  fill(ctx, COLORS.ink, x + 22, y + 47 + bob, 9, 20);
  fill(ctx, COLORS.greenDark, x + 23, y + 49 + bob, 6, 14);
  fill(ctx, COLORS.ink, x + 7, y + 62 + bob, 14, 7);
  fill(ctx, COLORS.brown, x + 9, y + 62 + bob, 11, 5);
  fill(ctx, COLORS.ink, x + 20, y + 62 + bob, 15, 7);
  fill(ctx, COLORS.brown, x + 22, y + 62 + bob, 12, 5);
  fill(ctx, COLORS.ink, x + 6, y + 27 + bob, 28, 27);
  fill(ctx, COLORS.greenDark, x + 9, y + 29 + bob, 22, 21);
  fill(ctx, COLORS.green, x + 11, y + 31 + bob, 18, 16);
  fill(ctx, COLORS.lightGreen, x + 15, y + 31 + bob, 5, 15);
  fill(ctx, COLORS.ink, x + 8, y + 45 + bob, 24, 5);
  fill(ctx, COLORS.brown, x + 10, y + 46 + bob, 19, 2);
  fill(ctx, COLORS.ink, x + 8, y + 6 + bob, 23, 25);
  fill(ctx, COLORS.blonde, x + 9, y + 3 + bob, 20, 16);
  fill(ctx, COLORS.blondeLight, x + 12, y + 4 + bob, 13, 6);
  fill(ctx, COLORS.skin, x + 12, y + 14 + bob, 15, 13);
  fill(ctx, COLORS.skinLight, x + 16, y + 15 + bob, 8, 4);
  fill(ctx, COLORS.greenDark, x + 15, y + 19 + bob, 3, 3);
  fill(ctx, COLORS.greenDark, x + 22, y + 19 + bob, 3, 3);
  fill(ctx, COLORS.white, x + 16, y + 19 + bob, 1, 1);
  fill(ctx, COLORS.green, x + 5, y + 24 + bob, 29, 6);
  const armY = handsUp ? y + 16 : y + 34;
  fill(ctx, COLORS.ink, x, armY, 10, 7);
  fill(ctx, COLORS.brown, x + 2, armY + 1, 7, 5);
  fill(ctx, COLORS.ink, x + 30, handsUp ? y + 13 : y + 34, 10, 7);
  fill(ctx, COLORS.brown, x + 31, (handsUp ? y + 13 : y + 34) + 1, 7, 5);
  if (bow) {
    fill(ctx, COLORS.ink, x + 37, y + 13, 4, 32);
    fill(ctx, COLORS.brown, x + 38, y + 14, 2, 29);
    fill(ctx, COLORS.gold, x + 39, y + 17, 1, 24);
    if (firing) {
      fill(ctx, COLORS.ink, x + 40, y + 28, 35, 3);
      fill(ctx, COLORS.silverLight, x + 42, y + 28, 29, 1);
      fill(ctx, COLORS.white, x + 69, y + 26, 4, 5);
    }
  }
}

function drawGoblin(ctx, x, y, knockedOut = false, frame = 0) {
  const fall = knockedOut ? 23 : 0;
  fill(ctx, COLORS.ink, x + 5, y + 28 + fall, 36, 22);
  fill(ctx, COLORS.greenDark, x + 8, y + 30 + fall, 30, 17);
  fill(ctx, COLORS.ink, x + 8, y + 9 + fall, 29, 25);
  fill(ctx, COLORS.lightGreen, x + 11, y + 11 + fall, 23, 18);
  fill(ctx, COLORS.green, x + 14, y + 12 + fall, 16, 5);
  fill(ctx, COLORS.ink, x + 14, y + 19 + fall, 4, 4);
  fill(ctx, COLORS.ink, x + 27, y + 19 + fall, 4, 4);
  fill(ctx, COLORS.yellow, x + 15, y + 19 + fall, 2, 2);
  fill(ctx, COLORS.yellow, x + 28, y + 19 + fall, 2, 2);
  fill(ctx, COLORS.ink, x + 10, y + 46 + fall, 9, 10);
  fill(ctx, COLORS.ink, x + 28, y + 46 + fall, 9, 10);
  if (knockedOut) drawOutlinedText(ctx, 'K.O!', x + 22, y - 7 + (frame % 2), 3, COLORS.yellow);
}

function drawDragon(ctx, x, y, { fire = false, defeated = false, frame = 0 } = {}) {
  const fall = defeated ? 37 : 0;
  const wingOffset = frame % 2 ? 6 : 0;
  fill(ctx, COLORS.ink, x + 15, y + 36 + fall, 86, 31);
  fill(ctx, COLORS.darkRed, x + 19, y + 39 + fall, 78, 24);
  fill(ctx, COLORS.red, x + 23, y + 40 + fall, 62, 11);
  fill(ctx, COLORS.redLight, x + 25, y + 42 + fall, 22, 4);
  fill(ctx, COLORS.ink, x + 14, y + 11 + fall, 29, 35);
  fill(ctx, COLORS.darkRed, x + 17, y + 14 + fall, 23, 28);
  fill(ctx, COLORS.red, x + 20, y + 17 + fall, 16, 19);
  fill(ctx, COLORS.ink, x + 77, y + 20 + fall, 39, 30);
  fill(ctx, COLORS.red, x + 80, y + 23 + fall, 33, 24);
  fill(ctx, COLORS.redLight, x + 83, y + 26 + fall, 15, 5);
  fill(ctx, COLORS.yellow, x + 85, y + 13 + fall, 7, 11);
  fill(ctx, COLORS.yellow, x + 100, y + 12 + fall, 7, 11);
  fill(ctx, COLORS.ink, x + 94, y + 29 + fall, 5, 5);
  fill(ctx, COLORS.white, x + 95, y + 29 + fall, 2, 2);
  fill(ctx, COLORS.ink, x + 23, y - 5 + fall - wingOffset, 29, 48 + wingOffset);
  fill(ctx, COLORS.red, x + 27, y - 1 + fall - wingOffset, 21, 39 + wingOffset);
  fill(ctx, COLORS.orange, x + 31, y + 4 + fall - wingOffset, 12, 25 + wingOffset);
  fill(ctx, COLORS.ink, x + 52, y - 9 + fall + wingOffset, 31, 52 - wingOffset);
  fill(ctx, COLORS.red, x + 56, y - 5 + fall + wingOffset, 23, 43 - wingOffset);
  fill(ctx, COLORS.orange, x + 61, y + 1 + fall + wingOffset, 12, 23 - wingOffset);
  if (fire && !defeated) {
    fill(ctx, COLORS.darkRed, x + 113, y + 31, 53, 17);
    fill(ctx, COLORS.orange, x + 116, y + 33, 47, 13);
    fill(ctx, COLORS.yellow, x + 119, y + 36, 29, 7);
    fill(ctx, COLORS.white, x + 122, y + 38, 13, 3);
  }
}

function drawTree(ctx, x, groundY, offset = 0) {
  fill(ctx, COLORS.ink, x + 13, groundY - 58, 13, 58);
  fill(ctx, COLORS.brown, x + 16, groundY - 56, 7, 56);
  fill(ctx, COLORS.brownLight, x + 17, groundY - 54, 3, 42);
  fill(ctx, COLORS.ink, x - 9, groundY - 95 + offset, 57, 46);
  fill(ctx, COLORS.greenDark, x - 6, groundY - 92 + offset, 51, 40);
  fill(ctx, COLORS.green, x - 1, groundY - 88 + offset, 39, 30);
  fill(ctx, COLORS.lightGreen, x + 5, groundY - 85 + offset, 24, 8);
}

function drawVillage(ctx, time) {
  drawLandscape(ctx, time);
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
  drawLandscape(ctx, time);
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
  fill(ctx, '#30245b', 0, 0, QUEST_WIDTH, 105);
  for (let x = 0; x < QUEST_WIDTH; x += 26) {
    fill(ctx, COLORS.ink, x, 0, 15, 23 + (x % 4) * 6);
    fill(ctx, '#3e326d', x + 15, 0, 11, 16 + (x % 3) * 8);
  }
  fill(ctx, COLORS.darkRed, 0, 122, QUEST_WIDTH, 58);
  fill(ctx, COLORS.orange, 0, 151, QUEST_WIDTH, 29);
  fill(ctx, COLORS.ink, 26, 87, 12, 38);
  fill(ctx, COLORS.crystal, 29, 94, 7, 24);
  fill(ctx, COLORS.silverLight, 31, 96, 2, 15);
  fill(ctx, COLORS.ink, 276, 82, 13, 43);
  fill(ctx, COLORS.crystal, 279, 89, 7, 28);
  const glow = Math.floor(time / 180) % 2;
  fill(ctx, glow ? COLORS.red : COLORS.darkRed, 244, 31, 32, 69);
  fill(ctx, COLORS.orange, 251, 40, 18, 51);
  fill(ctx, COLORS.yellow, 256, 47, 8, 37);
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
  fill(ctx, COLORS.crystal, x - 4, y + 3 + float, 9, 17);
  fill(ctx, '#e9b8ff', x - 1, y + 5 + float, 3, 12);
  for (let index = 0; index < 7; index += 1) {
    const angle = (index * 47 + Math.floor(time / 90) * 7) * Math.PI / 180;
    fill(ctx, COLORS.yellow, x + Math.cos(angle) * 20, y + 10 + Math.sin(angle) * 16, 2, 2);
  }
}

function drawTitle(ctx, time) {
  drawStars(ctx, time, true);
  const pulse = pixelStep((time % 900) / 900, 3) * 2;
  drawOutlinedText(ctx, '32-BIT', 160, 27 - pulse, 7, COLORS.yellow);
  drawOutlinedText(ctx, 'HERO QUEST!', 160, 65 + pulse, 5, COLORS.redLight);
  drawDragon(ctx, 117, 91, { fire: true, frame: Math.floor(time / 220) });
  drawBoy(ctx, 55, 107, { sword: true, handsUp: true, frame: Math.floor(time / 240) });
  drawGirl(ctx, 219, 107, { bow: true, handsUp: true, frame: Math.floor(time / 240) });
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