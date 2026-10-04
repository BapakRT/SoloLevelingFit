import {
  BOXING_IDS,
  BOXING_TITLE_MINUTES,
  CATALOG,
  HISTORY_LIMIT,
  LEVEL_TITLES,
  PENALTY_CLEAR_XP,
  PENALTY_MAX_DAYS,
  PENALTY_XP_FRACTION,
  QUEST_STAT_POINTS,
  STARTING_STAT,
  STAT_XP_PER_POINT,
  STREAK_MILESTONES,
  TOTAL_KEYS,
} from './constants';
import { addDays, dateKey, daysBetween } from './date';
import {
  applyXp,
  jobForLevel,
  penaltyTargets,
  questTargets,
  questXp,
  rankForLevel,
  rollRandomBox,
  streakMultiplier,
  trainingXp,
  xpToNext,
} from './progression';
import type {
  CardioMode,
  DailyQuestState,
  EngineResult,
  GameEvent,
  GameState,
  HistoryEntry,
  PenaltyItemId,
  QuestItemId,
  QuestLevel,
  Rng,
  Settings,
  StatKey,
} from './types';
import { STAT_KEYS } from './types';

const statRecord = (value: number) =>
  Object.fromEntries(STAT_KEYS.map((k) => [k, value])) as Record<StatKey, number>;

export function createInitialState(): GameState {
  return {
    schemaVersion: 3,
    onboarded: false,
    startDate: null,
    player: {
      name: '',
      level: 1,
      xp: 0,
      totalXp: 0,
      statPoints: 0,
      stats: statRecord(STARTING_STAT),
      statXp: statRecord(0),
      streak: 0,
      bestStreak: 0,
      titles: [],
      equippedTitle: null,
    },
    quest: { date: '', targets: [], progress: { pushup: 0, situp: 0, squat: 0, cardio: 0 }, completed: false },
    penalty: null,
    completedDays: [],
    lastEvaluatedDate: null,
    lastArrivalShown: null,
    totals: {},
    history: [],
    settings: {
      questLevel: 'light',
      cardioMode: 'km',
      remindersEnabled: false,
      reminderHour: 7,
      warningHour: 20,
      calendarReminders: false,
    },
  };
}

/** Fills fields added after a save was written (settings are merged one level deep). */
export function withDefaults(data: GameState): GameState {
  const initial = createInitialState();
  return { ...initial, ...data, settings: { ...initial.settings, ...data.settings } };
}

function newQuestDay(date: string, level: number, questLevel: QuestLevel, cardioMode: CardioMode): DailyQuestState {
  return {
    date,
    targets: questTargets(level, questLevel, cardioMode),
    progress: { pushup: 0, situp: 0, squat: 0, cardio: 0 },
    completed: false,
  };
}

// Omit that keeps each variant of the HistoryEntry union intact.
type NewEntry = HistoryEntry extends infer E ? (E extends HistoryEntry ? Omit<E, 'id' | 'at'> : never) : never;

function pushHistory(history: HistoryEntry[], entry: NewEntry, now: Date): HistoryEntry[] {
  const id = `${now.getTime()}-${history.length}-${Math.random().toString(36).slice(2, 7)}`;
  return [{ ...entry, id, at: now.toISOString() }, ...history].slice(0, HISTORY_LIMIT);
}

function addTotal(totals: Record<string, number>, key: string, amount: number): Record<string, number> {
  return { ...totals, [key]: roundAmount((totals[key] ?? 0) + amount) };
}

// Avoids 0.1 + 0.2 style drift when stepping kilometres by 0.5.
function roundAmount(value: number): number {
  return Math.round(value * 100) / 100;
}

function unlockTitle(state: GameState, titleId: string, events: GameEvent[]): GameState {
  if (state.player.titles.includes(titleId)) return state;
  events.push({ type: 'title', titleId });
  const keepEquipped = state.player.equippedTitle && state.player.equippedTitle !== 'player';
  return {
    ...state,
    player: {
      ...state.player,
      titles: [...state.player.titles, titleId],
      equippedTitle: keepEquipped ? state.player.equippedTitle : titleId,
    },
  };
}

function gainXp(state: GameState, amount: number, events: GameEvent[]): GameState {
  if (amount <= 0) return state;
  const before = state.player.level;
  const result = applyXp(before, state.player.xp, amount);
  let next: GameState = {
    ...state,
    player: {
      ...state.player,
      level: result.level,
      xp: result.xp,
      totalXp: state.player.totalXp + amount,
      statPoints: state.player.statPoints + result.statPoints,
    },
  };
  if (result.levelsGained === 0) return next;

  events.push({ type: 'levelUp', from: before, to: result.level, statPoints: result.statPoints });
  if (rankForLevel(result.level) !== rankForLevel(before)) {
    events.push({ type: 'rankUp', rank: rankForLevel(result.level) });
  }
  if (jobForLevel(result.level) !== jobForLevel(before)) {
    events.push({ type: 'jobChange', job: jobForLevel(result.level) });
  }
  for (const [level, titleId] of Object.entries(LEVEL_TITLES)) {
    if (result.level >= Number(level)) next = unlockTitle(next, titleId, events);
  }
  return next;
}

