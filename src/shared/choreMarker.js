const CATEGORY_RULES = Object.freeze([
  {
    label: 'Søvn',
    visuals: ['🛏️', '🛌', '🌙', '🧸'],
    keywords: ['make the bed', 'bed', 'seng', 'red seng', 'rede seng']
  },
  {
    label: 'Tandpleje',
    visuals: ['🪥', '🦷', '✨', '🫧'],
    keywords: ['brush teeth', 'teeth', 'tooth', 'taender', 'tand', 'borst taender', 'børst tænder']
  },
  {
    label: 'Kæledyr',
    visuals: ['🐶', '🐱', '🐾', '🦴'],
    keywords: ['feed dog', 'feed the dog', 'dog', 'hund', 'fodr hund', 'fodre hund', 'pet', 'cat', 'kat', 'fish', 'fisk']
  },
  {
    label: 'Rengøring',
    visuals: ['🧹', '🧽', '🪣', '✨'],
    keywords: ['clean', 'tidy', 'opryd', 'ryd op', 'stovsug', 'støvsug', 'sweep', 'vacuum', 'wash dishes', 'opvask']
  },
  {
    label: 'Tøj',
    visuals: ['🧺', '👕', '🧦', '🫧'],
    keywords: ['laundry', 'vasketoj', 'vasketøj', 'toj', 'tøj', 'clothes']
  },
  {
    label: 'Skole',
    visuals: ['📚', '✏️', '📖', '🧠'],
    keywords: ['homework', 'lektier', 'read', 'laes', 'læs', 'book']
  },
  {
    label: 'Bad',
    visuals: ['🛁', '🚿', '🧼', '🫧'],
    keywords: ['bath', 'shower', 'bad', 'vaske sig', 'wash up']
  },
  {
    label: 'Mad',
    visuals: ['🍽️', '🥗', '🍳', '🥣'],
    keywords: ['table', 'dinner', 'meal', 'mad', 'bord', 'kokken', 'køkken']
  }
]);

const FALLBACK_VISUALS = Object.freeze([
  { emoji: '⭐', label: 'Stjerne' },
  { emoji: '🎯', label: 'Mål' },
  { emoji: '🚀', label: 'Mission' },
  { emoji: '🧩', label: 'Puslespil' },
  { emoji: '🎈', label: 'Sjov' },
  { emoji: '🌈', label: 'Regnbue' },
  { emoji: '🏆', label: 'Sejr' },
  { emoji: '🎵', label: 'Rytme' },
  { emoji: '🎨', label: 'Kreativ' },
  { emoji: '🛠️', label: 'Byg' },
  { emoji: '🧭', label: 'Eventyr' },
  { emoji: '🎲', label: 'Spil' },
  { emoji: '💡', label: 'Idé' },
  { emoji: '🪄', label: 'Magi' },
  { emoji: '🥇', label: 'Guld' }
]);

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function hashString(value) {
  let hash = 0;
  for (const char of value) {
    hash = (hash << 5) - hash + char.charCodeAt(0);
    hash |= 0;
  }
  return Math.abs(hash);
}

function findRule(normalizedName) {
  for (const rule of CATEGORY_RULES) {
    const match = rule.keywords.some(keyword => normalizedName.includes(normalizeText(keyword)));
    if (match) {
      return rule;
    }
  }

  return null;
}

export function getChoreVisual(choreName) {
  const normalizedName = normalizeText(choreName);
  const keywordRule = findRule(normalizedName);
  const hash = hashString(normalizedName);

  if (keywordRule) {
    const visuals = Array.isArray(keywordRule.visuals) && keywordRule.visuals.length > 0
      ? keywordRule.visuals
      : ['⭐'];
    const emoji = visuals[hash % visuals.length];

    return {
      emoji,
      label: keywordRule.label,
      source: 'keyword'
    };
  }

  const fallbackIndex = normalizedName.length > 0
    ? hash % FALLBACK_VISUALS.length
    : 0;
  const fallback = FALLBACK_VISUALS[fallbackIndex];
  return {
    emoji: fallback.emoji,
    label: fallback.label,
    source: 'fallback'
  };
}
