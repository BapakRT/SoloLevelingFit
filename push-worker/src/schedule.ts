export type Slot = 'morning' | 'evening' | 'lastCall';

export interface PushSubscriptionJson {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
}

/** What the app last reported about the player. */
export interface ClientState {
  timeZone: string;
  morningHour: number;
  warningHour: number;
  /** The app's local day for the quest below. */
  questDate: string | null;
  questDone: boolean;
  penalty: boolean;
}

export interface Subscriber extends ClientState {
  subscription: PushSubscriptionJson;
  /** Local day each slot was last sent, so a slot fires at most once a day. */
  sent: Partial<Record<Slot, string>>;
  updatedAt: string;
}

/** Final warning before midnight, on top of the player's own evening hour. */
export const LAST_CALL_HOUR = 23;
export const DEFAULT_TIME_ZONE = 'Asia/Jakarta';

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function localTime(now: Date, timeZone: string): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) };
}

/** The reminder due for this subscriber in the hour containing `now`, if any. */
export function dueSlot(sub: Subscriber, now: Date): { slot: Slot; date: string } | null {
  const { date, hour } = localTime(now, sub.timeZone);
  const doneToday = sub.questDone && sub.questDate === date;
  if (doneToday) return null;

  let slot: Slot | null = null;
  if (hour === sub.morningHour) slot = 'morning';
  else if (hour === sub.warningHour) slot = 'evening';
  else if (hour === LAST_CALL_HOUR) slot = 'lastCall';

  if (!slot || sub.sent[slot] === date) return null;
  return { slot, date };
}

export interface Notice {
  title: string;
  body: string;
  tag: string;
  /** Seconds the push service may hold it; a late "last call" after midnight is useless. */
  ttl: number;
}

export function noticeFor(slot: Slot, sub: Subscriber): Notice {
  switch (slot) {
    case 'morning':
      return sub.penalty
        ? {
            title: '[PENALTY ZONE]',
            body: 'Your Penalty Quest is unfinished. Survive first, then the Daily Quest awaits.',
            tag: slot,
            ttl: 3 * 3600,
          }
        : {
            title: '[DAILY QUEST HAS ARRIVED]',
            body: 'Preparations to Become Powerful. Complete it before midnight, Player.',
            tag: slot,
            ttl: 3 * 3600,
          };
    case 'evening':
      return {
        title: '[WARNING]',
        body: 'Daily Quest incomplete. Failure means the Penalty Zone at midnight.',
        tag: slot,
        ttl: 2 * 3600,
      };
    case 'lastCall':
      return {
        title: '[FINAL WARNING]',
        body: 'One hour left. Complete the quest now or accept the penalty.',
        tag: slot,
        ttl: 50 * 60,
      };
  }
}

const isHour = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 23;

/** Validates the state fields sent by the app; unknown time zones fall back to WIB. */
export function parseClientState(body: Record<string, unknown>): ClientState | null {
  const { timeZone, morningHour, warningHour, questDate, questDone, penalty } = body;
  if (!isHour(morningHour) || !isHour(warningHour)) return null;
  if (questDate !== null && !(typeof questDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(questDate))) return null;
  return {
    timeZone: typeof timeZone === 'string' && isValidTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE,
    morningHour,
    warningHour,
    questDate,
    questDone: questDone === true,
    penalty: penalty === true,
  };
}
