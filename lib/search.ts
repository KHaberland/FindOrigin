import { SearchResult } from '@/types';

/** TTL кэша поиска (мс), 5 минут */
const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;

/** Ошибка исчерпания лимита SerpAPI */
export class SerpAPILimitError extends Error {
  constructor() {
    super('SerpAPI limit exceeded');
    this.name = 'SerpAPILimitError';
  }
}

interface CacheEntry {
  results: SearchResult[];
  expiresAt: number;
}

const searchCache = new Map<string, CacheEntry>();

function getCachedResults(query: string): SearchResult[] | null {
  const key = query.trim().toLowerCase();
  const entry = searchCache.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    if (entry) searchCache.delete(key);
    return null;
  }
  return entry.results;
}

function setCachedResults(query: string, results: SearchResult[]): void {
  const key = query.trim().toLowerCase();
  searchCache.set(key, {
    results,
    expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
  });
}

/**
 * Выполняет поиск через SerpAPI (Google по всему интернету)
 * @throws {SerpAPILimitError} если исчерпан лимит запросов
 */
async function searchSerpAPI(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.SERPAPI_KEY?.trim();

  if (!apiKey) {
    console.warn('[Search] SerpAPI: не задан SERPAPI_KEY — пропускаем.');
    return [];
  }

  try {
    const url = new URL('https://serpapi.com/search.json');
    url.searchParams.set('engine', 'google');
    url.searchParams.set('q', query);
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('num', '10');
    url.searchParams.set('hl', 'ru');
    url.searchParams.set('gl', 'ru');

    const response = await fetch(url.toString());
    const data = await response.json();

    // Проверяем на ошибку лимита
    if (response.status === 429 || 
        (data.error && (
          data.error.includes('run out of searches') ||
          data.error.includes('limit') ||
          data.error.includes('quota') ||
          data.error.includes('exceeded')
        ))) {
      console.error('[Search] SerpAPI: лимит запросов исчерпан!');
      throw new SerpAPILimitError();
    }

    if (!response.ok || data.error) {
      console.error('[Search] SerpAPI error:', data.error || response.statusText);
      return [];
    }

    if (!data.organic_results || !Array.isArray(data.organic_results)) {
      console.warn('[Search] SerpAPI: пустой ответ (нет organic_results).');
      return [];
    }

    return data.organic_results.map((item: any) => ({
      title: item.title || '',
      link: item.link || '',
      snippet: item.snippet || '',
      source: extractDomain(item.link),
    }));
  } catch (error) {
    // Пробрасываем ошибку лимита дальше
    if (error instanceof SerpAPILimitError) {
      throw error;
    }
    console.error('SerpAPI error:', error);
    return [];
  }
}

/**
 * Выполняет поиск через Google Custom Search API (запасной)
 */
async function searchGoogle(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.GOOGLE_API_KEY?.trim();
  const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID?.trim();

  if (!apiKey || !searchEngineId) {
    return [];
  }

  try {
    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.set('key', apiKey);
    url.searchParams.set('cx', searchEngineId);
    url.searchParams.set('q', query);
    url.searchParams.set('num', '10');

    const response = await fetch(url.toString());
    const data = await response.json();

    if (!response.ok) {
      const errMsg = data?.error?.message || data?.error?.errors?.[0]?.message || response.statusText;
      console.error('[Search] Google API error:', response.status, errMsg);
      return [];
    }

    if (data.error) {
      console.error('[Search] Google API error in body:', data.error.message || data.error);
      return [];
    }

    if (!data.items || !Array.isArray(data.items)) {
      return [];
    }

    return data.items.map((item: any) => ({
      title: item.title || '',
      link: item.link || '',
      snippet: item.snippet || '',
      source: extractDomain(item.link),
    }));
  } catch (error) {
    console.error('Google Search error:', error);
    return [];
  }
}

/**
 * Выполняет поиск через DuckDuckGo (без API).
 * На серверах (Vercel и др.) часто возвращается 403 — для стабильного поиска настройте GOOGLE_API_KEY.
 */
async function searchDuckDuckGo(query: string): Promise<SearchResult[]> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
      }
    });
    
    if (!response.ok) {
      if (response.status === 403) {
        console.warn('DuckDuckGo 403 (often blocks server IPs). Set GOOGLE_API_KEY and GOOGLE_SEARCH_ENGINE_ID for reliable search.');
      } else {
        console.error('DuckDuckGo error:', response.status);
      }
      return [];
    }

    const html = await response.text();
    const results: SearchResult[] = [];
    
    // Парсим результаты из HTML
    const regex = /<a rel="nofollow" class="result__a" href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
    let match;
    
    while ((match = regex.exec(html)) !== null && results.length < 10) {
      let link = match[1];
      
      // Декодируем редирект DuckDuckGo
      if (link.includes('uddg=')) {
        const uddgMatch = link.match(/uddg=([^&]+)/);
        if (uddgMatch) {
          link = decodeURIComponent(uddgMatch[1]);
        }
      }
      
      if (link.startsWith('http') && !link.includes('duckduckgo.com')) {
        results.push({
          title: match[2].trim(),
          link: link,
          snippet: '',
          source: extractDomain(link),
        });
      }
    }
    
    return results;
  } catch (error) {
    console.error('DuckDuckGo error:', error);
    return [];
  }
}

/**
 * Выполняет поиск - сначала кэш, затем SerpAPI, Google CSE, потом DuckDuckGo как fallback
 * @throws {SerpAPILimitError} если исчерпан лимит SerpAPI
 */
async function search(query: string): Promise<SearchResult[]> {
  const cached = getCachedResults(query);
  if (cached && cached.length > 0) {
    return cached;
  }

  // 1. Пробуем SerpAPI (поиск по всему интернету)
  // Ошибка лимита пробрасывается наверх
  let results = await searchSerpAPI(query);

  // 2. Если SerpAPI не сработал — пробуем Google CSE
  if (results.length === 0) {
    console.warn('[Search] SerpAPI не вернул результатов, пробуем Google CSE');
    results = await searchGoogle(query);
  }

  // 3. Если Google CSE не сработал — пробуем DuckDuckGo (на Vercel часто 403)
  if (results.length === 0) {
    console.warn('[Search] DuckDuckGo fallback');
    results = await searchDuckDuckGo(query);
    if (results.length === 0) {
      console.warn('[Search] Все методы поиска не вернули результатов. Настройте SERPAPI_KEY в Vercel.');
    }
  }

  if (results.length > 0) {
    setCachedResults(query, results);
  }
  return results;
}

/**
 * Выполняет поиск по нескольким запросам
 * @throws {SerpAPILimitError} если исчерпан лимит SerpAPI
 */
export async function searchMultipleQueries(queries: string[]): Promise<SearchResult[]> {
  const allResults: SearchResult[] = [];
  
  for (const query of queries.slice(0, 3)) {
    // Ошибка лимита пробрасывается наверх
    const results = await search(query);
    allResults.push(...results);
    
    await new Promise(r => setTimeout(r, 300));
  }

  // Убираем дубликаты
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
