import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyTelegramInitData } from '../auth/telegram.js';
import { signSessionToken, verifySessionToken } from '../auth/jwt.js';

function buildSignedInitData(botToken: string, authDateSec: number, userObj: object): string {
  const params = new URLSearchParams({
    auth_date: String(authDateSec),
    query_id: 'AAHdF6IQAAAAAN0XohDhrOrc',
    user: JSON.stringify(userObj),
    start_param: 'ROOM42'
  });

  const entries: string[] = [];
  for (const [k, v] of params.entries()) {
    entries.push(`${k}=${v}`);
  }
  entries.sort((a, b) => a.localeCompare(b));
  const dataCheckString = entries.join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  params.set('hash', hash);
  return params.toString();
}

test('verifyTelegramInitData validates authentic Telegram payload', () => {
  const token = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
  const now = Math.floor(Date.now() / 1000);
  const initData = buildSignedInitData(token, now, {
    id: 777888999,
    first_name: 'Alex',
    last_name: 'Sonic',
    username: 'alex_sonic'
  });

  const verified = verifyTelegramInitData(initData, token);
  assert.equal(verified.user.id, 777888999);
  assert.equal(verified.user.username, 'alex_sonic');
  assert.equal(verified.startParam, 'ROOM42');
});

test('verifyTelegramInitData rejects tampered hash and expired data', () => {
  const token = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
  const now = Math.floor(Date.now() / 1000);
  const valid = buildSignedInitData(token, now, { id: 42, first_name: 'Test' });
  const tampered = valid.replace('Test', 'Hacker');

  assert.throws(() => verifyTelegramInitData(tampered, token), /signature mismatch/i);

  const expired = buildSignedInitData(token, now - 200000, { id: 42, first_name: 'Test' });
  assert.throws(() => verifyTelegramInitData(expired, token), /expired/i);
});

test('JWT session token roundtrip and tamper rejection', () => {
  const token = signSessionToken({ sub: 'uuid-123', tgId: '100001', role: 'admin' }, 3600, 'test-secret');
  const claims = verifySessionToken(token, 'test-secret');
  assert.equal(claims.sub, 'uuid-123');
  assert.equal(claims.role, 'admin');

  assert.throws(() => verifySessionToken(token + 'x', 'test-secret'), /Invalid token signature/);
});

