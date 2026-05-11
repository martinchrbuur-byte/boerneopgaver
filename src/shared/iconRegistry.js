/**
 * Icon registry using Twemoji SVG assets via jsDelivr CDN.
 * All icons are rendered as <img> elements pointing to Twitter's open-source
 * Twemoji set (MIT + CC-BY 4.0) — consistent, colourful, and cross-platform.
 *
 * CDN base: https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/
 * Codepoints: lowercase hex joined by dashes, trailing variation-selector fe0f dropped.
 */

const TWEMOJI_BASE = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/';

/**
 * Maps every icon key used in the app to a Twemoji Unicode codepoint path.
 * Variation selector U+FE0F (fe0f) is omitted — Twemoji filenames don't include it.
 */
const ICON_CODEPOINTS = Object.freeze({
  // ── Avatars ───────────────────────────────────────────────────────────────
  kidHans:         '1f466',    // 👦  boy
  kidAndrea:       '1f467',    // 👧  girl
  user:            '1f9d1',    // 🧑  person

  // ── Status / wallet ───────────────────────────────────────────────────────
  wallet:          '1f45b',    // 👛  purse
  coin:            '1fa99',    // 🪙  coin

  // ── Tab navigation ────────────────────────────────────────────────────────
  tabChores:       '1f4cb',    // 📋  clipboard
  tabPeriod:       '1f4c5',    // 📅  calendar
  tabFeedback:     '1f4ac',    // 💬  speech balloon
  tabHistory:      '1f4d6',    // 📖  open book
  feedbackArchive: '1f4e5',    // 📥  inbox tray

  // ── Actions ───────────────────────────────────────────────────────────────
  check:           '2705',     // ✅  check mark button
  save:            '1f4be',    // 💾  floppy disk
  cancel:          '274c',     // ❌  cross mark
  undo:            '1f519',    // 🔙  back arrow
  collab:          '1f91d',    // 🤝  handshake
  pending:         '23f3',     // ⏳  hourglass not done
  edit:            '270f',     // ✏️  pencil
  delete:          '1f5d1',    // 🗑️  wastebasket
  cleanup:         '1f9f9',    // 🧹  broom

  // ── Status indicators ─────────────────────────────────────────────────────
  warning:         '26a0',     // ⚠️  warning
  sync:            '1f504',    // 🔄  counterclockwise arrows
  success:         '2705',     // ✅  check mark button
  offline:         '1f6ab',    // 🚫  prohibited

  // ── Mascot / celebration ──────────────────────────────────────────────────
  party:           '1f389',    // 🎉  party popper
  star:            '2b50',     // ⭐  star
  trophy:          '1f3c6',    // 🏆  trophy
  rocket:          '1f680',    // 🚀  rocket
  target:          '1f3af',    // 🎯  direct hit
  puzzle:          '1f9e9',    // 🧩  puzzle piece
  balloon:         '1f388',    // 🎈  balloon
  rainbow:         '1f308',    // 🌈  rainbow
  music:           '1f3b5',    // 🎵  musical note
  paint:           '1f3a8',    // 🎨  artist palette
  build:           '1f528',    // 🔨  hammer
  idea:            '1f4a1',    // 💡  light bulb
  magic:           '1fa84',    // 🪄  magic wand
  medal:           '1f947',    // 🥇  1st place medal
  heart:           '2764',     // ❤️  red heart
  flower:          '1f338',    // 🌸  cherry blossom
  gift:            '1f381',    // 🎁  wrapped gift
  diamond:         '1f48e',    // 💎  gem stone
  ball:            '26bd',     // ⚽  soccer ball

  // ── Chore categories ──────────────────────────────────────────────────────
  sleep:           '1f634',    // 😴  sleeping face
  dental:          '1f9b7',    // 🦷  tooth
  pet:             '1f43e',    // 🐾  paw prints
  clean:           '1f9fc',    // 🧼  soap
  clothes:         '1f455',    // 👕  t-shirt
  school:          '1f4da',    // 📚  books
  bath:            '1f6c1',    // 🛁  bathtub
  food:            '1f37d',    // 🍽️  fork and knife with plate

  // ── Mood / atmosphere ─────────────────────────────────────────────────────
  moon:            '1f319',    // 🌙  crescent moon
  sparkle:         '2728',     // ✨  sparkles
  fire:            '1f525',    // 🔥  fire
  sun:             '2600',     // ☀️  sun
  butterfly:       '1f98b',    // 🦋  butterfly

  // ── Helper cast ───────────────────────────────────────────────────────────
  wizard:          '1f9d9',    // 🧙  mage / wizard
  astronaut:       '1f9d1-200d-1f680', // 🧑‍🚀  astronaut (ZWJ sequence)
  fairy:           '1f9da',    // 🧚  fairy
  dragon:          '1f409',    // 🐉  dragon
  ghost:           '1f47b',    // 👻  ghost
  knight:          '1f3c7',    // 🏇  horse racing / knight

  // ── Sound controls ────────────────────────────────────────────────────────
  speaker:         '1f50a',    // 🔊  speaker high volume
  mute:            '1f507',    // 🔇  muted speaker
});

function emojiImgMarkup(codepoint) {
  const src = `${TWEMOJI_BASE}${codepoint}.svg`;
  return `<img src="${src}" alt="" aria-hidden="true" draggable="false" class="emoji-img">`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function getIconSvgMarkup(key) {
  const codepoint = ICON_CODEPOINTS[key] ?? ICON_CODEPOINTS.star;
  return emojiImgMarkup(codepoint);
}

export function renderIcon(key, { label = '', decorative = true, className = '' } = {}) {
  const classes = ['app-icon', className].filter(Boolean).join(' ');
  const aria = decorative
    ? 'aria-hidden="true"'
    : `role="img" aria-label="${escapeHtml(label || key)}"`;

  return `<span class="${classes}" data-icon-key="${escapeHtml(key)}" ${aria}>${getIconSvgMarkup(key)}</span>`;
}

export function renderIconText(key, text, { className = 'icon-label', textClassName = '' } = {}) {
  const classes = [className].filter(Boolean).join(' ');
  const textClasses = [textClassName].filter(Boolean).join(' ');
  const textMarkup = textClasses
    ? `<span class="${textClasses}">${escapeHtml(text)}</span>`
    : `<span>${escapeHtml(text)}</span>`;

  return `<span class="${classes}">${renderIcon(key)}${textMarkup}</span>`;
}

export function setElementIcon(element, key, { label = '', decorative = true, title = '' } = {}) {
  if (!element) {
    return;
  }

  element.dataset.iconKey = key;
  if (title) {
    element.title = title;
  }

  if (decorative) {
    element.setAttribute('aria-hidden', 'true');
    element.removeAttribute('role');
    element.removeAttribute('aria-label');
  } else {
    element.removeAttribute('aria-hidden');
    element.setAttribute('role', 'img');
    element.setAttribute('aria-label', label || key);
  }

  element.innerHTML = getIconSvgMarkup(key);
}
