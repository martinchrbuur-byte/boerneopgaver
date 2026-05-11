import { getDailyMoodIconForChore } from './emojiMoodRegistry.js';

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
    // Use the first visuals entry as the category key for the mood registry,
    // falling back to the original hash-based pick if no mood icon is found.
    const categoryKey = keywordRule.visuals[0] ?? 'star';
    const iconKey = getDailyMoodIconForChore(categoryKey, normalizedName, choreId);

    return {
      iconKey,
      label: keywordRule.label,
      source: 'keyword',
    };
  }

  // No keyword match — daily-varying fallback
  const iconKey = getDailyMoodIconForChore('fallback', normalizedName, choreId);
  return {
    iconKey,
    label: 'Opgave',
    source: 'fallback',
  };
}
