import { getEmojiDefinition, normalizeEmojiKey } from './emojiRegistry.js';
import { getIconSvgMarkup } from './iconRegistry.js';

function escapeAttribute(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Render a semantic key through the existing Twemoji icon registry. */
export function renderTwemoji(key, { label = '', decorative = true, className = '' } = {}) {
  const canonicalKey = normalizeEmojiKey(key) ?? 'warning';
  const definition = getEmojiDefinition(canonicalKey);
  const classes = ['emoji-img', className].filter(Boolean).join(' ');
  const accessibility = decorative
    ? 'alt="" aria-hidden="true"'
    : `alt="${escapeAttribute(label || definition?.label || canonicalKey)}" role="img"`;

  return getIconSvgMarkup(canonicalKey)
    .replace('class="emoji-img"', `class="${classes}"`)
    .replace('alt="" aria-hidden="true"', accessibility);
}

export function setTwemoji(element, key, options = {}) {
  if (!element) return;
  const canonicalKey = normalizeEmojiKey(key) ?? 'warning';
  element.dataset.emojiKey = canonicalKey;
  element.innerHTML = renderTwemoji(canonicalKey, options);
}
