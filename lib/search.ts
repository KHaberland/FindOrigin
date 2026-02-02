import { SearchResult } from '@/types';

/**
 * Выполняет поиск через Google Custom Search API
 */
async function searchGoogle(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.GOOGLE_API_KEY;
  const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

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
 * Выполняет поиск - сначала Google, потом DuckDuckGo как fallback
 */
async function search(query: string): Promise<SearchResult[]> {
  // Пробуем Google
  let results = await searchGoogle(query);
  
  // Если Google не сработал - используем DuckDuckGo
  if (results.length === 0) {
    console.log('Using DuckDuckGo fallback');
    results = await searchDuckDuckGo(query);
  }
  
  return results;
}

/**
 * Выполняет поиск по нескольким запросам
 */
export async function searchMultipleQueries(queries: string[]): Promise<SearchResult[]> {
  const allResults: SearchResult[] = [];
  
  for (const query of queries.slice(0, 3)) {
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
