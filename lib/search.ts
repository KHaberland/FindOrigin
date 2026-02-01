import { SearchResult } from '@/types';

/**
 * Выполняет поиск через Google Custom Search API
 */
export async function searchGoogle(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.GOOGLE_API_KEY;
  const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

  if (!apiKey || !searchEngineId) {
    console.warn('Google API credentials not set, using fallback');
    return [];
  }

  try {
    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.set('key', apiKey);
    url.searchParams.set('cx', searchEngineId);
    url.searchParams.set('q', query);
    url.searchParams.set('num', '10');

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      console.error('Google Search API error:', response.status);
      return [];
    }

    const data = await response.json();
    
    if (!data.items) {
      return [];
    }

    return data.items.map((item: any) => ({
      title: item.title || '',
      link: item.link || '',
      snippet: item.snippet || '',
      source: extractDomain(item.link),
    }));
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}

/**
 * Выполняет поиск по нескольким запросам
 */
export async function searchMultipleQueries(queries: string[]): Promise<SearchResult[]> {
  const allResults: SearchResult[] = [];
  
  for (const query of queries.slice(0, 3)) {
    const results = await searchGoogle(query);
    allResults.push(...results);
    
    await new Promise(r => setTimeout(r, 200));
  }

  const seen = new Set<string>();
  return allResults.filter(result => {
    const key = result.link.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Извлекает домен из URL
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return '';
  }
}
