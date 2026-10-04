// Run with: npm run check
import assert from 'node:assert/strict';
import { createECDH, randomBytes } from 'node:crypto';
import ece from 'http_ece';
import worker, { remind, type Env } from '../src/index';
import { dueSlot, parseClientState, type Subscriber } from '../src/schedule';

let passed = 0;
async function check(name: string, fn: () => Promise<void> | void) {
  await fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

// ---- Test doubles ------------------------------------------------------------

class MemoryKV {
  map = new Map<string, string>();
  async get(key: string, type?: string) {
    const value = this.map.get(key);
    if (value === undefined) return null;
    return type === 'json' ? JSON.parse(value) : value;
  }
  async put(key: string, value: string) {
    this.map.set(key, value);
  }
  async delete(key: string) {
    this.map.delete(key);
  }
  async list() {
    return { keys: [...this.map.keys()].map((name) => ({ name })), list_complete: true, cursor: '' };
  }
}

const b64url = (buf: Uint8Array) => Buffer.from(buf).toString('base64url');

// A fake browser: a real P-256 key pair + auth secret, exactly like PushManager.subscribe() makes.
const device = createECDH('prime256v1');
device.generateKeys();
const deviceAuth = randomBytes(16);
const subscription = {
  endpoint: 'https://web.push.apple.com/QTEST-device-token',
  expirationTime: null,
  keys: { p256dh: b64url(device.getPublicKey()), auth: b64url(deviceAuth) },
};

async function vapidKeys() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  return { publicKey: b64url(raw), privateKey: jwk.d!, raw };
}

const ORIGIN = 'https://bapakrt-system.expo.app';
const vapid = await vapidKeys();
const kv = new MemoryKV();
const env = {
  SUBS: kv as unknown as KVNamespace,
  VAPID_PUBLIC_KEY: vapid.publicKey,
  VAPID_PRIVATE_KEY: vapid.privateKey,
  VAPID_SUBJECT: ORIGIN,
  ALLOWED_ORIGINS: `${ORIGIN},http://localhost:8091`,
} satisfies Env;

// Captures what would go to Apple's push service and answers with `pushStatus`.
const sent: { url: string; init: RequestInit }[] = [];
let pushStatus = 201;
globalThis.fetch = (async (url: string, init: RequestInit) => {
  sent.push({ url, init });
  return new Response(null, { status: pushStatus });
}) as typeof fetch;

