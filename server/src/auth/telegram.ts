import crypto from 'node:crypto';

export interface TelegramWebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
}

export interface VerifiedTelegramData {
  user: TelegramWebAppUser;
  authDate: number;
  startParam?: string;
}

export function verifyTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 86400
): VerifiedTelegramData {
  if (!initData || typeof initData !== 'string') {
    throw new Error('Missing Telegram initData');
  }
  if (!botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN is not configured on the server');
  }

  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash');
  if (!receivedHash || !/^[a-f0-9]{64}$/i.test(receivedHash)) {
    throw new Error('Invalid Telegram initData hash');
  }

  const entries: string[] = [];
  for (const [key, value] of params.entries()) {
    if (key !== 'hash') {
      entries.push(`${key}=${value}`);
    }
  }
  entries.sort((a, b) => a.localeCompare(b));
  const dataCheckString = entries.join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const a = Buffer.from(computedHash, 'hex');
  const b = Buffer.from(receivedHash.toLowerCase(), 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error('Telegram signature mismatch');
  }

  const authDate = Number(params.get('auth_date') || '0');
  const nowSec = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(authDate) || authDate <= 0 || nowSec - authDate > maxAgeSeconds) {
    throw new Error('Telegram initData has expired');
  }

  const userRaw = params.get('user');
  if (!userRaw) {
    throw new Error('Telegram user payload missing');
  }

  const parsedUser = JSON.parse(userRaw) as TelegramWebAppUser;
  if (!parsedUser || !parsedUser.id || !parsedUser.first_name) {
    throw new Error('Invalid Telegram user fields');
  }

  return {
    user: parsedUser,
    authDate,
    startParam: params.get('start_param') || undefined
  };
}

