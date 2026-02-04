import { NextRequest, NextResponse } from 'next/server';
import {
  validateTelegramWebAppInitData,
  getTelegramUserIdFromInitData,
} from '@/lib/telegramWebApp';
import { runAnalysis } from '@/lib/analysisPipeline';

/** Лимит времени выполнения (сек). Совпадает с webhook для длинного анализа. */
export const maxDuration = 60;

/**
 * POST /api/tma/analyze
 * API для Telegram Mini App: анализ текста с проверкой initData.
 *
 * Body: { text: string, initData: string }
 * - text — текст для проверки на первоисточник
 * - initData — initData из Telegram.WebApp.initData (обязателен для авторизации)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const text =
      typeof body?.text === 'string' ? body.text.trim() : '';
    const initData =
      typeof body?.initData === 'string' ? body.initData : '';

    if (!initData) {
      return NextResponse.json(
        { success: false, error: 'Требуется initData от Telegram Mini App.', errorCode: 'unauthorized' as const },
        { status: 401 }
      );
    }

    if (!validateTelegramWebAppInitData(initData)) {
      return NextResponse.json(
        { success: false, error: 'Неверная подпись initData.', errorCode: 'unauthorized' as const },
        { status: 401 }
      );
    }

    const userId = getTelegramUserIdFromInitData(initData);
    if (userId != null) {
      console.log('[TMA analyze] Запрос от user_id:', userId);
    }

    if (!text) {
      return NextResponse.json(
        {
          success: false,
          error: 'Отправьте текст для проверки (минимум 20 символов).',
          errorCode: 'text_too_short' as const,
        },
        { status: 400 }
      );
    }

    const result = await runAnalysis(text);

    if (!result.success) {
      return NextResponse.json(result, { status: 200 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[TMA analyze] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Произошла ошибка при анализе. Попробуйте позже.',
        errorCode: 'internal' as const,
      },
      { status: 500 }
    );
  }
}