function post(path: string, body: unknown, origin = ORIGIN) {
  return worker.fetch(
    new Request(`https://system-push.test${path}`, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    env
  );
}

function decrypt(init: RequestInit) {
  const plain = ece.decrypt(Buffer.from(init.body as Uint8Array), {
    version: 'aes128gcm',
    privateKey: device,
    authSecret: deviceAuth,
  });
  return JSON.parse(plain.toString('utf8'));
}

const state = { timeZone: 'Asia/Jakarta', morningHour: 7, warningHour: 20, questDate: '2026-09-30', questDone: false, penalty: false };
// WIB is UTC+7: 00:00Z = 07:00, 13:00Z = 20:00, 16:00Z = 23:00 on 1 Oct.
const wib = (hour: number) => new Date(Date.UTC(2026, 9, 1, hour - 7));

// ---- Pure scheduling ---------------------------------------------------------

await check('due slots follow the local time zone and fire once a day', () => {
  const sub: Subscriber = { ...state, subscription, sent: {}, updatedAt: '' };
  assert.deepEqual(dueSlot(sub, wib(7)), { slot: 'morning', date: '2026-10-01' });
  assert.deepEqual(dueSlot(sub, wib(20)), { slot: 'evening', date: '2026-10-01' });
  assert.deepEqual(dueSlot(sub, wib(23)), { slot: 'lastCall', date: '2026-10-01' });
  assert.equal(dueSlot(sub, wib(12)), null);
  assert.equal(dueSlot({ ...sub, sent: { morning: '2026-10-01' } }, wib(7)), null);
  assert.equal(dueSlot({ ...sub, questDate: '2026-10-01', questDone: true }, wib(20)), null);
  // Yesterday's finished quest doesn't silence today's reminders.
  assert.equal(dueSlot({ ...sub, questDate: '2026-09-30', questDone: true }, wib(20))?.slot, 'evening');
  // A 23:00 evening hour means no separate last call.
  assert.equal(dueSlot({ ...sub, warningHour: 23 }, wib(23))?.slot, 'evening');
});

await check('client state is validated', () => {
  assert.equal(parseClientState({ ...state, morningHour: 24 }), null);
  assert.equal(parseClientState({ ...state, questDate: 'yesterday' }), null);
  assert.equal(parseClientState({ ...state, timeZone: 'Mars/Olympus' })?.timeZone, 'Asia/Jakarta');
});

// ---- HTTP API + cron, end to end ------------------------------------------------

await check('CORS only for the app origin', async () => {
  const pre = (origin: string) =>
    worker.fetch(new Request('https://system-push.test/subscribe', { method: 'OPTIONS', headers: { origin } }), env);
  assert.equal((await pre(ORIGIN)).headers.get('access-control-allow-origin'), ORIGIN);
  assert.equal((await pre('https://evil.example')).headers.get('access-control-allow-origin'), null);
});

await check('rejects junk and unknown devices', async () => {
  assert.equal((await post('/subscribe', { ...state, subscription: { endpoint: 'http://x' } })).status, 400);
  assert.equal((await post('/status', { ...state, endpoint: 'https://nobody' })).status, 404);
});

await check('subscribe stores the device', async () => {
  const res = await post('/subscribe', { ...state, subscription });
  assert.equal(res.status, 200);
  assert.equal(kv.map.size, 1);
});

await check('07:00 WIB sends the morning quest notice, encrypted per RFC 8291', async () => {
  const result = await remind(wib(7), env);
  assert.equal(result.sent, 1);
  const { url, init } = sent.at(-1)!;
  assert.equal(url, subscription.endpoint);
  const headers = init.headers as Record<string, string>;
  assert.equal(headers['content-encoding'], 'aes128gcm');
  assert.equal(headers.topic, 'morning');
  assert.deepEqual(decrypt(init), {
    title: '[DAILY QUEST HAS ARRIVED]',
    body: 'Preparations to Become Powerful. Complete it before midnight, Player.',
    tag: 'morning',
    url: '/',
  });
});

await check('VAPID token is a valid ES256 JWT for the push origin', async () => {
  const auth = (sent.at(-1)!.init.headers as Record<string, string>).authorization;
  const match = /^vapid t=([^,]+), k=(.+)$/.exec(auth);
  assert.ok(match, auth);
  const [header, payload, signature] = match[1].split('.');
  const key = await crypto.subtle.importKey('raw', vapid.raw, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    Buffer.from(signature, 'base64url'),
    new TextEncoder().encode(`${header}.${payload}`)
  );
  assert.ok(valid, 'signature verifies');
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
  assert.equal(claims.aud, 'https://web.push.apple.com');
  assert.equal(claims.sub, ORIGIN);
  assert.equal(match[2], vapid.publicKey);
});

await check('the same hour never sends twice', async () => {
  assert.equal((await remind(wib(7), env)).sent, 0);
});

await check('finishing the quest silences the evening warning', async () => {
  const res = await post('/status', { ...state, endpoint: subscription.endpoint, questDate: '2026-10-01', questDone: true });
  assert.deepEqual(await res.json(), { ok: true, changed: true });
  assert.equal((await remind(wib(20), env)).sent, 0);
  assert.equal((await remind(wib(23), env)).sent, 0);
});

await check('unfinished quest gets the evening and 23:00 warnings', async () => {
  await post('/status', { ...state, endpoint: subscription.endpoint, questDate: '2026-10-01', questDone: false });
  assert.equal((await remind(wib(20), env)).sent, 1);
  assert.equal(decrypt(sent.at(-1)!.init).title, '[WARNING]');
  assert.equal((await remind(wib(23), env)).sent, 1);
  assert.equal(decrypt(sent.at(-1)!.init).title, '[FINAL WARNING]');
});

await check('unchanged status does not spend a KV write', async () => {
  const res = await post('/status', { ...state, endpoint: subscription.endpoint, questDate: '2026-10-01', questDone: false });
  assert.deepEqual(await res.json(), { ok: true, changed: false });
});

await check('test button sends immediately', async () => {
  const res = await post('/test', { endpoint: subscription.endpoint });
  assert.deepEqual(await res.json(), { ok: true, status: 201 });
  assert.equal(decrypt(sent.at(-1)!.init).title, '[SYSTEM]');
});

await check('a device that uninstalled (410) is forgotten', async () => {
  pushStatus = 410;
  const result = await remind(new Date(Date.UTC(2026, 9, 2, 0)), env); // 07:00 WIB next day
  assert.equal(result.removed, 1);
  assert.equal(kv.map.size, 0);
  pushStatus = 201;
});

console.log(`\n${passed} checks passed`);
