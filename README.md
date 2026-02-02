# FindOrigin

Telegram-бот для поиска первоисточников информации (текст или ссылка t.me → AI-поиск и анализ).

## Запуск тестов

```powershell
npm test
```

Тесты проверяют парсер на разных типах данных: обычный текст, длинные/короткие сообщения, ссылки `t.me`, граничные случаи.

## Деплой на Vercel

### Переменные окружения (Environment Variables)

| Переменная | Обязательно | Описание |
|------------|-------------|----------|
| `BOT_TOKEN` или `TELEGRAM_BOT_TOKEN` | да | Токен бота от [@BotFather](https://t.me/BotFather) |
| `OPENAI_API_KEY` или `OPENROUTER_API_KEY` | да (для AI) | Ключ OpenAI или OpenRouter |
| `GOOGLE_API_KEY` | **да (для поиска)** | Ключ Google Custom Search API |
| `GOOGLE_SEARCH_ENGINE_ID` | **да (для поиска)** | ID поисковой системы (cx) из Programmable Search Engine |
| `OPENAI_MODEL` / `OPENROUTER_MODEL` | нет | Модель (по умолчанию gpt-4o-mini) |

**Почему бот «ничего не находит»:** без `GOOGLE_API_KEY` и `GOOGLE_SEARCH_ENGINE_ID` используется DuckDuckGo, который на серверах Vercel часто возвращает 403. Нужно настроить **Google Programmable Search Engine**.

### Настройка Google поиска

1. **API-ключ:** [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Enable **Custom Search API** → Credentials → Create API Key.
2. **Search Engine ID (cx):** [Programmable Search Engine](https://programmablesearchengine.google.com/) → Add → укажите «Search the entire web» или свой сайт → после создания скопируйте **Search engine ID** (cx).
3. В Vercel: **Settings → Environment Variables** — добавьте `GOOGLE_API_KEY` и `GOOGLE_SEARCH_ENGINE_ID` (имена **точно** такие).

После деплоя в логах Vercel (Functions → выберите функцию → Logs) будут сообщения вида `[Search] Google: ...` или `[Webhook] Найдено результатов: N` — по ним можно понять, сработал ли поиск.

- В проекте задан `NODE_OPTIONS=--no-deprecation` в `vercel.json`, чтобы убрать предупреждение `url.parse` в логах.