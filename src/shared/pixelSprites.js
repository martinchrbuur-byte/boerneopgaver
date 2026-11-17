// 8-bit sprites: each row is a string, each character a palette key ('.' is transparent).
const HERO = [
  '...kkkk...',
  '..kPPPPk..',
  '.kPPPPPPk.',
  '.kffkkffk.',
  '.kffffffk.',
  '..kkffkk..',
  '.CkPPPPkC.',
  'CCkPYYPkCC',
  '.CkPPPPkC.',
  '..kPkkPk..',
  '..kSkkSk..',
  '..kkk.kkk.'
];

export const SPRITES = {
  hero: HERO,
  bolt: [
    '...yyyy.',
    '..yyyk..',
    '.yyyk...',
    'yyyyyyy.',
    '..yyyk..',
    '.yyk....',
    '.yk.....',
    'yk......'
  ],
  sword: [
    '......kw',
    '.....kww',
    '....kww.',
    '...kww..',
    'k.kww...',
    '.kww....',
    '.bk.....',
    'bbk.....'
  ],
  shield: [
    '.kkkkkkkk.',
    'kPPPPPPPPk',
    'kPwwPPYYPk',
    'kPwPPPYYPk',
    'kPPPPPPPPk',
    '.kPPYYPPk.',
    '..kPYYPk..',
    '...kPPk...',
    '....kk....'
  ],
  star: [
    '...y...',
    '...y...',
    '..yyy..',
    'yyyyyyy',
    '.yyyyy.',
    '..yyy..',
    '.yy.yy.',
    '.y...y.'
  ],
  rocket: [
    '....kkk...',
    '..kkwwwk..',
    '.kwwwPPPk.',
    'kPPwwwPPPk',
    '.kwwwPPPk.',
    '..kkwwwk..',
    '....kkk...'
  ],
  flame: [
    '..oo',
    'yyoo',
    'yyyo',
    'yyoo',
    '..oo'
  ],
  dragon: [
    '..G.........',
    '.GGG...kkkk.',
    'GGGGGkkGGGGk',
    '.GGGGGGGGwkG',
    '..GGGGGGGGGG',
    '..GGkGGkGGk.',
    '..kk.kk.kk..'
  ],
  ninja: [
    '..kkkkkk..',
    '.kkkkkkkk.',
    '.kffffffk.',
    '.kkwkkwkk.',
    '.kkkkkkkk.',
    '..kkkkkk..',
    '.kkkRkkkk.',
    'kkkkRkkkkk',
    '.kkkkkkkk.',
    '..kk..kk..',
    '..kk..kk..'
  ],
  trophy: [
    'kyyyyyyyyk',
    'kywyyyyyyk',
    'kkywyyyykk',
    '.kyyyyyyk.',
    '..kyyyyk..',
    '...kyyk...',
    '....yy....',
    '...kyyk...',
    '..kkkkkk..'
  ],
  crown: [
    'y..y..y..y',
    'yy.yy.yy.y',
    'yyyyyyyyyy',
    'yRyyBwyyRy',
    'yyyyyyyyyy',
    'kkkkkkkkkk'
  ],
  heart: [
    '.kk..kk.',
    'kRRkkRRk',
    'kRwRRRRk',
    'kRRRRRRk',
    '.kRRRRk.',
    '..kRRk..',
    '...kk...'
  ],
  comet: [
    '.........ww',
    '.......wwyw',
    '.....oowyww',
    '...ooyyyww.',
    '.oooyyyw...',
    'oooyy......',
    'oo.........'
  ],
  burst: [
    '...y...y...',
    'y..yy.yy..y',
    '.yyyyRyyyy.',
    '..yyRRRyy..',
    'yyyRRRRRyyy',
    '..yyRRRyy..',
    '.yyyyRyyyy.',
    'y..yy.yy..y',
    '...y...y...'
  ],
  smoke: [
    '.ww.',
    'wwww',
    '.ww.'
  ]
};

export const PALETTE = {
  k: '#2b2140', f: '#ffcf99', w: '#ffffff', y: '#ffd93d', o: '#ff8a3d',
  R: '#e63946', b: '#8d5524', G: '#4caf50', P: '#3a86ff', Y: '#ffd93d',
  C: '#e63946', S: '#1d3557'
};

export function spriteSvg(name, overrides = {}, scale = 5) {
  const rows = SPRITES[name];
  const colors = { ...PALETTE, ...overrides };
  const width = Math.max(...rows.map(row => row.length));
  const rects = [];
  rows.forEach((row, y) => [...row].forEach((key, x) => {
    if (key !== '.' && colors[key]) rects.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${colors[key]}"/>`);
  }));
  return `<svg class="px" viewBox="0 0 ${width} ${rows.length}" width="${width * scale}" height="${rows.length * scale}" shape-rendering="crispEdges" aria-hidden="true">${rects.join('')}</svg>`;
}
