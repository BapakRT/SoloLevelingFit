export type StatKey = 'STR' | 'AGI' | 'VIT' | 'INT' | 'SEN';
export type Unit = 'rep' | 'min' | 'km' | 'sec';
export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Elite';
export type QuestLevel = 'light' | 'normal' | 'hard';
export type CardioMode = 'km' | 'min';
export type Rank = 'E' | 'D' | 'C' | 'B' | 'A' | 'S';
export type QuestItemId = 'pushup' | 'situp' | 'squat' | 'cardio';
export type PenaltyItemId = 'burpee' | 'plank';

/** A goal is stored without display text; labels are derived in the UI (see goalLabel). */
export interface QuestTarget<Id extends string = QuestItemId> {
  id: Id;
  unit: Unit;
  target: number;
}

export interface Player {
  name: string;
  level: number;
  /** Progress toward the next level. */
  xp: number;
  totalXp: number;
  /** Unallocated ability points. */
  statPoints: number;
  stats: Record<StatKey, number>;
  /** Training XP accumulated toward the next automatic +1 of each stat. */
  statXp: Record<StatKey, number>;
  streak: number;
  bestStreak: number;
  titles: string[];
  equippedTitle: string | null;
}

export interface DailyQuestState {
  date: string;
  /** Frozen at the start of the day so level-ups or setting changes can't move today's goal. */
  targets: QuestTarget[];
  progress: Record<QuestItemId, number>;
  completed: boolean;
}

export interface PenaltyState {
  since: string;
  missedDays: number;
  targets: QuestTarget<PenaltyItemId>[];
  progress: Record<PenaltyItemId, number>;
}

/** Log entries hold data only; the UI turns them into text. */
export type HistoryEntry = {
  id: string;
  at: string;
  xp: number;
} & (
  | { kind: 'quest' }
  | { kind: 'training'; exerciseId: string; amount: number; unit: Unit }
  | { kind: 'penalty'; days: number }
  | { kind: 'penaltyCleared' }
  | { kind: 'streakBonus'; days: number }
);

export interface Settings {
  questLevel: QuestLevel;
  cardioMode: CardioMode;
  remindersEnabled: boolean;
  /** Morning "quest has arrived" reminder. */
  reminderHour: number;
  /** Evening "finish before midnight" warning. */
  warningHour: number;
  /** Web fallback: the player added the reminder events to their phone's Calendar. */
  calendarReminders: boolean;
}

export interface GameState {
  schemaVersion: 3;
  onboarded: boolean;
  startDate: string | null;
  player: Player;
  quest: DailyQuestState;
  penalty: PenaltyState | null;
  completedDays: string[];
  /** Last day already checked for a missed quest (always a past day). */
  lastEvaluatedDate: string | null;
  lastArrivalShown: string | null;
  /** Lifetime amounts per exercise id, never trimmed. */
  totals: Record<string, number>;
  history: HistoryEntry[];
  settings: Settings;
}

export type GameEvent =
  | { type: 'questArrived'; targets: QuestTarget[] }
  | { type: 'penalty'; missedDays: number; xpLost: number; targets: QuestTarget<PenaltyItemId>[] }
  | { type: 'penaltyCleared'; xp: number }
  | {
      type: 'questComplete';
      xp: number;
      multiplier: number;
      streak: number;
      statPoints: number;
      box: RandomBox;
    }
  | { type: 'streakMilestone'; days: number; xp: number }
  | { type: 'levelUp'; from: number; to: number; statPoints: number }
  | { type: 'rankUp'; rank: Rank }
  | { type: 'jobChange'; job: string }
  | { type: 'title'; titleId: string };

export interface RandomBox {
  xp: number;
  statPoint: boolean;
  jackpot: boolean;
}

export interface EngineResult {
  state: GameState;
  events: GameEvent[];
}

export type Rng = () => number;

export const STAT_KEYS: StatKey[] = ['STR', 'AGI', 'VIT', 'INT', 'SEN'];
