const CATEGORY_RULES = Object.freeze([
  {
    label: 'Søvn',
    iconKey: 'sleep',
    keywords: ['make the bed', 'bed', 'seng', 'red seng', 'rede seng']
  },
  {
    label: 'Tandpleje',
    iconKey: 'dental',
    keywords: ['brush teeth', 'teeth', 'tooth', 'taender', 'tand', 'borst taender', 'børst tænder']
  },
  {
    label: 'Kæledyr',
    iconKey: 'pet',
    keywords: ['feed dog', 'feed the dog', 'dog', 'hund', 'fodr hund', 'fodre hund', 'pet', 'cat', 'kat', 'fish', 'fisk']
  },
  {
    label: 'Rengøring',
    iconKey: 'cleanup',
    keywords: ['clean', 'tidy', 'opryd', 'ryd op', 'stovsug', 'støvsug', 'sweep', 'vacuum', 'wash dishes', 'opvask']
  },
  {
    label: 'Tøj',
    iconKey: 'clothes',
    keywords: ['laundry', 'vasketoj', 'vasketøj', 'toj', 'tøj', 'clothes']
  },
  {
    label: 'Skole',
    iconKey: 'school',
    keywords: ['homework', 'lektier', 'read', 'laes', 'læs', 'book']
  },
  {
    label: 'Bad',
    iconKey: 'bath',
    keywords: ['bath', 'shower', 'bad', 'vaske sig', 'wash up']
  },
  {
    label: 'Mad',
    iconKey: 'food',
    keywords: ['table', 'dinner', 'meal', 'mad', 'bord', 'kokken', 'køkken']
  }
]);

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
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

export function getChoreVisual(choreName, choreId) {
  const normalizedName = normalizeText(choreName);
  const keywordRule = findRule(normalizedName);

  if (keywordRule) {
    return {
      iconKey: keywordRule.iconKey,
      label: keywordRule.label,
      source: 'keyword',
    };
  }

  return {
    iconKey: 'star',
    label: 'Opgave',
    source: 'fallback',
  };
}
