import { spriteSvg } from '../shared/pixelSprites.js';

const SUITS = {
  red: { P: '#e63946', C: '#3a86ff', S: '#1d3557' },
  blue: { P: '#3a86ff', C: '#e63946', S: '#1d3557' },
  green: { P: '#2ecc71', C: '#ffd93d', S: '#1b5e20' },
  purple: { P: '#9b5de5', C: '#f15bb5', S: '#3d2a6e' }
};
const hero = suit => spriteSvg('hero', SUITS[suit], 6);
const label = text => `<span class="fx-label">${text}</span>`;
const stars = count => Array.from({ length: count }, (_, i) =>
  `<span class="fx-star-drop" style="--x:${8 + i * (84 / count)}vw;--d:${(i % 4) * 0.12}s">${spriteSvg('star', {}, 4)}</span>`).join('');
const lines = '<span class="fx-line" style="--o:-8px"></span><span class="fx-line" style="--o:12px"></span><span class="fx-line" style="--o:32px"></span>';

export const TICK_HERO_ANIMATIONS = [
  { id: 'sky-patrol', html: () => `<div class="fx-cross-r"><span class="fx-fly">${hero('red')}</span>${lines}</div>` },
  { id: 'night-flyer', html: () => `<div class="fx-cross-l"><span class="fx-fly fx-flip">${hero('purple')}</span>${lines}</div>` },
  { id: 'rocket-pal', html: () => `<div class="fx-cross-r"><span class="fx-bob">${spriteSvg('rocket', {}, 6)}</span><span class="fx-flame">${spriteSvg('flame', {}, 6)}</span></div>` },
  { id: 'lightning-hero', html: () => `<div class="fx-flash"></div><div class="fx-center">${hero('blue')}<span class="fx-above fx-blink">${spriteSvg('bolt', {}, 6)}</span></div>${label('ZAP!')}` },
  { id: 'sword-slash', html: () => `<div class="fx-cross-r fx-fast"><span class="fx-spin">${spriteSvg('sword', {}, 8)}</span></div>${label('SLASH!')}` },
  { id: 'shield-block', html: () => `<div class="fx-center fx-pop">${spriteSvg('shield', {}, 9)}</div>${label('BLOCK!')}` },
  { id: 'hero-jump', html: () => `<div class="fx-jump">${hero('green')}</div>${label('HUP!')}` },
  { id: 'hero-run', html: () => `<div class="fx-cross-r fx-ground"><span class="fx-run">${hero('purple')}</span></div>` },
  { id: 'dragon-fire', html: () => `<div class="fx-cross-r"><span class="fx-bob">${spriteSvg('dragon', {}, 7)}</span><span class="fx-flame fx-flame-front">${spriteSvg('flame', {}, 6)}</span></div>` },
  { id: 'ninja-dash', html: () => `<div class="fx-cross-l fx-fast"><span>${spriteSvg('ninja', {}, 6)}</span><span class="fx-smoke">${spriteSvg('smoke', {}, 6)}</span></div>${label('SWISH!')}` },
  { id: 'trophy-win', html: () => `<div class="fx-rise">${spriteSvg('trophy', {}, 9)}</div>${stars(5)}${label('WIN!')}` },
  { id: 'crown-drop', html: () => `<div class="fx-drop">${spriteSvg('crown', {}, 9)}</div>${label('ROYAL!')}` },
  { id: 'one-up', html: () => `<div class="fx-rise">${spriteSvg('heart', {}, 9)}</div>${label('1UP!')}` },
  { id: 'comet-streak', html: () => `<div class="fx-comet">${spriteSvg('comet', {}, 9)}</div>${label('WOOSH!')}` },
  { id: 'power-punch', html: () => `<div class="fx-center fx-pop">${spriteSvg('burst', {}, 12)}</div>${label('POW!')}` }
];

let lastIndex = -1;

export function pickTickHeroAnimation(random = Math.random) {
  let index = Math.floor(random() * TICK_HERO_ANIMATIONS.length);
  if (index === lastIndex) index = (index + 1) % TICK_HERO_ANIMATIONS.length;
  lastIndex = index;
  return TICK_HERO_ANIMATIONS[index];
}

export function playTickHeroAnimation(anchor, doc = globalThis.document) {
  if (!doc?.body) return null;
  const animation = pickTickHeroAnimation();
  const rect = anchor?.getBoundingClientRect?.();
  const viewportHeight = globalThis.innerHeight ?? 600;
  const y = Math.min(Math.max(rect ? rect.top + rect.height / 2 : viewportHeight / 2, 60), viewportHeight - 100);
  const fx = doc.createElement('div');
  fx.className = `tick-hero-fx tick-hero-fx-${animation.id}`;
  fx.setAttribute('aria-hidden', 'true');
  fx.style.setProperty('--y', `${y}px`);
  fx.innerHTML = animation.html();
  doc.body.appendChild(fx);
  setTimeout(() => fx.remove(), 1700);
  return fx;
}
