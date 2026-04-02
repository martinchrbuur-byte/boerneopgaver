const CATEGORY_RULES = Object.freeze([
  {
    emoji: '🛏️',
    label: 'Søvn',
    keywords: ['make the bed', 'bed', 'seng', 'red seng', 'rede seng']
  },
  {
    emoji: '🪥',
    label: 'Tandpleje',
    keywords: ['brush teeth', 'teeth', 'tooth', 'taender', 'tand', 'borst taender', 'børst tænder']
  },
  {
    emoji: '🐶',
    label: 'Kæledyr',
    keywords: ['feed dog', 'feed the dog', 'dog', 'hund', 'fodr hund', 'fodre hund', 'pet', 'cat', 'kat', 'fish', 'fisk']
  },
  {
    emoji: '🧹',
    label: 'Rengøring',
    keywords: ['clean', 'tidy', 'opryd', 'ryd op', 'stovsug', 'støvsug', 'sweep', 'vacuum', 'wash dishes', 'opvask']
  },
  {
    emoji: '🧺',
    label: 'Tøj',
    keywords: ['laundry', 'vasketoj', 'vasketøj', 'toj', 'tøj', 'clothes']
  },
  {
    emoji: '📚',
    label: 'Skole',
    keywords: ['homework', 'lektier', 'read', 'laes', 'læs', 'book']
  },
  {
    emoji: '🛁',
    label: 'Bad',
    keywords: ['bath', 'shower', 'bad', 'vaske sig', 'wash up']
  },
  {
    emoji: '🍽️',
    label: 'Mad',
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
  { emoji: '🎵', label: 'Rytme' }
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

  if (keywordRule) {
    return {
      emoji: keywordRule.emoji,
      label: keywordRule.label,
      source: 'keyword'
    };
  }

  const fallbackIndex = normalizedName.length > 0
    ? hashString(normalizedName) % FALLBACK_VISUALS.length
    : 0;
  const fallback = FALLBACK_VISUALS[fallbackIndex];
  return {
    emoji: fallback.emoji,
    label: fallback.label,
    source: 'fallback'
  };
}