function applyPenalty(state: GameState, missed: number, now: Date, events: GameEvent[]): GameState {
  const { player } = state;
  const severity = Math.min(missed, PENALTY_MAX_DAYS);
  // Never below zero: a penalty costs progress and the streak, never a level.
  const xpLost = Math.min(player.xp, Math.round(xpToNext(player.level) * PENALTY_XP_FRACTION * severity));
  const missedDays = (state.penalty?.missedDays ?? 0) + missed;
  const targets = penaltyTargets(missedDays);

  events.push({ type: 'penalty', missedDays: missed, xpLost, targets });
  return {
    ...state,
    penalty: state.penalty
      ? { ...state.penalty, missedDays, targets }
      : { since: dateKey(now), missedDays, targets, progress: { burpee: 0, plank: 0 } },
    player: { ...player, streak: 0, xp: player.xp - xpLost },
    history: pushHistory(state.history, { kind: 'penalty', days: missed, xp: -xpLost }, now),
  };
}

/**
 * Brings the state up to `now`: settles missed days (penalty), rolls over to a
 * fresh quest at midnight and announces it once. Returns the same state object
 * when nothing changed, so callers can cheaply skip re-renders.
 */
export function evaluateDay(state: GameState, now: Date): EngineResult {
  if (!state.onboarded || !state.startDate) return { state, events: [] };

  const today = dateKey(now);
  const yesterday = addDays(today, -1);
  const events: GameEvent[] = [];
  let s = state;

  // The awakening day itself is a free pass; checking starts the day after.
  const afterStart = addDays(s.startDate!, 1);
  const afterChecked = s.lastEvaluatedDate ? addDays(s.lastEvaluatedDate, 1) : afterStart;
  const firstUnchecked = afterChecked > afterStart ? afterChecked : afterStart;
  if (firstUnchecked <= yesterday) {
    const done = new Set(s.completedDays);
    const missed = daysBetween(firstUnchecked, yesterday).filter((d) => !done.has(d)).length;
    s = { ...s, lastEvaluatedDate: yesterday };
    if (missed > 0) s = applyPenalty(s, missed, now, events);
  }

  if (s.quest.date !== today) {
    s = { ...s, quest: newQuestDay(today, s.player.level, s.settings.questLevel, s.settings.cardioMode) };
  }

  if (s.lastArrivalShown !== today && !s.quest.completed) {
    s = { ...s, lastArrivalShown: today };
    events.push({ type: 'questArrived', targets: s.quest.targets });
  }

  return { state: s, events };
}

export function completeOnboarding(
  state: GameState,
  input: { name: string; questLevel: QuestLevel; cardioMode: CardioMode },
  now: Date
): EngineResult {
  const today = dateKey(now);
  const onboarded: GameState = {
    ...createInitialState(),
    onboarded: true,
    startDate: today,
    settings: { ...state.settings, questLevel: input.questLevel, cardioMode: input.cardioMode },
    player: {
      ...createInitialState().player,
      name: input.name.trim() || 'Player',
      titles: ['player'],
      equippedTitle: 'player',
    },
    quest: newQuestDay(today, 1, input.questLevel, input.cardioMode),
  };
  return evaluateDay(onboarded, now);
}

function completeQuest(state: GameState, now: Date, rng: Rng, events: GameEvent[]): GameState {
  const today = state.quest.date;
  const streak = state.player.streak + 1;
  const multiplier = streakMultiplier(streak);
  const xp = Math.round(questXp(state.player.level) * multiplier);
  const box = rollRandomBox(rng);
  const statPoints = QUEST_STAT_POINTS + (box.statPoint ? 1 : 0);
  const milestone = STREAK_MILESTONES[streak];

  let s: GameState = {
    ...state,
    quest: { ...state.quest, completed: true },
    completedDays: state.completedDays.includes(today) ? state.completedDays : [...state.completedDays, today],
    player: {
      ...state.player,
      streak,
      bestStreak: Math.max(state.player.bestStreak, streak),
      statPoints: state.player.statPoints + statPoints,
    },
    history: pushHistory(state.history, { kind: 'quest', xp: xp + box.xp }, now),
  };
  events.push({ type: 'questComplete', xp, multiplier, streak, statPoints, box });

  let earned = xp + box.xp;
  if (milestone) {
    events.push({ type: 'streakMilestone', days: streak, xp: milestone.xp });
    earned += milestone.xp;
    s = { ...s, history: pushHistory(s.history, { kind: 'streakBonus', days: streak, xp: milestone.xp }, now) };
  }

  s = gainXp(s, earned, events);
  s = unlockTitle(s, 'first_step', events);
  if (milestone) s = unlockTitle(s, milestone.titleId, events);
  if (box.jackpot) s = unlockTitle(s, 'lucky', events);
  return s;
}

