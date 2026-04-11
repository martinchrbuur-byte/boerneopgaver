const CATEGORY_RULES = Object.freeze([
  {
    label: 'Søvn',
    visuals: ['sleep', 'star'],
    keywords: ['make the bed', 'bed', 'seng', 'red seng', 'rede seng']
  },
  {
    label: 'Tandpleje',
    visuals: ['dental', 'magic'],
    keywords: ['brush teeth', 'teeth', 'tooth', 'taender', 'tand', 'borst taender', 'børst tænder']
  },
  {
    label: 'Kæledyr',
    visuals: ['pet', 'star'],
    keywords: ['feed dog', 'feed the dog', 'dog', 'hund', 'fodr hund', 'fodre hund', 'pet', 'cat', 'kat', 'fish', 'fisk']
  },
  {
    label: 'Rengøring',
    visuals: ['clean', 'magic'],
    keywords: ['clean', 'tidy', 'opryd', 'ryd op', 'stovsug', 'støvsug', 'sweep', 'vacuum', 'wash dishes', 'opvask']
  },
  {
    label: 'Tøj',
    visuals: ['clothes', 'star'],
    keywords: ['laundry', 'vasketoj', 'vasketøj', 'toj', 'tøj', 'clothes']
  },
  {
    label: 'Skole',
    visuals: ['school', 'idea'],
    keywords: ['homework', 'lektier', 'read', 'laes', 'læs', 'book']
  },
  {
    label: 'Bad',
    visuals: ['bath', 'magic'],
    keywords: ['bath', 'shower', 'bad', 'vaske sig', 'wash up']
  },
  {
    label: 'Mad',
    visuals: ['food', 'star'],
    keywords: ['table', 'dinner', 'meal', 'mad', 'bord', 'kokken', 'køkken']
  }
]);

const FALLBACK_VISUALS = Object.freeze([
  { iconKey: 'star', label: 'Stjerne' },
  { iconKey: 'target', label: 'Mål' },
  { iconKey: 'rocket', label: 'Mission' },
  { iconKey: 'puzzle', label: 'Puslespil' },
  { iconKey: 'balloon', label: 'Sjov' },
  { iconKey: 'rainbow', label: 'Regnbue' },
  { iconKey: 'trophy', label: 'Sejr' },
  { iconKey: 'music', label: 'Rytme' },
  { iconKey: 'paint', label: 'Kreativ' },
  { iconKey: 'build', label: 'Byg' },
  { iconKey: 'idea', label: 'Idé' },
  { iconKey: 'magic', label: 'Magi' },
  { iconKey: 'medal', label: 'Guld' }
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
      : ['star'];
    const iconKey = visuals[hash % visuals.length];

    return {
      iconKey,
      label: keywordRule.label,
      source: 'keyword'
    };
  }

  const fallbackIndex = normalizedName.length > 0
    ? hash % FALLBACK_VISUALS.length
    : 0;
  const fallback = FALLBACK_VISUALS[fallbackIndex];
  return {
    iconKey: fallback.iconKey,
    label: fallback.label,
    source: 'fallback'
  };
}
