import type { GameState } from '@/engine/types';
import { isInstalledWebApp, isIosWeb } from './platform';
import { PUSH_API, VAPID_PUBLIC_KEY } from './pushConfig';

// Web build: reminders are Web Push notifications sent by the push worker
// (push-worker/). The app registers this device once and then keeps the
// worker told about quest progress so it can skip warnings once the quest is done.
// The native build uses local notifications instead (reminders.native.ts).

export type ReminderSupport = 'native' | 'push' | 'install-first' | 'unsupported';

function pushAvailable(): boolean {
  return (
    PUSH_API !== '' &&
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** iPhone only exposes Web Push to apps opened from the home screen, not Safari tabs. */
export function reminderSupport(): ReminderSupport {
  if (PUSH_API === '') return 'unsupported';
  if (pushAvailable()) return 'push';
  if (isIosWeb() && !isInstalledWebApp()) return 'install-first';
  return 'unsupported';
}

function clientState(game: GameState) {
  return {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    morningHour: game.settings.reminderHour,
    warningHour: game.settings.warningHour,
    questDate: game.quest.date || null,
    questDone: game.quest.completed,
    penalty: !!game.penalty,
  };
}

function api(path: string, body: unknown): Promise<Response> {
  return fetch(`${PUSH_API}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushAvailable()) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  return registration ? registration.pushManager.getSubscription() : null;
}

export async function enableReminders(game: GameState): Promise<'on' | 'denied' | 'error'> {
  if (!pushAvailable()) return 'error';
  // Must be the first await: iOS only shows the permission prompt while the tap is still "fresh".
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY),
      }));
    const res = await api('/subscribe', { subscription: subscription.toJSON(), ...clientState(game) });
    return res.ok ? 'on' : 'error';
  } catch {
    return 'error';
  }
}

export async function disableReminders(): Promise<void> {
  const subscription = await currentSubscription();
  if (!subscription) return;
  await api('/unsubscribe', { endpoint: subscription.endpoint }).catch(() => {});
  await subscription.unsubscribe();
}

/** Keeps the worker up to date; re-registers if the worker no longer knows this device. */
export async function syncReminders(game: GameState): Promise<void> {
  if (!game.onboarded || !game.settings.remindersEnabled) return;
  const subscription = await currentSubscription();
  if (!subscription) return;
  const res = await api('/status', { endpoint: subscription.endpoint, ...clientState(game) });
  if (res.status === 404) await api('/subscribe', { subscription: subscription.toJSON(), ...clientState(game) });
}

export async function sendTestReminder(): Promise<boolean> {
  const subscription = await currentSubscription();
  if (!subscription) return false;
  const res = await api('/test', { endpoint: subscription.endpoint });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean };
  return data.ok === true;
}
