import { SearchResult } from '@/types';

/**
 * Выполняет поиск в интернете через Serper API
 */
export async function searchSources(queries: string[]): Promise<SearchResult[]> {
  const apiKey = process.env.SERPER_API_KEY;
  
  if (!apiKey) {
    console.warn('SERPER_API_KEY не установлен, используем заглушку');
    return getMockResults(queries);
  }

  const allResults: SearchResult[] = [];
  const searchQueries = queries.slice(0, 3);
  
  for (const query of searchQueries) {
    try {
      const results = await searchSerper(query, apiKey);
      allResults.push(...results);
    } catch (error) {
      console.error(`Search error for query "${query}":`, error);
    }
  }

  const uniqueResults = removeDuplicates(allResults);
  return uniqueResults.slice(0, 10);
}

/**
 * Выполняет поиск через Serper API
 */
async function searchSerper(query: string, apiKey: string): Promise<SearchResult[]> {
  const response = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: query,
      gl: 'ru',
      hl: 'ru',
      num: 10,
    }),
  });

  if (!response.ok) {
    throw new Error(`Serper API error: ${response.status}`);
  }

  const data = await response.json();
  const results: SearchResult[] = [];
  
  if (data.organic) {
    for (const item of data.organic) {
      results.push({
        title: item.title || '',
        link: item.link || '',
        snippet: item.snippet || '',
        date: item.date,
        source: extractDomain(item.link),
      });
    }
  }

  if (data.news) {
    for (const item of data.news) {
      results.push({
        title: item.title || '',
        link: item.link || '',
        snippet: item.snippet || '',
        date: item.date,
        source: item.source || extractDomain(item.link),
      });
    }
  }

  return results;
}

function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return '';
  }
}

function removeDuplicates(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return results.filter(result => {
    const key = result.link.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * Заглушка для тестирования без API ключа
 */
function getMockResults(queries: string[]): SearchResult[] {
  console.log('Using mock search results for queries:', queries);
  
  return [
    {
      title: 'Пример результата поиска 1',
      link: 'https://example.com/article1',
      snippet: 'Это пример результата поиска. В реальном режиме здесь будут настоящие результаты из Google.',
      source: 'example.com',
    },
    {
      title: 'Пример результата поиска 2',
      link: 'https://example.org/news/article',
      snippet: 'Второй пример результата. Для работы поиска установите SERPER_API_KEY.',
      source: 'example.org',
    },
    {
      title: 'Пример результата поиска 3',
      link: 'https://news.example.com/2024/story',
      snippet: 'Третий пример результата поиска с датой публикации.',
      date: '2024-01-15',
      source: 'news.example.com',
    },
  ];
}

/**
 * Фильтрует результаты по типу источника
 */
export function filterBySourceType(
  results: SearchResult[],
  type: 'news' | 'official' | 'blog' | 'research'
): SearchResult[] {
  const patterns: Record<string, RegExp[]> = {
    news: [
      /news\./i, /новости/i, /lenta\.ru/i, /ria\.ru/i, /tass\.ru/i,
      /rbc\.ru/i, /interfax/i, /kommersant/i, /vedomosti/i,
    ],
    official: [
      /gov\./i, /\.gov$/i, /government/i, /правительство/i,
      /министерство/i, /\.edu$/i,
    ],
    blog: [
      /blog/i, /medium\.com/i, /habr/i, /vc\.ru/i,
      /zen\.yandex/i, /dzen\.ru/i,
    ],
    research: [
      /research/i, /journal/i, /science/i, /academic/i,
      /scholar/i, /pubmed/i, /arxiv/i, /cyberleninka/i,
    ],
  };

  const typePatterns = patterns[type];
  if (!typePatterns) return results;

  return results.filter(result => 
    typePatterns.some(pattern => 
      pattern.test(result.link) || pattern.test(result.source || '')
    )
  );
}
