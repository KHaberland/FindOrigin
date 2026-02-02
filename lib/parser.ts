import { ParsedInput } from '@/types';

/**
 * Регулярные выражения для распознавания типов ввода
 */
const TELEGRAM_LINK_REGEX = /(?:https?:\/\/)?(?:t\.me|telegram\.me)\/([a-zA-Z0-9_]+)\/(\d+)/;
const URL_REGEX = /https?:\/\/[^\s]+/g;

/**
 * Определяет тип входных данных и парсит их
 */
export async function parseInput(input: string): Promise<ParsedInput> {
  const trimmedInput = input.trim();

  // Проверяем, является ли это ссылкой на Telegram-пост
  const telegramMatch = trimmedInput.match(TELEGRAM_LINK_REGEX);
  if (telegramMatch) {
    const text = await fetchTelegramPostText(trimmedInput, telegramMatch[1], telegramMatch[2]);
    return {
      type: 'telegram_link',
      text: text || trimmedInput,
      originalUrl: trimmedInput,
    };
  }

  // Если это просто текст (не только URL)
  if (trimmedInput.length > 10 && !isOnlyUrl(trimmedInput)) {
    return {
      type: 'text',
      text: cleanText(trimmedInput),
    };
  }

  // Неизвестный формат
  return {
    type: 'unknown',
    text: trimmedInput,
  };
}

/**
 * Проверяет, содержит ли строка только URL
 */
function isOnlyUrl(text: string): boolean {
  const cleaned = text.replace(URL_REGEX, '').trim();
  return cleaned.length === 0;
}

/**
 * Очищает текст от лишних символов
 */
export function cleanText(text: string): string {
  return text
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/** Таймаут запроса к embed t.me (мс) */
const TELEGRAM_EMBED_TIMEOUT_MS = 8000;

/**
 * Извлекает текст из Telegram-поста через embed
 */
async function fetchTelegramPostText(
  url: string, 
  channel: string, 
  messageId: string
): Promise<string | null> {
  try {
    const embedUrl = `https://t.me/${channel}/${messageId}?embed=1`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TELEGRAM_EMBED_TIMEOUT_MS);
    
    const response = await fetch(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`Failed to fetch Telegram post: ${response.status}`);
      return null;
    }

    const html = await response.text();
    const text = extractTextFromTelegramEmbed(html);
    return text;

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('Telegram embed fetch timeout');
    } else {
      console.error('Error fetching Telegram post:', error);
    }
    return null;
  }
}

/**
 * Извлекает текст из HTML embed-версии Telegram поста
 */
function extractTextFromTelegramEmbed(html: string): string | null {
  const textMatch = html.match(
    /<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/
  );

  if (!textMatch) {
    return null;
  }

  let text = textMatch[1];

  text = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();

  return text || null;
}

/**
 * Извлекает все URL из текста
 */
export function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX);
  return matches || [];
}

/**
 * Проверяет, является ли URL ссылкой на Telegram
 */
export function isTelegramLink(url: string): boolean {
  return TELEGRAM_LINK_REGEX.test(url);
}
