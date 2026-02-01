/**
 * FindOrigin Bot - Локальный режим с AI (polling)
 * Использует OpenAI GPT-4o-mini и Google Search API
 */

const fs = require('fs');
const path = require('path');

// Загрузка переменных окружения из .env
const envPath = path.join(__dirname, '.env');
const env = {};
try {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const [key, ...values] = line.split('=');
    if (key && values.length) {
      env[key.trim()] = values.join('=').trim();
    }
  });
} catch (e) {
  console.error('Ошибка чтения .env:', e.message);
}

const BOT_TOKEN = env.BOT_TOKEN;
const OPENAI_API_KEY = env.OPENAI_API_KEY;
const GOOGLE_API_KEY = env.GOOGLE_API_KEY;
const GOOGLE_SEARCH_ENGINE_ID = env.GOOGLE_SEARCH_ENGINE_ID;

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN не найден в .env');
  process.exit(1);
}

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

console.log('🤖 FindOrigin Bot (AI Mode)');
console.log('===========================');
console.log(`OpenAI: ${OPENAI_API_KEY ? '✅' : '❌'}`);
console.log(`Google Search: ${GOOGLE_API_KEY && GOOGLE_SEARCH_ENGINE_ID ? '✅' : '❌'}`);
console.log('');

let offset = 0;

// ==================== Telegram ====================

async function sendMessage(chatId, text) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    })
  });
}

async function sendTyping(chatId) {
  await fetch(`${TELEGRAM_API}/sendChatAction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action: 'typing' })
  });
}

// ==================== OpenAI ====================

async function generateSearchQueries(text) {
  if (!OPENAI_API_KEY) {
    return [text.substring(0, 100)];
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Создай 2-3 поисковых запроса для Google чтобы найти первоисточник этой информации.
Запросы должны содержать ключевые факты, имена, даты из текста.
Верни только JSON массив: ["запрос 1", "запрос 2"]`
          },
          { role: 'user', content: text.substring(0, 2000) }
        ],
        temperature: 0.3,
        max_tokens: 300
      })
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '[]';
    const queries = JSON.parse(content);
    return Array.isArray(queries) ? queries.slice(0, 3) : [text.substring(0, 100)];
  } catch (e) {
    console.error('OpenAI error:', e.message);
    return [text.substring(0, 100)];
  }
}

async function analyzeWithAI(originalText, searchResults) {
  if (!OPENAI_API_KEY || searchResults.length === 0) {
    return {
      sources: searchResults.slice(0, 3).map(r => ({
        ...r, relevance: 50, isLikelyOriginal: false, reason: ''
      })),
      confidence: 30,
      explanation: 'AI-анализ недоступен.'
    };
  }

  try {
    const sourcesInfo = searchResults.slice(0, 5).map((r, i) =>
      `${i + 1}. "${r.title}" - ${r.link}\n   ${r.snippet || ''}`
    ).join('\n\n');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Ты эксперт по проверке информации. Проанализируй текст и источники.
Верни JSON:
{
  "sources": [{"index": 1, "relevance": 85, "isLikelyOriginal": true, "reason": "причина"}],
  "confidence": 75,
  "explanation": "вывод"
}`
          },
          {
            role: 'user',
            content: `ТЕКСТ:\n${originalText.substring(0, 1500)}\n\nИСТОЧНИКИ:\n${sourcesInfo}`
          }
        ],
        temperature: 0.2,
        max_tokens: 800
      })
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    const analysis = JSON.parse(content);

    const analyzedSources = searchResults.slice(0, 5).map((r, i) => {
      const sa = analysis.sources?.find(s => s.index === i + 1);
      return {
        ...r,
        relevance: sa?.relevance || 50,
        isLikelyOriginal: sa?.isLikelyOriginal || false,
        reason: sa?.reason || ''
      };
    });

    analyzedSources.sort((a, b) => b.relevance - a.relevance);

    return {
      sources: analyzedSources,
      confidence: analysis.confidence || 50,
      explanation: analysis.explanation || 'Анализ завершён.'
    };
  } catch (e) {
    console.error('AI analysis error:', e.message);
    return {
      sources: searchResults.slice(0, 3).map(r => ({
        ...r, relevance: 50, isLikelyOriginal: false, reason: ''
      })),
      confidence: 30,
      explanation: 'Ошибка AI-анализа.'
    };
  }
}

// ==================== Google Search ====================

async function searchGoogle(query) {
  if (!GOOGLE_API_KEY || !GOOGLE_SEARCH_ENGINE_ID) {
    console.log('   Google Search не настроен, используем DuckDuckGo');
    return searchDuckDuckGo(query);
  }

  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}&num=10`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.items) return [];

    return data.items.map(item => ({
      title: item.title || '',
      link: item.link || '',
      snippet: item.snippet || ''
    }));
  } catch (e) {
    console.error('Google Search error:', e.message);
    return searchDuckDuckGo(query);
  }
}

