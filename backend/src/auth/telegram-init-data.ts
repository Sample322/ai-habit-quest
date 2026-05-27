import { createHmac } from 'node:crypto';

export interface TelegramInitDataUser {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface ParsedInitData {
  user: TelegramInitDataUser;
  authDate: Date;
  startParam?: string;
  queryId?: string;
  raw: Record<string, string>;
}

const MAX_INIT_DATA_AGE_SECONDS = 24 * 60 * 60; // 24h

/**
 * Verify a Telegram WebApp `initData` string and return the parsed payload.
 * Implements https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function verifyAndParseInitData(initData: string, botToken: string, now: Date = new Date()): ParsedInitData {
  if (!initData) throw new Error('Empty initData');
  if (!botToken) throw new Error('Missing bot token for initData verification');

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) throw new Error('initData missing hash');

  const pairs: string[] = [];
  const raw: Record<string, string> = {};
  for (const [k, v] of params.entries()) {
    if (k === 'hash') continue;
    pairs.push(`${k}=${v}`);
    raw[k] = v;
  }
  pairs.sort();
  const dataCheckString = pairs.join('\n');

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computed = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (!timingSafeEqualHex(computed, hash)) {
    throw new Error('initData hash mismatch');
  }

  const authDateStr = raw['auth_date'];
  if (!authDateStr) throw new Error('initData missing auth_date');
  const authEpoch = Number(authDateStr);
  if (!Number.isFinite(authEpoch)) throw new Error('initData auth_date invalid');
  const ageSec = Math.floor(now.getTime() / 1000) - authEpoch;
  if (ageSec > MAX_INIT_DATA_AGE_SECONDS) throw new Error('initData expired');
  if (ageSec < -300) throw new Error('initData in the future');

  const userJson = raw['user'];
  if (!userJson) throw new Error('initData missing user');
  const user = JSON.parse(userJson) as TelegramInitDataUser;
  if (typeof user.id !== 'number') throw new Error('initData user.id missing');

  return {
    user,
    authDate: new Date(authEpoch * 1000),
    startParam: raw['start_param'],
    queryId: raw['query_id'],
    raw,
  };
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
