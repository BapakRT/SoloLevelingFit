import { buildPushPayload } from '@block65/webcrypto-web-push';
import {
  dueSlot,
  noticeFor,
  parseClientState,
  type Notice,
  type PushSubscriptionJson,
  type Subscriber,
} from './schedule';

export interface Env {
  SUBS: KVNamespace;
  VAPID_PUBLIC_KEY: string;
  VAPID_PRIVATE_KEY: string;
  VAPID_SUBJECT: string;
  /** Comma-separated origins allowed to call this API (the web app). */
  ALLOWED_ORIGINS: string;
}

// Subscribers are keyed by a hash of their push endpoint: stable per device,
// and the raw endpoint never appears in a key listing.
async function keyFor(endpoint: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('origin') ?? '';
  const allowed = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
  return allowed.includes(origin)
    ? {
        'access-control-allow-origin': origin,
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'content-type',
        'access-control-max-age': '86400',
        vary: 'origin',
      }
    : { vary: 'origin' };
}

function json(data: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...headers, 'content-type': 'application/json' } });
}

function isSubscription(value: unknown): value is PushSubscriptionJson {
  const sub = value as PushSubscriptionJson | undefined;
  return (
    typeof sub?.endpoint === 'string' &&
    sub.endpoint.startsWith('https://') &&
    typeof sub.keys?.p256dh === 'string' &&
    typeof sub.keys?.auth === 'string'
  );
}

/** Sends one notification; returns the push service's HTTP status. */
async function sendPush(env: Env, sub: Subscriber, notice: Notice): Promise<number> {
  const init = await buildPushPayload(
    {
      data: { title: notice.title, body: notice.body, tag: notice.tag, url: '/' },
      options: { ttl: notice.ttl, urgency: 'high', topic: notice.tag },
    },
    { ...sub.subscription, expirationTime: sub.subscription.expirationTime ?? null },
    { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY }
  );
  const res = await fetch(sub.subscription.endpoint, init);
  return res.status;
}

// 404/410 mean the device unsubscribed or the app was removed: forget it.
const isGone = (status: number) => status === 404 || status === 410;

async function handle(request: Request, env: Env): Promise<Response> {
  const cors = corsHeaders(request, env);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  const { pathname } = new URL(request.url);
  if (request.method === 'GET' && pathname === '/') return new Response('SYSTEM push: online', { headers: cors });
  if (request.method !== 'POST') return json({ error: 'not found' }, 404, cors);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: 'invalid json' }, 400, cors);
  }

  if (pathname === '/subscribe') {
    const state = parseClientState(body);
    if (!isSubscription(body.subscription) || !state) return json({ error: 'invalid subscription' }, 400, cors);
    const key = await keyFor(body.subscription.endpoint);
    const existing = await env.SUBS.get<Subscriber>(key, 'json');
    const sub: Subscriber = {
      ...state,
      subscription: body.subscription,
      sent: existing?.sent ?? {},
      updatedAt: new Date().toISOString(),
    };
    await env.SUBS.put(key, JSON.stringify(sub));
    return json({ ok: true }, 200, cors);
  }

  const endpoint = typeof body.endpoint === 'string' ? body.endpoint : null;
  if (!endpoint) return json({ error: 'missing endpoint' }, 400, cors);
  const key = await keyFor(endpoint);

  if (pathname === '/unsubscribe') {
    await env.SUBS.delete(key);
    return json({ ok: true }, 200, cors);
  }

  const existing = await env.SUBS.get<Subscriber>(key, 'json');
  // The app re-subscribes when it gets this, e.g. after the device rotated its endpoint.
  if (!existing) return json({ error: 'unknown subscription' }, 404, cors);

  if (pathname === '/status') {
    const state = parseClientState(body);
    if (!state) return json({ error: 'invalid state' }, 400, cors);
    const changed = (Object.keys(state) as (keyof typeof state)[]).some((k) => state[k] !== existing[k]);
    // KV writes are the scarce free-tier resource: only write real changes.
    if (changed) await env.SUBS.put(key, JSON.stringify({ ...existing, ...state, updatedAt: new Date().toISOString() }));
    return json({ ok: true, changed }, 200, cors);
  }

  if (pathname === '/test') {
    const pad = (n: number) => String(n).padStart(2, '0');
    const status = await sendPush(env, existing, {
      title: '[SYSTEM]',
      body: `Notifications are on. Reminders arrive at ${pad(existing.morningHour)}:00 and ${pad(existing.warningHour)}:00.`,
      tag: 'test',
      ttl: 600,
    });
    if (isGone(status)) await env.SUBS.delete(key);
    return json({ ok: status < 300, status }, 200, cors);
  }

  return json({ error: 'not found' }, 404, cors);
}

/** Runs every hour: sends whichever reminder is due in each subscriber's own time zone. */
async function remind(now: Date, env: Env): Promise<{ sent: number; removed: number }> {
  let sent = 0;
  let removed = 0;
  let cursor: string | undefined;
  do {
    const page = await env.SUBS.list({ cursor });
    for (const { name } of page.keys) {
      const sub = await env.SUBS.get<Subscriber>(name, 'json');
      const due = sub && dueSlot(sub, now);
      if (!sub || !due) continue;

      const status = await sendPush(env, sub, noticeFor(due.slot, sub));
      if (isGone(status)) {
        await env.SUBS.delete(name);
        removed++;
      } else if (status < 300) {
        await env.SUBS.put(name, JSON.stringify({ ...sub, sent: { ...sub.sent, [due.slot]: due.date } }));
        sent++;
      } else {
        console.error(`push ${due.slot} failed with ${status}`);
      }
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return { sent, removed };
}

export default {
  fetch: handle,
  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    const result = await remind(new Date(controller.scheduledTime), env);
    console.log(`reminders sent=${result.sent} removed=${result.removed}`);
  },
} satisfies ExportedHandler<Env>;

export { remind };
