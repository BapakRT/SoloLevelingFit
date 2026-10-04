import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { addDays, dateKey, parseKey } from '@/engine/date';
import type { GameState } from '@/engine/types';

import type { ReminderSupport } from './reminders';

const CHANNEL_ID = 'daily-quest';
const DAYS_AHEAD = 7;

// Native build: local notifications scheduled on the device, no server needed.
export function reminderSupport(): ReminderSupport {
  return 'native';
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Daily Quest',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#4FC3FF',
  });
}

export async function enableReminders(_game: GameState): Promise<'on' | 'denied' | 'error'> {
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return 'on';
  return (await Notifications.requestPermissionsAsync()).granted ? 'on' : 'denied';
}

export async function disableReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function sendTestReminder(): Promise<boolean> {
  await ensureChannel();
  await Notifications.scheduleNotificationAsync({
    content: { title: '[SYSTEM]', body: 'Notifications are on. Your Daily Quest reminders are set.' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3, channelId: CHANNEL_ID },
  });
  return true;
}

function schedule(date: Date, title: string, body: string) {
  return Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: CHANNEL_ID },
  });
}

/**
 * Rebuilds the next week of one-off reminders. One-off (not repeating) so that
 * today's warning can be dropped the moment the quest is finished.
 */
export async function syncReminders(game: GameState): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!game.onboarded || !game.settings.remindersEnabled) return;
  if (!(await Notifications.getPermissionsAsync()).granted) return;
  await ensureChannel();

  const now = new Date();
  const today = dateKey(now);
  const doneToday = game.quest.date === today && game.quest.completed;

  for (let i = 0; i < DAYS_AHEAD; i++) {
    if (i === 0 && doneToday) continue;
    const day = parseKey(addDays(today, i));
    const morning = new Date(day);
    morning.setHours(game.settings.reminderHour, 0, 0, 0);
    const evening = new Date(day);
    evening.setHours(game.settings.warningHour, 0, 0, 0);

    if (morning > now) {
      await schedule(morning, '[DAILY QUEST HAS ARRIVED]', 'Preparations to Become Powerful. Complete it before midnight.');
    }
    if (evening > now) {
      await schedule(evening, '[WARNING]', 'Daily Quest incomplete. The penalty comes at midnight.');
    }
  }
}
