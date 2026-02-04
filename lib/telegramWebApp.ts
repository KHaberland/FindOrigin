import crypto from 'crypto';

/**
 * Получает токен бота (для валидации initData)
 */
function getBotToken(): string {
  const token =
    process.env.TELEGRAM_BOT_TOKEN?.trim() || process.env.BOT_TOKEN?.trim();
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN или BOT_TOKEN не установлен');
  }
  return token;
}

/**
 * Валидирует initData от Telegram Mini App.
 * @see https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function validateTelegramWebAppInitData(initData: string): boolean {
  if (!initData || typeof initData !== 'string') {
    return false;
  }

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) {
    return false;
  }

  params.delete('hash');
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const token = getBotToken();
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(token)
    .digest();
  const computedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  return computedHash === hash;
}

/**
 * Извлекает user (Telegram id) из initData без проверки подписи.
 * Использовать только после validateTelegramWebAppInitData.
 */
export function getTelegramUserIdFromInitData(initData: string): number | null {
  try {
    const params = new URLSearchParams(initData);
    const userStr = params.get('user');
    if (!userStr) return null;
    const user = JSON.parse(userStr);
    return typeof user?.id === 'number' ? user.id : null;
  } catch {
    return null;
  }
}
