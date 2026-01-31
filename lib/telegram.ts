import { TelegramUpdate } from '@/types';

const TELEGRAM_API = 'https://api.telegram.org/bot';

/**
 * Получает токен бота из переменных окружения
 */
function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN не установлен');
  }
  return token;
}

/**
 * Отправляет сообщение пользователю через Telegram API
 */
export async function sendMessage(
  chatId: number,
  text: string,
  options?: {
    parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    disableWebPagePreview?: boolean;
  }
): Promise<boolean> {
  const token = getBotToken();
  const url = `${TELEGRAM_API}${token}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: options?.parseMode || 'HTML',
        disable_web_page_preview: options?.disableWebPagePreview || false,
      }),
    });

    const result = await response.json();
    
    if (!result.ok) {
      console.error('Telegram API error:', result);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending message:', error);
    return false;
  }
}

/**
 * Отправляет индикатор "печатает..." пользователю
 */
export async function sendTypingAction(chatId: number): Promise<void> {
  const token = getBotToken();
  const url = `${TELEGRAM_API}${token}/sendChatAction`;

  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        action: 'typing',
      }),
    });
  } catch (error) {
    console.error('Error sending typing action:', error);
  }
}

/**
 * Извлекает данные сообщения из Telegram Update
 */
export function extractMessageData(update: TelegramUpdate): {
  chatId: number;
  text: string;
  userId?: number;
  username?: string;
} | null {
  const message = update.message;
  
  if (!message || !message.text) {
    return null;
  }

  return {
    chatId: message.chat.id,
    text: message.text,
    userId: message.from?.id,
    username: message.from?.username,
  };
}

/**
 * Проверяет, является ли сообщение командой
 */
export function isCommand(text: string): boolean {
  return text.startsWith('/');
}

/**
 * Извлекает команду из текста
 */
export function extractCommand(text: string): string | null {
  if (!isCommand(text)) return null;
  const match = text.match(/^\/(\w+)/);
  return match ? match[1] : null;
}
