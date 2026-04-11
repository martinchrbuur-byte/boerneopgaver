function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function svgFrame(content, { viewBox = '0 0 64 64' } = {}) {
  return `<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${content}</svg>`;
}

function circle(cx, cy, r, fill, extra = '') {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${extra}/>`;
}

function rect(x, y, width, height, rx, fill, extra = '') {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${rx}" fill="${fill}" ${extra}/>`;
}

function path(d, fill, extra = '') {
  return `<path d="${d}" fill="${fill}" ${extra}/>`;
}

function strokePath(d, stroke, extra = '') {
  return `<path d="${d}" fill="none" stroke="${stroke}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
}

function line(x1, y1, x2, y2, stroke, extra = '') {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-linecap="round" ${extra}/>`;
}

function badge(base, accent, motif) {
  return svgFrame(`
    <defs>
      <linearGradient id="g-${base.slice(1)}-${accent.slice(1)}" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stop-color="${base}" />
        <stop offset="100%" stop-color="${accent}" />
      </linearGradient>
    </defs>
    ${circle(32, 32, 28, `url(#g-${base.slice(1)}-${accent.slice(1)})`)}
    ${circle(32, 32, 26, 'rgba(255,255,255,0.16)')}
    ${motif}
  `);
}

function avatar(base, hair, shirt) {
  return svgFrame(`
    ${circle(32, 32, 28, base)}
    ${path('M18 50c3-9 11-14 14-14s11 5 14 14', shirt)}
    ${circle(32, 25, 11, '#fde7d6')}
    ${path('M20 21c2-8 9-12 12-12 6 0 12 4 13 13-4-2-8-3-12-3-5 0-9 1-13 2', hair)}
    ${circle(28, 25, 1.4, '#334155')}
    ${circle(36, 25, 1.4, '#334155')}
    ${strokePath('M28 30c2.5 2 5.5 2 8 0', '#9a3412', 'stroke-width="2.8"')}
  `);
}

function starPoints(cx, cy, outer, inner, points = 5) {
  const values = [];
  for (let index = 0; index < points * 2; index += 1) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = (-Math.PI / 2) + (index * Math.PI / points);
    values.push(`${(cx + (Math.cos(angle) * radius)).toFixed(2)},${(cy + (Math.sin(angle) * radius)).toFixed(2)}`);
  }
  return values.join(' ');
}

const ICONS = Object.freeze({
  kidHans: avatar('#60a5fa', '#1d4ed8', '#2563eb'),
  kidAndrea: avatar('#f9a8d4', '#db2777', '#ec4899'),
  user: avatar('#cbd5e1', '#64748b', '#94a3b8'),
  wallet: svgFrame(`
    ${rect(10, 18, 44, 28, 8, '#8b5cf6')}
    ${rect(14, 22, 36, 20, 6, '#a78bfa')}
    ${rect(34, 26, 20, 12, 6, '#6d28d9')}
    ${circle(43, 32, 2.8, '#fde68a')}
  `),
  coin: svgFrame(`
    ${circle(32, 32, 22, '#facc15')}
    ${circle(32, 32, 18, '#f59e0b')}
    <polygon points="${starPoints(32, 32, 9, 4.4)}" fill="#fff7cc" />
  `),
  tabChores: svgFrame(`
    ${rect(16, 10, 32, 44, 7, '#60a5fa')}
    ${rect(24, 6, 16, 8, 4, '#1d4ed8')}
    ${line(24, 24, 40, 24, '#eff6ff', 'stroke-width="4"')}
    ${line(24, 34, 40, 34, '#eff6ff', 'stroke-width="4"')}
    ${line(24, 44, 36, 44, '#eff6ff', 'stroke-width="4"')}
  `),
  tabPeriod: svgFrame(`
    ${rect(10, 14, 44, 38, 8, '#38bdf8')}
    ${rect(10, 14, 44, 12, 8, '#0284c7')}
    ${line(22, 10, 22, 20, '#075985', 'stroke-width="5"')}
    ${line(42, 10, 42, 20, '#075985', 'stroke-width="5"')}
    ${rect(18, 32, 10, 10, 3, '#e0f2fe')}
    ${rect(34, 32, 10, 10, 3, '#e0f2fe')}
  `),
  tabFeedback: svgFrame(`
    ${path('M14 18c0-4 3-7 7-7h22c4 0 7 3 7 7v14c0 4-3 7-7 7H31L18 49v-10h-4c-4 0-7-3-7-7V18c0-4 3-7 7-7z', '#34d399')}
    ${line(21, 22, 43, 22, '#ecfdf5', 'stroke-width="4"')}
    ${line(21, 30, 39, 30, '#ecfdf5', 'stroke-width="4"')}
  `),
  tabHistory: svgFrame(`
    ${path('M18 10h20l8 8v30c0 4-3 6-6 6H18c-4 0-6-2-6-6V16c0-4 2-6 6-6z', '#f59e0b')}
    ${path('M38 10v10h10', '#fcd34d')}
    ${line(22, 28, 42, 28, '#fff7ed', 'stroke-width="4"')}
    ${line(22, 38, 42, 38, '#fff7ed', 'stroke-width="4"')}
  `),
  feedbackArchive: svgFrame(`
    ${rect(10, 18, 44, 28, 8, '#a78bfa')}
    ${rect(16, 10, 32, 12, 5, '#8b5cf6')}
    ${line(24, 32, 40, 32, '#f5f3ff', 'stroke-width="4"')}
    ${line(32, 24, 32, 40, '#f5f3ff', 'stroke-width="4"')}
  `),
  check: svgFrame(`
    ${circle(32, 32, 24, '#22c55e')}
    ${strokePath('M20 33l8 8 16-18', '#ecfdf5', 'stroke-width="6"')}
  `),
  save: svgFrame(`
    ${rect(12, 10, 40, 44, 7, '#0ea5e9')}
    ${rect(20, 14, 18, 12, 3, '#e0f2fe')}
    ${rect(20, 34, 24, 12, 3, '#bae6fd')}
    ${rect(40, 14, 6, 10, 2, '#0369a1')}
  `),
  cancel: svgFrame(`
    ${circle(32, 32, 24, '#f87171')}
    ${line(23, 23, 41, 41, '#fff1f2', 'stroke-width="6"')}
    ${line(41, 23, 23, 41, '#fff1f2', 'stroke-width="6"')}
  `),
  undo: svgFrame(`
    ${strokePath('M26 18l-12 12 12 12', '#6366f1', 'stroke-width="6"')}
    ${strokePath('M18 30h18c8 0 14 6 14 14', '#6366f1', 'stroke-width="6"')}
  `),
  collab: svgFrame(`
    ${circle(22, 22, 8, '#60a5fa')}
    ${circle(42, 22, 8, '#f472b6')}
    ${path('M12 48c2-8 7-12 10-12s8 4 10 12', '#93c5fd')}
    ${path('M32 48c2-8 7-12 10-12s8 4 10 12', '#f9a8d4')}
    ${strokePath('M25 32c3 4 11 4 14 0', '#7c3aed', 'stroke-width="4"')}
  `),
  pending: svgFrame(`
    ${circle(32, 32, 24, '#f59e0b')}
    ${line(32, 20, 32, 33, '#fff7ed', 'stroke-width="5"')}
    ${line(32, 32, 40, 38, '#fff7ed', 'stroke-width="5"')}
  `),
  edit: svgFrame(`
    ${path('M15 45l3-11 20-20 8 8-20 20-11 3z', '#f97316')}
    ${path('M36 16l8 8', '#fdba74')}
    ${rect(14, 45, 16, 5, 2.5, '#fed7aa')}
  `),
  delete: svgFrame(`
    ${rect(20, 20, 24, 28, 4, '#ef4444')}
    ${rect(18, 14, 28, 6, 3, '#f87171')}
    ${rect(26, 10, 12, 4, 2, '#991b1b')}
    ${line(27, 26, 27, 42, '#fee2e2', 'stroke-width="4"')}
    ${line(37, 26, 37, 42, '#fee2e2', 'stroke-width="4"')}
  `),
  warning: svgFrame(`
    ${path('M32 10l24 42H8L32 10z', '#f59e0b')}
    ${line(32, 22, 32, 37, '#fff7ed', 'stroke-width="5"')}
    ${circle(32, 45, 3, '#fff7ed')}
  `),
  sync: svgFrame(`
    ${strokePath('M18 26a14 14 0 0122-8', '#0ea5e9', 'stroke-width="5"')}
    ${strokePath('M46 38a14 14 0 01-22 8', '#0ea5e9', 'stroke-width="5"')}
    ${path('M44 12l2 12-12-2', '#38bdf8')}
    ${path('M20 52l-2-12 12 2', '#38bdf8')}
  `),
  success: svgFrame(`
    ${circle(32, 32, 24, '#22c55e')}
    ${strokePath('M20 33l8 8 16-18', '#ecfdf5', 'stroke-width="6"')}
  `),
  offline: svgFrame(`
    ${strokePath('M18 20l10 10', '#475569', 'stroke-width="5"')}
    ${strokePath('M34 26l12-12', '#475569', 'stroke-width="5"')}
    ${strokePath('M34 26v12c0 4-3 7-7 7s-7-3-7-7v-4', '#475569', 'stroke-width="5"')}
    ${strokePath('M42 18l10 10', '#ef4444', 'stroke-width="5"')}
  `),
  cleanup: svgFrame(`
    ${strokePath('M18 14l18 18', '#a16207', 'stroke-width="5"')}
    ${path('M38 34l10 10c3 3 2 6-2 8L34 40z', '#facc15')}
    ${path('M14 10l8 8-4 4-8-8z', '#7c2d12')}
  `),
  party: badge('#a855f7', '#ec4899', `${circle(24, 24, 4, '#ffffff')}${circle(40, 18, 3, '#fde047')}${path('M30 18l5 14-8-3 6 12-12-8 3 10-10-6 7-10-11 2 9-7-8-7 12 2 1-11 6 9 7-8z', '#fef3c7')}`),
  sleep: svgFrame(`
    ${rect(12, 28, 40, 14, 5, '#60a5fa')}
    ${rect(12, 24, 10, 18, 5, '#1d4ed8')}
    ${rect(44, 24, 8, 18, 4, '#1e40af')}
    ${rect(18, 22, 12, 8, 3, '#dbeafe')}
  `),
  dental: svgFrame(`
    ${path('M24 12c-7 0-12 6-12 12 0 13 8 26 14 26 3 0 3-7 6-7s3 7 6 7c6 0 14-13 14-26 0-6-5-12-12-12-5 0-6 3-8 3s-3-3-8-3z', '#f8fafc', 'stroke="#93c5fd" stroke-width="2"')}
  `),
  pet: svgFrame(`
    ${circle(22, 22, 7, '#8b5cf6')}
    ${circle(42, 22, 7, '#8b5cf6')}
    ${circle(32, 34, 9, '#8b5cf6')}
    ${circle(24, 42, 6, '#8b5cf6')}
    ${circle(40, 42, 6, '#8b5cf6')}
  `),
  clean: svgFrame(`
    ${strokePath('M18 18l22 22', '#92400e', 'stroke-width="5"')}
    ${path('M38 38l12 12c2 2 1 5-3 6L31 40z', '#38bdf8')}
    ${path('M42 12l2 6 6 2-6 2-2 6-2-6-6-2 6-2z', '#facc15')}
  `),
  clothes: svgFrame(`
    ${path('M18 16l8-6 6 6h4l6-6 8 6-6 10v22H20V26z', '#f472b6')}
    ${path('M26 10l6 6 6-6', '#fbcfe8')}
  `),
  school: svgFrame(`
    ${path('M16 14h24c4 0 8 3 8 8v26H24c-4 0-8-3-8-8V14z', '#38bdf8')}
    ${path('M24 14h24v34H24c-4 0-8-3-8-8', '#0ea5e9')}
    ${line(24, 22, 40, 22, '#e0f2fe', 'stroke-width="4"')}
    ${line(24, 30, 40, 30, '#e0f2fe', 'stroke-width="4"')}
  `),
  bath: svgFrame(`
    ${rect(14, 30, 36, 14, 7, '#38bdf8')}
    ${line(18, 44, 16, 50, '#64748b', 'stroke-width="4"')}
    ${line(46, 44, 48, 50, '#64748b', 'stroke-width="4"')}
    ${path('M26 20c0-4 3-7 7-7s7 3 7 7', '#0ea5e9')}
    ${circle(18, 20, 3, '#bfdbfe')}
    ${circle(24, 15, 2, '#dbeafe')}
  `),
  food: svgFrame(`
    ${path('M18 38c2-10 10-14 14-14s12 4 14 14H18z', '#f59e0b')}
    ${rect(16, 38, 32, 6, 3, '#b45309')}
    ${path('M26 24l3-8 4 6 5-8', '#22c55e')}
  `),
  star: badge('#f59e0b', '#fde047', `<polygon points="${starPoints(32, 32, 16, 7)}" fill="#fff7ed" />`),
  target: badge('#ef4444', '#f97316', `${circle(32, 32, 16, '#fee2e2')}${circle(32, 32, 10, '#ef4444')}${circle(32, 32, 4, '#fff7ed')}`),
  rocket: badge('#38bdf8', '#2563eb', `${path('M32 14c6 3 10 10 10 18l-10 18-10-18c0-8 4-15 10-18z', '#f8fafc')}${path('M24 38l-6 8 8-2', '#fb7185')}${path('M40 38l6 8-8-2', '#fb7185')}${circle(32, 28, 4, '#38bdf8')}`),
  puzzle: badge('#8b5cf6', '#6366f1', `${path('M20 20h10c0-4 3-7 6-7s6 3 6 7v8h-8c0 4-3 7-6 7s-6-3-6-7h-8z', '#ede9fe')}${path('M34 28h10v16H20V34h14c0-4 3-7 6-7', '#ddd6fe')}`),
  balloon: badge('#fb7185', '#f472b6', `${circle(32, 24, 14, '#ffe4e6')}${path('M30 38l2 5 2-5', '#f43f5e')}${strokePath('M32 43c-2 4-2 8 0 11', '#ffffff', 'stroke-width="3"')}`),
  rainbow: badge('#38bdf8', '#a855f7', `${strokePath('M18 40a14 14 0 0128 0', '#ef4444', 'stroke-width="5"')}${strokePath('M22 40a10 10 0 0120 0', '#f59e0b', 'stroke-width="5"')}${strokePath('M26 40a6 6 0 0112 0', '#22c55e', 'stroke-width="5"')}`),
  trophy: badge('#f59e0b', '#facc15', `${path('M24 14h16v10c0 6-4 10-8 12-4-2-8-6-8-12V14z', '#fff7ed')}${path('M20 16h4v6c0 3-2 6-6 6h-2c-2 0-4-2-4-4 0-4 3-8 8-8z', '#fde68a')}${path('M44 16h-4v6c0 3 2 6 6 6h2c2 0 4-2 4-4 0-4-3-8-8-8z', '#fde68a')}${rect(26, 38, 12, 4, 2, '#b45309')}${rect(22, 42, 20, 6, 3, '#92400e')}`),
  music: badge('#06b6d4', '#14b8a6', `${path('M28 16v20a6 6 0 11-4-5V20l16-4v14a6 6 0 11-4-5V16z', '#ecfeff')}`),
  paint: badge('#f97316', '#fb7185', `${path('M32 14c11 0 18 8 18 16 0 7-5 12-12 12h-2c-2 0-4 2-4 4 0 2-2 4-4 4-10 0-18-8-18-18 0-9 10-18 22-18z', '#fff7ed')}${circle(24, 24, 3, '#60a5fa')}${circle(34, 21, 3, '#22c55e')}${circle(40, 28, 3, '#f59e0b')}`),
  build: badge('#64748b', '#0f172a', `${strokePath('M22 42l20-20', '#f8fafc', 'stroke-width="5"')}${path('M40 18l6-6 4 4-6 6z', '#94a3b8')}${path('M20 40l-6 8 8-2 2-6z', '#cbd5e1')}`),
  idea: badge('#fde047', '#f59e0b', `${path('M32 16c8 0 14 6 14 14 0 5-3 9-7 12-2 2-3 3-3 6h-8c0-3-1-4-3-6-4-3-7-7-7-12 0-8 6-14 14-14z', '#fff7ed')}${rect(26, 48, 12, 4, 2, '#b45309')}`),
  magic: badge('#a855f7', '#ec4899', `${path('M18 42l6 6 22-22-6-6z', '#f8fafc')}${path('M42 16l2 5 5 2-5 2-2 5-2-5-5-2 5-2z', '#fde68a')}`),
  medal: badge('#eab308', '#f59e0b', `${circle(32, 34, 12, '#fff7ed')}${circle(32, 34, 7, '#f59e0b')}${path('M24 12h8l4 10h-8z', '#2563eb')}${path('M32 12h8l-4 10h-8z', '#dc2626')}`),
  heart: badge('#fb7185', '#ec4899', `${path('M32 48s-14-9-18-16c-5-8 1-18 10-18 4 0 7 2 8 5 1-3 4-5 8-5 9 0 15 10 10 18-4 7-18 16-18 16z', '#fff1f2')}`),
  flower: badge('#f472b6', '#fb7185', `${circle(32, 32, 5, '#fde68a')}${circle(32, 18, 7, '#fff1f2')}${circle(46, 32, 7, '#fff1f2')}${circle(32, 46, 7, '#fff1f2')}${circle(18, 32, 7, '#fff1f2')}`),
  gift: badge('#22c55e', '#16a34a', `${rect(18, 24, 28, 22, 5, '#ecfdf5')}${rect(18, 20, 28, 8, 4, '#bbf7d0')}${rect(29, 20, 6, 26, 3, '#f43f5e')}${rect(18, 30, 28, 6, 3, '#f43f5e')}${path('M30 20c-4 0-7-2-7-5 0-2 2-4 4-4 4 0 5 5 5 9z', '#fecdd3')}${path('M34 20c4 0 7-2 7-5 0-2-2-4-4-4-4 0-5 5-5 9z', '#fecdd3')}`),
  diamond: badge('#60a5fa', '#38bdf8', `${path('M32 14l14 18-14 18-14-18 14-18z', '#eff6ff')}`),
  ball: badge('#fb923c', '#ef4444', `${circle(32, 32, 16, '#fff7ed')}${strokePath('M18 32h28', '#fb923c', 'stroke-width="3"')}${strokePath('M32 18v28', '#fb923c', 'stroke-width="3"')}${strokePath('M21 21c6 4 6 18 0 22', '#fb923c', 'stroke-width="3"')}${strokePath('M43 21c-6 4-6 18 0 22', '#fb923c', 'stroke-width="3"')}`)
});

export function getIconSvgMarkup(key) {
  return ICONS[key] || ICONS.star;
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
