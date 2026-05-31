import { envString } from '../config/env';

/**
 * True if the given Telegram ID is listed in ADMIN_TELEGRAM_IDS
 * (comma-separated). Single source of truth for admin checks.
 */
export function isAdminTelegramId(telegramId: bigint | number | string): boolean {
  const ids = envString('ADMIN_TELEGRAM_IDS', '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.includes(String(telegramId));
}
