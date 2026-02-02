/**
 * Тестирование парсера с разными типами входных данных:
 * текст (короткий/длинный), ссылки t.me, граничные случаи.
 */
import { parseInput, cleanText, isTelegramLink, extractUrls } from '@/lib/parser';

// Мок fetch для ссылок t.me
const originalFetch = globalThis.fetch;
beforeAll(() => {
  (globalThis as any).fetch = jest.fn((url: string) => {
    if (url.includes('t.me') && url.includes('embed=1')) {
      return Promise.resolve({
        ok: true,
        text: () =>
          Promise.resolve(
            '<div class="tgme_widget_message_text">Текст из поста Telegram</div>'
          ),
      } as Response);
    }
    return originalFetch(url);
  });
});
afterAll(() => {
  (globalThis as any).fetch = originalFetch;
});

describe('parseInput', () => {
  describe('текст', () => {
    it('распознаёт обычный текст (достаточно длинный)', async () => {
      const input = 'Это обычный текст для проверки первоисточника.';
      const result = await parseInput(input);
      expect(result.type).toBe('text');
      expect(result.text.length).toBeGreaterThan(0);
      expect(result.text).toContain('первоисточника');
    });

    it('распознаёт длинное сообщение', async () => {
      const longText =
        'В 2024 году произошло много событий. '.repeat(10) +
        'Это длинный текст для проверки.';
      const result = await parseInput(longText);
      expect(result.type).toBe('text');
      expect(result.text.length).toBeGreaterThan(20);
    });

    it('короткий ввод (меньше 11 символов без ссылки) считает unknown', async () => {
      const result = await parseInput('Коротко');
      expect(result.type).toBe('unknown');
    });

    it('пустая строка после trim — unknown', async () => {
      const result = await parseInput('   ');
      expect(result.type).toBe('unknown');
    });

    it('строка из 10 символов без ссылки — unknown', async () => {
      const result = await parseInput('Ровно 10!');
      expect(result.type).toBe('unknown');
    });

    it('текст с переносами строк нормализуется', async () => {
      const input = 'Первая строка.\n\nВторая строка.\n\n\nТретья.';
      const result = await parseInput(input);
      expect(result.type).toBe('text');
      expect(result.text).not.toMatch(/\n{3,}/);
    });
  });

  describe('ссылки t.me', () => {
    it('распознаёт ссылку t.me/channel/123 и извлекает текст', async () => {
      const input = 'https://t.me/durov/123';
      const result = await parseInput(input);
      expect(result.type).toBe('telegram_link');
      expect(result.originalUrl).toBe(input);
      expect(result.text).toBeTruthy();
    });

    it('распознаёт ссылку без протокола', async () => {
      const input = 't.me/example_channel/456';
      const result = await parseInput(input);
      expect(result.type).toBe('telegram_link');
      expect(result.originalUrl).toBe(input);
    });

    it('распознаёт telegram.me', async () => {
      const input = 'https://telegram.me/some_channel/789';
      const result = await parseInput(input);
      expect(result.type).toBe('telegram_link');
    });
  });

  describe('прочие случаи', () => {
    it('только обычный URL (не t.me) — не считается текстом', async () => {
      const input = 'https://example.com/page';
      const result = await parseInput(input);
      expect(result.type).toBe('unknown');
    });
  });
});

describe('cleanText', () => {
  it('схлопывает множественные пробелы', () => {
    expect(cleanText('a    b   c')).toBe('a b c');
  });

  it('убирает лишние переносы строк', () => {
    expect(cleanText('a\n\n\n\nb')).toBe('a\n\nb');
  });
});

describe('isTelegramLink', () => {
  it('возвращает true для t.me/chan/123', () => {
    expect(isTelegramLink('https://t.me/chan/123')).toBe(true);
    expect(isTelegramLink('t.me/chan/123')).toBe(true);
  });

  it('возвращает false для обычного URL', () => {
    expect(isTelegramLink('https://google.com')).toBe(false);
  });
});

describe('extractUrls', () => {
  it('извлекает URL из текста', () => {
    const urls = extractUrls('Смотри https://example.com и http://test.org');
    expect(urls).toContain('https://example.com');
    expect(urls).toContain('http://test.org');
  });

  it('возвращает пустой массив если URL нет', () => {
    expect(extractUrls('Просто текст')).toEqual([]);
  });
});
