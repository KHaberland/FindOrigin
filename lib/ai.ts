import OpenAI from 'openai';
import { SearchResult, AIAnalysisResult } from '@/types';

/** Извлекает строку из возможных markdown-блоков и парсит JSON массив; при ошибке — fallback */
function parseJsonArray(content: string): string[] {
  const raw = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    const arrMatch = raw.match(/\[[\s\S]*/);
    if (arrMatch) {
      const fixed = arrMatch[0].replace(/,(\s*[}\]])/g, '$1');
      let closed = fixed;
      const openBrackets = (fixed.match(/\[/g) || []).length - (fixed.match(/\]/g) || []).length;
      if (openBrackets > 0) closed = fixed + ']'.repeat(openBrackets);
      try {
        const parsed = JSON.parse(closed);
        return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
      } catch {
        const quoted = Array.from(raw.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"/g), m => m[1].replace(/\\"/g, '"'));
        return quoted.length > 0 ? quoted : [];
      }
    }
    const quoted = Array.from(raw.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"/g), m => m[1].replace(/\\"/g, '"'));
    return quoted.length > 0 ? quoted : [];
  }
}

/** Безопасный парсинг JSON объекта; при ошибке возвращает null */
function parseJsonObject<T = unknown>(content: string): T | null {
  const raw = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return JSON.parse(raw) as T;
  } catch {
    const objMatch = raw.match(/\{[\s\S]*/);
    if (objMatch) {
      let closed = objMatch[0];
      const open = (closed.match(/\{/g) || []).length - (closed.match(/\}/g) || []).length;
      if (open > 0) closed += '}'.repeat(open);
      try {
        return JSON.parse(closed) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

// Ленивая инициализация клиента OpenAI
let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI | null {
  const apiKey = (process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY)?.trim();
  if (!apiKey) {
    return null;
  }
  if (!openaiClient) {
    const baseURL = (process.env.OPENAI_BASE_URL || '').trim()
      || (process.env.OPENROUTER_API_KEY ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1');
    openaiClient = new OpenAI({
      apiKey: apiKey,
      baseURL: baseURL,
    });
  }
  return openaiClient;
}

/**
 * Генерирует поисковые запросы из текста с помощью AI
 */
export async function generateSearchQueries(text: string): Promise<string[]> {
  const openai = getOpenAI();
  if (!openai) {
    console.warn('OpenAI API key not set, using fallback');
    return [text.substring(0, 100)];
  }

  try {
    const model = (process.env.OPENAI_MODEL || process.env.OPENROUTER_MODEL || 'gpt-4o-mini').trim();
    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'system',
          content: `Язык: русский. Текст пользователя может быть на русском — обрабатывай его и формируй поисковые запросы на том же языке.
Ты помощник для поиска первоисточников информации.
Проанализируй текст и создай 2-3 поисковых запроса для Google, которые помогут найти оригинальный источник этой информации.
Запросы должны содержать ключевые факты, имена, даты, цифры из текста.
Верни только JSON массив строк с запросами, без пояснений.
Пример: ["запрос 1", "запрос 2"]`
        },
        {
          role: 'user',
          content: text.substring(0, 2000)
        }
      ],
      temperature: 0.3,
      max_tokens: 300,
    });

    const content = response.choices[0]?.message?.content || '[]';
    const queries = parseJsonArray(content);
    return queries.length > 0 ? queries.slice(0, 3) : [text.substring(0, 100)];
  } catch (error) {
    console.error('Error generating search queries:', error);
    return [text.substring(0, 100)];
  }
}

/**
 * Анализирует найденные источники и определяет релевантность
 */
export async function analyzeSourcesWithAI(
  originalText: string,
  searchResults: SearchResult[]
): Promise<AIAnalysisResult> {
  if (searchResults.length === 0) {
    return {
      sources: [],
      confidence: 0,
      explanation: 'Источники не найдены.',
    };
  }

  const openai = getOpenAI();
  if (!openai) {
    // Fallback без AI
    return {
      sources: searchResults.slice(0, 3).map(r => ({
        url: r.link,
        title: r.title,
        snippet: r.snippet || '',
        relevance: 50,
        isLikelyOriginal: false,
        reason: '',
      })),
      confidence: 30,
      explanation: 'AI-анализ недоступен (нет API ключа).',
    };
  }

  try {
    const sourcesInfo = searchResults.slice(0, 5).map((r, i) => 
      `${i + 1}. "${r.title}" - ${r.link}\n   ${r.snippet || ''}`
    ).join('\n\n');

    const model = (process.env.OPENAI_MODEL || process.env.OPENROUTER_MODEL || 'gpt-4o-mini').trim();
    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'system',
          content: `Язык: русский. Все поля reason и explanation — только на русском.
Ты эксперт по проверке информации и поиску первоисточников.
Проанализируй исходный текст и найденные источники. Определи, какие источники наиболее вероятно являются первоисточником информации.

Верни JSON в формате:
{
  "sources": [
    {
      "index": 1,
      "relevance": 85,
      "isLikelyOriginal": true,
      "reason": "краткое объяснение"
    }
  ],
  "confidence": 75,
  "explanation": "общий вывод о найденных источниках"
}

- relevance: оценка релевантности 0-100
- confidence: общая уверенность в результате 0-100
- isLikelyOriginal: true если источник вероятно является оригиналом`
        },
        {
          role: 'user',
          content: `ИСХОДНЫЙ ТЕКСТ:\n${originalText.substring(0, 1500)}\n\nНАЙДЕННЫЕ ИСТОЧНИКИ:\n${sourcesInfo}`
        }
      ],
      temperature: 0.2,
      max_tokens: 800,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const analysis = parseJsonObject<{ sources?: Array<{ index: number; relevance?: number; isLikelyOriginal?: boolean; reason?: string }>; confidence?: number; explanation?: string }>(content);

    if (!analysis) {
      throw new Error('Invalid AI response format');
    }

    const analyzedSources = searchResults.slice(0, 5).map((result, index) => {
      const sourceAnalysis = analysis.sources?.find((s: any) => s.index === index + 1);
      return {
        url: result.link,
        title: result.title,
        snippet: result.snippet || '',
        relevance: sourceAnalysis?.relevance || 50,
        isLikelyOriginal: sourceAnalysis?.isLikelyOriginal || false,
        reason: sourceAnalysis?.reason || '',
      };
    });

    analyzedSources.sort((a, b) => b.relevance - a.relevance);

    return {
      sources: analyzedSources,
      confidence: analysis.confidence || 50,
      explanation: analysis.explanation || 'Анализ завершён.',
    };
  } catch (error) {
    console.error('Error analyzing sources:', error);
    
    return {
      sources: searchResults.slice(0, 3).map(r => ({
        url: r.link,
        title: r.title,
        snippet: r.snippet || '',
        relevance: 50,
        isLikelyOriginal: false,
        reason: '',
      })),
      confidence: 30,
      explanation: 'Не удалось выполнить AI-анализ. Показаны результаты поиска.',
    };
  }
}
