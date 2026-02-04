import { NextRequest, NextResponse } from 'next/server';
import { TelegramUpdate } from '@/types';
import {
  sendMessage,
  sendTypingAction,
  extractMessageData,
  isCommand,
  extractCommand,
} from '@/lib/telegram';
import { runAnalysis } from '@/lib/analysisPipeline';
import type { AIAnalysisResult } from '@/types';

/** Лимит времени выполнения (сек). На Vercel Hobby макс 10, на Pro — до 300. Telegram ждёт ответ webhook до 60 сек. */
export const maxDuration = 60;

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
              '📝 Отправь мне текст для проверки или открой мини-приложение кнопкой внизу.'
          );
          return NextResponse.json({ ok: true });
        }

        case 'help':
          await sendMessage(
            chatId,
            '📖 <b>Как пользоваться ботом:</b>\n\n' +
              '1️⃣ Отправьте текст для проверки\n' +
              '2️⃣ AI сгенерирует поисковые запросы\n' +
              '3️⃣ Поиск в интернете\n' +
              '4️⃣ AI проанализирует источники\n\n' +
              '<b>Команды:</b>\n' +
              '/start - Начать\n' +
              '/help - Справка'
          );
          return NextResponse.json({ ok: true });

        default:
          await sendMessage(chatId, '❓ Неизвестная команда. Используйте /help');
          return NextResponse.json({ ok: true });
      }
    }

    await sendTypingAction(chatId);

    await processMessage(chatId, text);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ ok: true });
  }
}

/** Форматирует результат анализа в HTML для отправки в чат */
function formatAnalysisMessage(analysis: AIAnalysisResult): string {
  const emoji = analysis.confidence >= 70 ? '🟢' : analysis.confidence >= 40 ? '🟡' : '🔴';
  let response = `🔎 <b>Результаты анализа:</b>\n\n`;
  response += `${emoji} <b>Уверенность: ${analysis.confidence}%</b>\n`;
  response += `💬 ${analysis.explanation}\n\n`;
  response += `<b>Источники:</b>\n\n`;
  analysis.sources.slice(0, 3).forEach((source, index) => {
    const icon = source.isLikelyOriginal ? '⭐' : source.relevance >= 60 ? '📄' : '📝';
    response += `${index + 1}. ${icon} <a href="${source.url}">${source.title.substring(0, 50)}</a>\n`;
    response += `   Релевантность: ${source.relevance}%`;
    if (source.reason) response += ` - ${source.reason}`;
    response += '\n\n';
  });
  response += '💡 <i>Проверьте источники для подтверждения информации.</i>';
  return response;
}

async function processMessage(chatId: number, text: string): Promise<void> {
  try {
    await sendMessage(
      chatId,
      '🔍 Анализирую текст с помощью AI...\nЭто может занять несколько секунд.'
    );

    const result = await runAnalysis(text);

    if (!result.success) {
      const msg =
        result.errorCode === 'search_limit'
          ? '⚠️ <b>Лимит поиска исчерпан!</b>\n\n🔒 Бесплатный API: 250 запросов в месяц. Запросы в этом месяце закончились.\n\n💡 Лимит обновится в начале следующего месяца.'
          : result.errorCode === 'no_sources'
            ? '😔 К сожалению, не удалось найти возможные источники.\n\n💡 Проверьте настройки поиска на сервере (SERPAPI_KEY / Google).'
            : `⚠️ ${result.error}`;
      await sendMessage(chatId, msg);
      return;
    }

    console.log('[Webhook] Поисковые запросы:', result.searchQueries);
    console.log('[Webhook] Найдено результатов:', result.searchResults.length);

    await sendMessage(chatId, formatAnalysisMessage(result.analysis), {
      disableWebPagePreview: true,
    });
  } catch (error) {
    console.error('Error in processMessage:', error);
    await sendMessage(
      chatId,
      '❌ Произошла ошибка при обработке.\nПожалуйста, попробуйте позже.'
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    bot: 'FindOrigin',
    version: '2.0 AI',
    message: 'Webhook endpoint is working',
  });
}
