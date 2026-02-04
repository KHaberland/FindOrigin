import { NextRequest, NextResponse } from 'next/server';
import { setChatMenuButton } from '@/lib/telegram';

const DEFAULT_APP_URL = 'https://find-origin-plum.vercel.app';
const TMA_PATH = '/tma';

/**
 * GET /api/tma/setup-menu-button
 * Устанавливает у бота кнопку меню (Menu Button) с ссылкой на Mini App.
 *
 * URL приложения берётся из APP_URL или VERCEL_URL, по умолчанию find-origin-plum.vercel.app.
 * Опционально: ?secret=XXX — если задан SETUP_SECRET в env, запрос должен содержать тот же secret.
 */
export async function GET(request: NextRequest) {
  const setupSecret = process.env.SETUP_SECRET?.trim();
  if (setupSecret) {
    const provided = request.nextUrl.searchParams.get('secret');
    if (provided !== setupSecret) {
      return NextResponse.json({ ok: false, error: 'Invalid secret' }, { status: 401 });
    }
  }

  const baseUrl =
    process.env.APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    DEFAULT_APP_URL;
  const tmaUrl = baseUrl.replace(/\/$/, '') + TMA_PATH;

  const result = await setChatMenuButton(tmaUrl);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, tmaUrl },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, tmaUrl });
}
