// ==================== Telegram типы ====================

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  entities?: TelegramMessageEntity[];
}

export interface TelegramMessageEntity {
  type: string;
  offset: number;
  length: number;
  url?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

// ==================== Типы входных данных ====================

export type InputType = 'text' | 'telegram_link' | 'unknown';

export interface ParsedInput {
  type: InputType;
  text: string;
  originalUrl?: string;
}

// ==================== Извлечённые данные ====================

export interface ExtractedData {
  originalText: string;
  claims: string[];        // Ключевые утверждения
  dates: string[];         // Найденные даты
  numbers: string[];       // Числовые данные
  names: string[];         // Имена людей/организаций
  urls: string[];          // Ссылки
  searchQueries: string[]; // Сформированные поисковые запросы
}

// ==================== Результаты поиска ====================

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  date?: string;
  source?: string;
}
