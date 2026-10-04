import { withDefaults } from './game';
import type { CardioMode, GameState, HistoryEntry, QuestLevel, QuestTarget, Unit } from './types';

// Save format history:
//   v2 — first release, Indonesian identifiers (units "menit"/"detik", quest
//        level "ringan"/"berat") and display labels stored inside the save.
//   v3 — English identifiers, no display text in the save.

const UNIT_V2: Record<string, Unit> = { rep: 'rep', km: 'km', menit: 'min', detik: 'sec' };
const QUEST_LEVEL_V2: Record<string, QuestLevel> = { ringan: 'light', normal: 'normal', berat: 'hard' };
const CARDIO_V2: Record<string, CardioMode> = { km: 'km', menit: 'min' };
const TOTAL_KEY_V2: Record<string, string> = { cardio_menit: 'cardio_min', penalty_plank_detik: 'penalty_plank_sec' };

// v2 logged training under the exercise's display name rather than its id.
const EXERCISE_ID_BY_V2_NAME: Record<string, string> = {
  'Pull-up': 'pullup',
  Dip: 'dip',
  Lunge: 'lunge',
  Crunch: 'crunch',
  'Leg raise': 'leg_raise',
  Plank: 'plank',
  'Mountain climber': 'mountain_climber',
  Burpee: 'burpee',
  'Jumping jack': 'jumping_jack',
  Skipping: 'jump_rope',
  Bersepeda: 'cycling',
  'Lari tambahan': 'extra_run',
  Shadowboxing: 'shadowboxing',
  'Heavy bag': 'heavy_bag',
  'Speed bag': 'speed_bag',
  Sparring: 'sparring',
  Stretching: 'stretching',
  Meditasi: 'meditation',
};

interface V2Goal {
  id: string;
  unit: string;
  target: number;
}

interface V2HistoryEntry {
  id: string;
  at: string;
  kind: string;
  label?: string;
  amount?: number;
  unit?: string;
  xp: number;
}

function goalFromV2<Id extends string>(goal: V2Goal): QuestTarget<Id> {
  return { id: goal.id as Id, unit: UNIT_V2[goal.unit] ?? 'rep', target: goal.target };
}

function historyFromV2(entry: V2HistoryEntry): HistoryEntry | null {
  const base = { id: entry.id, at: entry.at, xp: entry.xp };
  const label = entry.label ?? '';
  const days = Number(/(\d+)/.exec(label)?.[1] ?? 1);
  switch (entry.kind) {
    case 'quest':
      return { ...base, kind: 'quest' };
    case 'bonus':
      return { ...base, kind: 'streakBonus', days };
    case 'penalty':
      // "Gagal Quest Harian (N hari)" = penalty applied; "Misi Hukuman selesai" = penalty cleared.
      return label.startsWith('Gagal') ? { ...base, kind: 'penalty', days } : { ...base, kind: 'penaltyCleared' };
    case 'training': {
      const exerciseId = EXERCISE_ID_BY_V2_NAME[label];
      if (!exerciseId) return null;
      return { ...base, kind: 'training', exerciseId, amount: entry.amount ?? 0, unit: UNIT_V2[entry.unit ?? ''] ?? 'rep' };
    }
    default:
      return null;
  }
}

function fromV2(data: any): GameState {
  return {
    ...data,
    schemaVersion: 3,
    quest: { ...data.quest, targets: (data.quest.targets ?? []).map(goalFromV2) },
    penalty: data.penalty ? { ...data.penalty, targets: data.penalty.targets.map(goalFromV2) } : null,
    totals: Object.fromEntries(
      Object.entries((data.totals ?? {}) as Record<string, number>).map(([key, value]) => [TOTAL_KEY_V2[key] ?? key, value])
    ),
    history: ((data.history ?? []) as V2HistoryEntry[])
      .map(historyFromV2)
      .filter((entry): entry is HistoryEntry => entry !== null),
    settings: {
      ...data.settings,
      questLevel: QUEST_LEVEL_V2[data.settings.questLevel] ?? 'light',
      cardioMode: CARDIO_V2[data.settings.cardioMode] ?? 'km',
    },
  };
}

/** Upgrades any known save version to the current one; null for anything unrecognisable. */
export function migrateSave(raw: unknown): GameState | null {
  const data = raw as any;
  const looksLikeSave =
    data &&
    typeof data === 'object' &&
    typeof data.onboarded === 'boolean' &&
    data.player &&
    typeof data.player.level === 'number' &&
    data.quest &&
    Array.isArray(data.completedDays) &&
    data.settings;
  if (!looksLikeSave) return null;
  if (data.schemaVersion === 2) return withDefaults(fromV2(data));
  if (data.schemaVersion === 3) return withDefaults(data);
  return null;
}

export function parseBackup(json: string): GameState | null {
  try {
    return migrateSave(JSON.parse(json));
  } catch {
    return null;
  }
}
