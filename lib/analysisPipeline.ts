import { parseInput } from '@/lib/parser';
import { generateSearchQueries, analyzeSourcesWithAI } from '@/lib/ai';
import { searchMultipleQueries, SerpAPILimitError } from '@/lib/search';
import type { ParsedInput, AIAnalysisResult, SearchResult } from '@/types';

export { SerpAPILimitError };

export interface AnalysisPipelineSuccess {
  success: true;
  parsedInput: ParsedInput;
  searchQueries: string[];
  searchResults: SearchResult[];
  analysis: AIAnalysisResult;
}

export interface AnalysisPipelineError {
  success: false;
  error: string;
  errorCode: 'unknown_format' | 'text_too_short' | 'no_queries' | 'no_sources' | 'search_limit' | 'internal';
}

export type AnalysisPipelineResult = AnalysisPipelineSuccess | AnalysisPipelineError;

/**
 * Выполняет полный пайплайн анализа: парсинг → AI-запросы → поиск → AI-анализ.
 * Используется вебхуком бота и API для Telegram Mini App.
 */
export async function runAnalysis(text: string): Promise<AnalysisPipelineResult> {
  const parsedInput = await parseInput(text);

  if (parsedInput.type === 'unknown') {
    return {
      success: false,
      error: 'Не удалось распознать формат данных. Отправьте текст для проверки или ссылку t.me.',
      errorCode: 'unknown_format',
    };
  }

  if (parsedInput.text.length < 20) {
    return {
      success: false,
      error: 'Текст слишком короткий (минимум 20 символов).',
      errorCode: 'text_too_short',
    };
  }

  const searchQueries = await generateSearchQueries(parsedInput.text);
  if (searchQueries.length === 0) {
    return {
      success: false,
      error: 'Не удалось сформировать поисковые запросы. Попробуйте более информативный текст.',
      errorCode: 'no_queries',
    };
  }

  let searchResults: SearchResult[];
  try {
    searchResults = await searchMultipleQueries(searchQueries);
  } catch (err) {
    if (err instanceof SerpAPILimitError) {
      return {
        success: false,
        error: 'Лимит поиска исчерпан. Бесплатный API: 250 запросов в месяц. Лимит обновится в начале следующего месяца.',
        errorCode: 'search_limit',
      };
    }
    throw err;
  }

  if (searchResults.length === 0) {
    return {
      success: false,
      error: 'Не удалось найти возможные источники. Проверьте настройки поиска на сервере.',
      errorCode: 'no_sources',
    };
  }

  const analysis = await analyzeSourcesWithAI(parsedInput.text, searchResults);

  return {
    success: true,
    parsedInput,
    searchQueries,
    searchResults,
    analysis,
  };
}