async function searchDuckDuckGo(query) {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const html = await res.text();
    
    const results = [];
    const regex = /<a rel="nofollow" class="result__a" href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
    let match;
    
    while ((match = regex.exec(html)) !== null && results.length < 5) {
      let link = match[1];
      if (link.includes('uddg=')) {
        const u = link.match(/uddg=([^&]+)/);
        if (u) link = decodeURIComponent(u[1]);
      }
      if (link.startsWith('http') && !link.includes('duckduckgo')) {
        results.push({ title: match[2].trim(), link, snippet: '' });
      }
    }
    return results;
  } catch (e) {
    return [];
  }
}

// ==================== Обработка ====================

async function processMessage(chatId, text) {
  if (text === '/start') {
    await sendMessage(chatId, 
      '👋 Привет! Я <b>FindOrigin</b> с AI.\n\n' +
      'Отправь мне текст — я найду первоисточник с помощью GPT-4o-mini и Google Search!'
    );
    return;
  }

  if (text === '/help') {
    await sendMessage(chatId,
      '📖 <b>Как пользоваться:</b>\n\n' +
      '1️⃣ Отправьте текст для проверки\n' +
      '2️⃣ AI сгенерирует поисковые запросы\n' +
      '3️⃣ Поиск в Google/DuckDuckGo\n' +
      '4️⃣ AI проанализирует источники\n\n' +
      '/start - начать\n/help - справка'
    );
    return;
  }

  if (text.startsWith('/')) {
    await sendMessage(chatId, '❓ Неизвестная команда');
    return;
  }

  if (text.length < 20) {
    await sendMessage(chatId, '⚠️ Текст слишком короткий (минимум 20 символов)');
    return;
  }

  console.log(`\n📨 Получен текст (${text.length} символов)`);
  await sendTyping(chatId);
  await sendMessage(chatId, '🔍 Анализирую текст с помощью AI...');

  // 1. Генерируем поисковые запросы через AI
  console.log('   🤖 Генерация поисковых запросов...');
  const queries = await generateSearchQueries(text);
  console.log(`   Запросы: ${queries.join(', ').substring(0, 60)}...`);

  await sendTyping(chatId);

  // 2. Поиск
  console.log('   🔎 Поиск в интернете...');
  let allResults = [];
  for (const query of queries) {
    const results = await searchGoogle(query);
    allResults.push(...results);
    await new Promise(r => setTimeout(r, 300));
  }

  // Убираем дубликаты
  const seen = new Set();
  allResults = allResults.filter(r => {
    if (seen.has(r.link)) return false;
    seen.add(r.link);
    return true;
  });

  console.log(`   Найдено: ${allResults.length} результатов`);

  if (allResults.length === 0) {
    await sendMessage(chatId, '😔 Не удалось найти источники.');
    return;
  }

  await sendTyping(chatId);

  // 3. AI-анализ
  console.log('   🤖 AI-анализ источников...');
  const analysis = await analyzeWithAI(text, allResults);

  // 4. Формируем ответ
  const emoji = analysis.confidence >= 70 ? '🟢' : analysis.confidence >= 40 ? '🟡' : '🔴';
  
  let response = `🔎 <b>Результаты анализа:</b>\n\n`;
  response += `${emoji} <b>Уверенность: ${analysis.confidence}%</b>\n`;
  response += `💬 ${analysis.explanation}\n\n`;
  response += `<b>Источники:</b>\n\n`;

  analysis.sources.slice(0, 3).forEach((s, i) => {
    const icon = s.isLikelyOriginal ? '⭐' : s.relevance >= 60 ? '📄' : '📝';
    response += `${i + 1}. ${icon} <a href="${s.link}">${s.title.substring(0, 50)}</a>\n`;
    response += `   Релевантность: ${s.relevance}%`;
    if (s.reason) response += ` - ${s.reason}`;
    response += '\n\n';
  });

  response += '💡 <i>Проверьте источники для подтверждения.</i>';

  await sendMessage(chatId, response);
  console.log(`✅ Ответ отправлен (уверенность: ${analysis.confidence}%)`);
}

// ==================== Polling ====================

async function poll() {
  try {
    const res = await fetch(`${TELEGRAM_API}/getUpdates?offset=${offset}&timeout=30`);
    const data = await res.json();

    if (data.ok && data.result.length > 0) {
      for (const upd of data.result) {
        offset = upd.update_id + 1;
        if (upd.message?.text) {
          const chatId = upd.message.chat.id;
          const text = upd.message.text;
          console.log(`👤 ${upd.message.from?.first_name}: ${text.substring(0, 30)}...`);
          await processMessage(chatId, text);
        }
      }
    }
  } catch (e) {
    if (!e.message?.includes('ECONNRESET')) {
      console.error('Polling error:', e.message);
    }
  }
  setTimeout(poll, 1000);
}

// ==================== Запуск ====================

async function start() {
  await fetch(`${TELEGRAM_API}/deleteWebhook`);
  console.log('✅ Бот запущен!\n');
  poll();
}

start();
