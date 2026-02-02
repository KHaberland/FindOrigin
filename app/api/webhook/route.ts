import { NextRequest, NextResponse } from 'next/server';
import { TelegramUpdate } from '@/types';
import { 
  sendMessage, 
  sendTypingAction, 
  extractMessageData, 
  isCommand, 
  extractCommand 
} from '@/lib/telegram';
import { parseInput } from '@/lib/parser';
import { generateSearchQueries, analyzeSourcesWithAI } from '@/lib/ai';
import { searchMultipleQueries } from '@/lib/search';

/**
 * Обработчик webhook от Telegram
 */
export async function POST(request: NextRequest) {
  try {
    const update: TelegramUpdate = await request.json();
    const messageData = extractMessageData(update);
    
    if (!messageData) {
      return NextResponse.json({ ok: true });
    }

    const { chatId, text } = messageData;

    // Обработка команд
    if (isCommand(text)) {
      const command = extractCommand(text);
      
      switch (command) {
        case 'start': {
          const modelEnv = (process.env.OPENAI_MODEL || process.env.OPENROUTER_MODEL || '').trim();
          let modelName = 'AI';
          if (modelEnv) {
            if (modelEnv.toLowerCase().includes('nvidia')) modelName = 'Nvidia';
            else if (!modelEnv.toLowerCase().includes('gpt-4o-mini')) modelName = modelEnv;
          }
          await sendMessage(
            chatId,
            '👋 Привет! Я бот <b>FindOrigin</b> с AI.\n\n' +
            `Я помогу найти первоисточник информации с помощью ${modelName}.\n\n` +
            '📝 Отправь мне текст для проверки!'
          );
          return NextResponse.json({ ok: true });
        }

        case 'help':
          await sendMessage(
            chatId,
            '📖 <b>Как пользоваться ботом:</b>\n\n' +
            '1️⃣ Отправьте текст для проверки\n' +
            '2️⃣ AI сгенерирует поисковые запросы\n' +
            '3️⃣ Поиск в Google\n' +
            '4️⃣ AI проанализирует источники\n\n' +
            '<b>Команды:</b>\n' +
            '/start - Начать работу\n' +
            '/help - Справка'
          );
          return NextResponse.json({ ok: true });

        default:
          await sendMessage(chatId, '❓ Неизвестная команда. Используйте /help');
          return NextResponse.json({ ok: true });
      }
    }

    // Отправляем индикатор "печатает..."
    await sendTypingAction(chatId);

    // Обработка текста - запускаем асинхронно
    processMessage(chatId, text).catch(error => {
      console.error('Error processing message:', error);
    });

    // Возвращаем 200 OK сразу
    return NextResponse.json({ ok: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ ok: true });
  }
}

/**
 * Асинхронная обработка сообщения с AI
 */
async function processMessage(chatId: number, text: string): Promise<void> {
  try {
    // 1. Парсим входные данные
    const parsedInput = await parseInput(text);
    
    if (parsedInput.type === 'unknown') {
      await sendMessage(
        chatId,
        '⚠️ Не удалось распознать формат данных.\n' +
        'Отправьте текст для проверки.'
      );
      return;
    }

    if (parsedInput.text.length < 20) {
      await sendMessage(
        chatId,
        '⚠️ Текст слишком короткий (минимум 20 символов).'
      );
      return;
    }

    await sendMessage(
      chatId,
      '🔍 Анализирую текст с помощью AI...\n' +
      'Это может занять несколько секунд.'
    );

    // 2. Генерируем поисковые запросы через AI
    const searchQueries = await generateSearchQueries(parsedInput.text);

    if (searchQueries.length === 0) {
      await sendMessage(
        chatId,
        '⚠️ Не удалось сформировать поисковые запросы.\n' +
        'Попробуйте отправить более информативный текст.'
      );
      return;
    }

    await sendTypingAction(chatId);

    // 3. Ищем источники
    const searchResults = await searchMultipleQueries(searchQueries);

    if (searchResults.length === 0) {
      await sendMessage(
        chatId,
        '😔 К сожалению, не удалось найти возможные источники.'
      );
      return;
    }

    await sendTypingAction(chatId);

    // 4. AI-анализ источников
    const analysis = await analyzeSourcesWithAI(parsedInput.text, searchResults);

    // 5. Формируем ответ
    const emoji = analysis.confidence >= 70 ? '🟢' : analysis.confidence >= 40 ? '🟡' : '🔴';
    
    let response = `🔎 <b>Результаты анализа:</b>\n\n`;
    response += `${emoji} <b>Уверенность: ${analysis.confidence}%</b>\n`;
    response += `💬 ${analysis.explanation}\n\n`;
    response += `<b>Источники:</b>\n\n`;

    analysis.sources.slice(0, 3).forEach((source, index) => {
      const icon = source.isLikelyOriginal ? '⭐' : source.relevance >= 60 ? '📄' : '📝';
      response += `${index + 1}. ${icon} <a href="${source.url}">${source.title.substring(0, 50)}</a>\n`;
      response += `   Релевантность: ${source.relevance}%`;
      if (source.reason) {
        response += ` - ${source.reason}`;
      }
      response += '\n\n';
    });

    response += '💡 <i>Проверьте источники для подтверждения информации.</i>';

    await sendMessage(chatId, response, { disableWebPagePreview: true });

  } catch (error) {
    console.error('Error in processMessage:', error);
    await sendMessage(
      chatId,
      '❌ Произошла ошибка при обработке.\n' +
      'Пожалуйста, попробуйте позже.'
    );
  }
}

/**
 * GET запрос для проверки работоспособности
 */
export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    bot: 'FindOrigin',
    version: '2.0 AI',
    message: 'Webhook endpoint is working' 
  });
}
