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
import { extractData } from '@/lib/extractor';
import { searchSources } from '@/lib/search';

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
        case 'start':
          await sendMessage(
            chatId,
            '👋 Привет! Я бот <b>FindOrigin</b>.\n\n' +
            'Я помогу найти первоисточник информации.\n\n' +
            '📝 Отправь мне:\n' +
            '• Текст для проверки\n' +
            '• Ссылку на Telegram-пост (t.me/...)\n\n' +
            'И я постараюсь найти оригинальный источник!'
          );
          return NextResponse.json({ ok: true });

        case 'help':
          await sendMessage(
            chatId,
            '📖 <b>Как пользоваться ботом:</b>\n\n' +
            '1️⃣ Отправьте текст или ссылку на пост\n' +
            '2️⃣ Бот проанализирует информацию\n' +
            '3️⃣ Получите список возможных источников\n\n' +
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

    // Обработка текста/ссылки - запускаем асинхронно
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
 * Асинхронная обработка сообщения
 */
async function processMessage(chatId: number, text: string): Promise<void> {
  try {
    // 1. Парсим входные данные
    const parsedInput = await parseInput(text);
    
    if (parsedInput.type === 'unknown') {
      await sendMessage(
        chatId,
        '⚠️ Не удалось распознать формат данных.\n' +
        'Отправьте текст или ссылку на Telegram-пост.'
      );
      return;
    }

    await sendMessage(
      chatId,
      '🔍 Анализирую информацию...\n' +
      'Это может занять несколько секунд.'
    );

    // 2. Извлекаем ключевые данные
    const extractedData = await extractData(parsedInput.text);

    if (extractedData.searchQueries.length === 0) {
      await sendMessage(
        chatId,
        '⚠️ Не удалось выделить ключевые данные для поиска.\n' +
        'Попробуйте отправить более информативный текст.'
      );
      return;
    }

    // 3. Ищем источники
    const searchResults = await searchSources(extractedData.searchQueries);

    if (searchResults.length === 0) {
      await sendMessage(
        chatId,
        '😔 К сожалению, не удалось найти возможные источники.\n\n' +
        '<b>Извлечённые данные:</b>\n' +
        `• Утверждения: ${extractedData.claims.length}\n` +
        `• Даты: ${extractedData.dates.join(', ') || 'не найдены'}\n` +
        `• Имена: ${extractedData.names.join(', ') || 'не найдены'}`
      );
      return;
    }

    // 4. Формируем ответ с результатами поиска
    let response = '🔎 <b>Возможные источники:</b>\n\n';
    
    searchResults.slice(0, 5).forEach((result, index) => {
      response += `${index + 1}. <a href="${result.link}">${result.title}</a>\n`;
      if (result.snippet) {
        response += `   ${result.snippet.substring(0, 100)}...\n`;
      }
      if (result.date) {
        response += `   📅 ${result.date}\n`;
      }
      response += '\n';
    });

    // Извлечённые данные
    response += '<b>Извлечённые данные:</b>\n';
    if (extractedData.dates.length > 0) {
      response += `• Даты: ${extractedData.dates.slice(0, 3).join(', ')}\n`;
    }
    if (extractedData.names.length > 0) {
      response += `• Имена: ${extractedData.names.slice(0, 3).join(', ')}\n`;
    }
    if (extractedData.numbers.length > 0) {
      response += `• Числа: ${extractedData.numbers.slice(0, 3).join(', ')}\n`;
    }

    response += '\n💡 <i>Проверьте источники для подтверждения информации.</i>';

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
    message: 'Webhook endpoint is working' 
  });
}
