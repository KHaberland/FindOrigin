import { ExtractedData } from '@/types';

/**
 * Регулярные выражения для извлечения сущностей
 */
const PATTERNS = {
  // Даты в различных форматах
  dates: [
    /\d{1,2}[\.\/-]\d{1,2}[\.\/-]\d{2,4}/g,
    /\d{1,2}\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+\d{4}/gi,
    /(?:январ[ья]|феврал[ья]|март[а]?|апрел[ья]|ма[йя]|июн[ья]|июл[ья]|август[а]?|сентябр[ья]|октябр[ья]|ноябр[ья]|декабр[ья])\s+\d{4}/gi,
    /\d{4}\s*(?:год[а]?|г\.?)/gi,
  ],
  
  // Числовые данные с единицами измерения
  numbers: [
    /\d+[\s,.]?\d*\s*(?:млн|млрд|тыс|%|рубл|долл|\$|€|₽)/gi,
    /\d+[\s,.]?\d*\s*(?:человек|чел\.|людей)/gi,
    /\d+[\s,.]?\d*\s*(?:км|м|кг|г|л|шт)/gi,
  ],
  
  // URL
  urls: /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g,
  
  // Имена (кириллица и латиница)
  potentialNames: /(?:[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+)?)|(?:[A-Z][a-z]+\s+[A-Z][a-z]+)/g,
};

/**
 * Стоп-слова, которые не являются именами
 */
const NAME_STOPWORDS = new Set([
  'Также', 'Однако', 'Поэтому', 'Кроме', 'После', 'Перед', 'Между',
  'Согласно', 'Несмотря', 'Благодаря', 'Именно', 'Только', 'Просто',
  'Новости', 'Россия', 'Украина', 'Москва', 'Санкт', 'Петербург',
  'Европа', 'Америка', 'Китай', 'Германия', 'Франция', 'Англия',
]);

/**
 * Извлекает структурированные данные из текста
 */
export async function extractData(text: string): Promise<ExtractedData> {
  const dates = extractDates(text);
  const numbers = extractNumbers(text);
  const urls = extractUrls(text);
  const names = extractNames(text);
  const claims = extractClaims(text);
  const searchQueries = generateSearchQueries(text, { dates, numbers, names, claims });

  return {
    originalText: text,
    claims,
    dates,
    numbers,
    names,
    urls,
    searchQueries,
  };
}

function extractDates(text: string): string[] {
  const dates = new Set<string>();
  for (const pattern of PATTERNS.dates) {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => dates.add(match.trim()));
    }
  }
  return Array.from(dates);
}

function extractNumbers(text: string): string[] {
  const numbers = new Set<string>();
  for (const pattern of PATTERNS.numbers) {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => numbers.add(match.trim()));
    }
  }
  return Array.from(numbers);
}

function extractUrls(text: string): string[] {
  const matches = text.match(PATTERNS.urls);
  return matches ? [...new Set(matches)] : [];
}

function extractNames(text: string): string[] {
  const matches = text.match(PATTERNS.potentialNames);
  if (!matches) return [];
  
  const names = matches.filter(name => {
    const firstWord = name.split(' ')[0];
    return !NAME_STOPWORDS.has(firstWord);
  });
  
  return [...new Set(names)];
}

/**
 * Извлекает ключевые утверждения из текста
 */
function extractClaims(text: string): string[] {
  const sentences = text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 20);

  const scoredSentences = sentences.map(sentence => ({
    text: sentence,
    score: calculateSentenceScore(sentence),
  }));

  return scoredSentences
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(s => s.text);
}

function calculateSentenceScore(sentence: string): number {
  let score = 0;
  
  if (/\d+/.test(sentence)) score += 2;
  
  for (const pattern of PATTERNS.dates) {
    if (pattern.test(sentence)) {
      score += 3;
      break;
    }
  }
  
  const capitalWords = sentence.match(/\s[А-ЯЁA-Z][а-яёa-z]+/g);
  if (capitalWords) score += capitalWords.length;
  
  if (sentence.length > 50 && sentence.length < 200) score += 1;
  
  if (/\?|как вы думаете|возможно ли/i.test(sentence)) score -= 2;
  
  return score;
}

/**
 * Генерирует поисковые запросы на основе извлечённых данных
 */
function generateSearchQueries(
  text: string, 
  data: { dates: string[]; numbers: string[]; names: string[]; claims: string[] }
): string[] {
  const queries: string[] = [];
  
  if (data.claims.length > 0) {
    queries.push(data.claims[0].substring(0, 100));
  }
  
  if (data.names.length > 0 && data.dates.length > 0) {
    queries.push(`${data.names[0]} ${data.dates[0]}`);
  }
  
  if (data.names.length > 0 && data.numbers.length > 0) {
    queries.push(`${data.names[0]} ${data.numbers[0]}`);
  }
  
  const keywords = extractKeywords(text);
  if (keywords.length >= 3) {
    queries.push(keywords.slice(0, 5).join(' '));
  }
  
  data.names.slice(0, 2).forEach(name => {
    queries.push(name);
  });
  
  return [...new Set(queries.filter(q => q && q.length > 5))];
}

function extractKeywords(text: string): string[] {
  const stopwords = new Set([
    'и', 'в', 'во', 'не', 'что', 'он', 'на', 'я', 'с', 'со', 'как', 'а', 'то',
    'все', 'она', 'так', 'его', 'но', 'да', 'ты', 'к', 'у', 'же', 'вы', 'за',
    'бы', 'по', 'только', 'её', 'ее', 'мне', 'было', 'вот', 'от', 'меня', 'ещё',
    'нет', 'о', 'из', 'ему', 'теперь', 'когда', 'уже', 'для', 'вас', 'нибудь',
    'опять', 'вдруг', 'ли', 'если', 'уж', 'или', 'ни', 'быть', 'был', 'него',
    'до', 'вам', 'нас', 'чем', 'потом', 'при', 'чего', 'раз', 'эта', 'это', 'этот',
  ]);
  
  const words = text
    .toLowerCase()
    .replace(/[^\wа-яё\s]/gi, ' ')
    .split(/\s+/)
    .filter(word => 
      word.length > 3 && 
      !stopwords.has(word) &&
      !/^\d+$/.test(word)
    );
  
  const frequency: Record<string, number> = {};
  words.forEach(word => {
    frequency[word] = (frequency[word] || 0) + 1;
  });
  
  return Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word);
}
