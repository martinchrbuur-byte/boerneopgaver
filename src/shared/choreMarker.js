import { getStoredEmojiMapping, normalizeMappingName, rememberEmojiMapping } from './emojiMappingService.js';

const CATEGORY_RULES = Object.freeze([
  {
    label: 'Søvn',
    iconKey: 'sleep',
    keywords: ['make the bed', 'bed', 'seng', 'red seng', 'rede seng']
  },
  {
    label: 'Tandpleje',
    iconKey: 'dental',
    keywords: ['brush teeth', 'teeth', 'tooth', 'taender', 'tand', 'borst taender', 'borste taender', 'børst tænder', 'børste tænder']
  },
  {
    label: 'Hårpleje',
    iconKey: 'hair',
    keywords: ['hair', 'hår', 'frisure', 'red hair', 'ordne hår', 'sæt hår']
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
    keywords: ['laundry', 'vasketoj', 'vasketøj', 'toj', 'tøj', 'clothes', 'tag tøj på', 'læg tøj frem', 'laeg toj frem']
  },
  {
    label: 'Skole',
    iconKey: 'school',
    keywords: ['homework', 'lektier', 'read', 'laes', 'læs', 'book', 'school', 'skole', 'pak taske', 'pak tasker', 'skoletaske']
  },
  {
    label: 'Bad',
    iconKey: 'bath',
    keywords: ['bath', 'shower', 'bad', 'vaske sig', 'wash up']
  },
  {
    label: 'Mad',
    iconKey: 'food',
    keywords: ['breakfast', 'morgenmad', 'table', 'dinner', 'meal', 'mad', 'madpakke', 'madpakker', 'bord', 'kokken', 'køkken']
  }
]);

const HEURISTIC_RULES = Object.freeze([
  { label: 'Søvn', iconKey: 'sleep', words: ['bed', 'seng', 'sove', 'søvn', 'pude', 'dyne'] },
  { label: 'Tandpleje', iconKey: 'dental', words: ['toothbrush', 'tandbørste', 'tandpleje'] },
  { label: 'Hårpleje', iconKey: 'hair', words: ['hårbørste', 'hårpleje', 'frisure'] },
  { label: 'Kæledyr', iconKey: 'pet', words: ['kæledyr', 'hvalp', 'killing', 'akvarium', 'foder'] },
  { label: 'Rengøring', iconKey: 'cleanup', words: ['feje', 'rengøring', 'rydde', 'sortere', 'støvsuger', 'affald', 'skrald'] },
  { label: 'Tøj', iconKey: 'clothes', words: ['vasketøj', 'laundry', 'strømper', 'sokker', 'jakke', 'outfit'] },
  { label: 'Skole', iconKey: 'school', words: ['taske', 'tasker', 'backpack', 'skole', 'bøger', 'bog', 'blyant', 'lektie'] },
  { label: 'Bad', iconKey: 'bath', words: ['brusebad', 'bruser', 'shower', 'badekar'] },
  { label: 'Mad', iconKey: 'food', words: ['frokost', 'lunch', 'morgenmad', 'sandwich', 'opskrift', 'cooking'] },
]);

const STOP_WORDS = new Set([
  'a', 'at', 'den', 'det', 'en', 'et', 'for', 'fra', 'i', 'jeg', 'med', 'min', 'mit',
  'my', 'of', 'og', 'på', 'the', 'til', 'to', 'under', 'ved', 'with'
]);

function normalizeText(value) {
  return normalizeMappingName(value);
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

function findHeuristicRule(normalizedName) {
  const tokens = new Set(normalizedName.split(/[^a-z0-9]+/).filter(token => token && !STOP_WORDS.has(token)));
  const scored = HEURISTIC_RULES.map((rule, index) => ({
    rule,
    index,
    score: rule.words.reduce((total, word) => {
      const normalizedWord = normalizeText(word);
      if (normalizedWord.includes(' ')) {
        return total + (normalizedName.includes(normalizedWord) ? 3 : 0);
      }
      return total + (tokens.has(normalizedWord) ? 2 : 0);
    }, 0),
  })).sort((left, right) => right.score - left.score || left.index - right.index);

  const [best, second] = scored;
  if (!best || best.score < 2 || best.score - (second?.score ?? 0) < 1) return null;
  return best.rule;
}

export function getChoreVisual(choreName, choreId, { storage } = {}) {
  const normalizedName = normalizeText(choreName);
  const keywordRule = findRule(normalizedName);

  if (keywordRule) {
    return {
      iconKey: keywordRule.iconKey,
      label: keywordRule.label,
      source: 'keyword',
    };
  }

  const storedIconKey = getStoredEmojiMapping(normalizedName, storage);
  if (storedIconKey) {
    return {
      iconKey: storedIconKey,
      label: 'Automatisk valgt',
      source: 'learned',
    };
  }

  const heuristicRule = findHeuristicRule(normalizedName);
  if (heuristicRule) {
    rememberEmojiMapping(normalizedName, heuristicRule.iconKey, storage);
    return {
      iconKey: heuristicRule.iconKey,
      label: heuristicRule.label,
      source: 'heuristic',
    };
  }

  return {
    iconKey: 'task',
    label: 'Opgave',
    source: 'fallback',
  };
}