export function addQuestProgress(
  state: GameState,
  itemId: QuestItemId,
  delta: number,
  now: Date,
  rng: Rng = Math.random
): EngineResult {
  const evaluated = evaluateDay(state, now);
  const events = [...evaluated.events];
  let s = evaluated.state;
  const target = s.quest.targets.find((t) => t.id === itemId);
  if (s.penalty || !target) return { state: s, events };

  const before = s.quest.progress[itemId];
  const after = Math.max(0, roundAmount(before + delta));
  // Once the quest is claimed, reps can still be added to lifetime totals but never taken back.
  if (after === before || (s.quest.completed && after < before)) return { state: s, events };

  const totalKey =
    itemId === 'cardio' ? (target.unit === 'km' ? TOTAL_KEYS.cardio_km : TOTAL_KEYS.cardio_min) : itemId;
  s = {
    ...s,
    quest: { ...s.quest, progress: { ...s.quest.progress, [itemId]: after } },
    totals: addTotal(s.totals, totalKey, after - before),
  };

  const allMet = s.quest.targets.every((t) => s.quest.progress[t.id] >= t.target);
  if (!s.quest.completed && allMet) s = completeQuest(s, now, rng, events);
  return { state: s, events };
}

export function addPenaltyProgress(
  state: GameState,
  itemId: PenaltyItemId,
  delta: number,
  now: Date
): EngineResult {
  const evaluated = evaluateDay(state, now);
  const events = [...evaluated.events];
  let s = evaluated.state;
  if (!s.penalty) return { state: s, events };

  const before = s.penalty.progress[itemId];
  const after = Math.max(0, roundAmount(before + delta));
  if (after === before) return { state: s, events };

  const penalty = { ...s.penalty, progress: { ...s.penalty.progress, [itemId]: after } };
  s = { ...s, penalty, totals: addTotal(s.totals, TOTAL_KEYS[itemId], after - before) };

  if (penalty.targets.every((t) => penalty.progress[t.id] >= t.target)) {
    events.push({ type: 'penaltyCleared', xp: PENALTY_CLEAR_XP });
    s = {
      ...s,
      penalty: null,
      history: pushHistory(s.history, { kind: 'penaltyCleared', xp: PENALTY_CLEAR_XP }, now),
    };
    s = gainXp(s, PENALTY_CLEAR_XP, events);
    s = unlockTitle(s, 'adversity', events);
  }
  return { state: s, events };
}

export interface TrainingResult extends EngineResult {
  xp: number;
  statGain: number;
}

export function logTraining(state: GameState, exerciseId: string, amount: number, now: Date): TrainingResult {
  const evaluated = evaluateDay(state, now);
  const events = [...evaluated.events];
  let s = evaluated.state;
  const exercise = CATALOG.find((e) => e.id === exerciseId);
  if (s.penalty || !exercise || !(amount > 0)) return { state: s, events, xp: 0, statGain: 0 };

  const xp = trainingXp(amount, exercise.baseXp, exercise.difficulty, s.player.streak);
  const pooled = s.player.statXp[exercise.stat] + xp;
  const statGain = Math.floor(pooled / STAT_XP_PER_POINT);

  s = {
    ...s,
    player: {
      ...s.player,
      stats: { ...s.player.stats, [exercise.stat]: s.player.stats[exercise.stat] + statGain },
      statXp: { ...s.player.statXp, [exercise.stat]: pooled % STAT_XP_PER_POINT },
    },
    totals: addTotal(s.totals, exercise.id, amount),
    history: pushHistory(
      s.history,
      { kind: 'training', exerciseId: exercise.id, amount, unit: exercise.unit, xp },
      now
    ),
  };

  s = gainXp(s, xp, events);
  const boxingMinutes = BOXING_IDS.reduce((sum, id) => sum + (s.totals[id] ?? 0), 0);
  if (boxingMinutes >= BOXING_TITLE_MINUTES) s = unlockTitle(s, 'fighter', events);
  return { state: s, events, xp, statGain };
}

export function allocateStat(state: GameState, stat: StatKey): GameState {
  if (state.player.statPoints <= 0) return state;
  return {
    ...state,
    player: {
      ...state.player,
      statPoints: state.player.statPoints - 1,
      stats: { ...state.player.stats, [stat]: state.player.stats[stat] + 1 },
    },
  };
}

export function equipTitle(state: GameState, titleId: string): GameState {
  if (!state.player.titles.includes(titleId)) return state;
  return { ...state, player: { ...state.player, equippedTitle: titleId } };
}

export function renamePlayer(state: GameState, name: string): GameState {
  const trimmed = name.trim();
  if (!trimmed) return state;
  return { ...state, player: { ...state.player, name: trimmed } };
}

/** Quest difficulty and cardio changes apply from tomorrow's quest: today's goal stays frozen. */
export function updateSettings(state: GameState, patch: Partial<Settings>): GameState {
  return { ...state, settings: { ...state.settings, ...patch } };
}
