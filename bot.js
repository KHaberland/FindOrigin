/**
 * FindOrigin Bot - Локальный режим (polling)
 * Запуск: node bot.js
 */

require('dotenv').config({ path: '.env' });

const BOT_TOKEN = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('❌ Токен бота не найден! Добавьте BOT_TOKEN в .env');
  process.exit(1);
}
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

console.log('🤖 FindOrigin Bot');
console.log('=================');

let offset = 0;

// Отправка сообщения
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

// Извлечение данных
function extractData(text) {
  const dates = text.match(/\d{1,2}[\.\/-]\d{1,2}[\.\/-]\d{2,4}/g) || [];
  const numbers = text.match(/\d+\s*(?:млн|млрд|тыс|%)/gi) || [];
  const names = text.match(/[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+/g) || [];
  
  const stopwords = ['это', 'что', 'как', 'для', 'при', 'или', 'если'];
  const words = text.toLowerCase()
    .replace(/[^\wа-яё\s]/gi, ' ')
    .split(/\s+/)
    .filter(w => w.length > 4 && !stopwords.includes(w));
  
  return { dates, numbers, names, keywords: [...new Set(words)].slice(0, 5) };
}

// Поиск через DuckDuckGo
async function search(query) {
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
        results.push({ title: match[2].trim(), link });
      }
    }
    return results;
  } catch (e) {
    return [];
  }
}

// Обработка сообщения
async function process(chatId, text) {
  if (text === '/start') {
    await sendMessage(chatId, '👋 Привет! Я <b>FindOrigin</b>.\n\nОтправь текст — найду источники!');
    return;
  }
  if (text === '/help') {
    await sendMessage(chatId, '📖 Отправьте текст для поиска источников.\n\n/start - начать\n/help - справка');
    return;
  }
  if (text.startsWith('/')) {
    await sendMessage(chatId, '❓ Неизвестная команда');
    return;
  }
  if (text.length < 15) {
    await sendMessage(chatId, '⚠️ Текст слишком короткий');
    return;
  }

  console.log(`\n📨 Текст: "${text.substring(0, 40)}..."`);
  await sendMessage(chatId, '🔍 Ищу источники...');

  const data = extractData(text);
  const query = data.keywords.join(' ') || text.substring(0, 50);
  const results = await search(query);

  if (results.length === 0) {
    await sendMessage(chatId, '😔 Источники не найдены.\n\n' +
      `<b>Данные:</b>\n• Даты: ${data.dates.join(', ') || '-'}\n• Имена: ${data.names.join(', ') || '-'}`);
    return;
  }

  let msg = '🔎 <b>Найденные источники:</b>\n\n';
  results.forEach((r, i) => {
    msg += `${i + 1}. <a href="${r.link}">${r.title.substring(0, 50)}</a>\n`;
  });
  msg += `\n<b>Данные:</b>\n`;
  if (data.dates.length) msg += `• Даты: ${data.dates.join(', ')}\n`;
  if (data.names.length) msg += `• Имена: ${data.names.join(', ')}\n`;
  msg += '\n💡 <i>Проверьте источники вручную</i>';

  await sendMessage(chatId, msg);
  console.log(`✅ Найдено: ${results.length} источников`);
}

// Polling
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
          console.log(`👤 ${upd.message.from?.first_name}: ${text.substring(0, 30)}`);
          await process(chatId, text);
        }
      }
    }
  } catch (e) {
    console.error('Ошибка:', e.message);
  }
  setTimeout(poll, 1000);
}

// Старт
async function start() {
  await fetch(`${TELEGRAM_API}/deleteWebhook`);
  console.log('✅ Бот запущен!\n');
  poll();
}

start();
