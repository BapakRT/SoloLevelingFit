import {
  DIFFICULTY_MULTIPLIER,
  JOBS,
  LEVELS_PER_TIER,
  QUEST_BASE,
  QUEST_CAP,
  QUEST_STEP,
  RANKS,
  LEVEL_UP_STAT_POINTS,
} from './constants';
import type {
  CardioMode,
  Difficulty,
  PenaltyItemId,
  QuestLevel,
  QuestTarget,
  Rank,
  RandomBox,
  Rng,
} from './types';

/** XP needed to go from `level` to `level + 1`. */
export function xpToNext(level: number): number {
  return 100 + 40 * (level - 1);
}

/** Base Daily Quest reward, before the streak multiplier. Grows with level so quests stay worth it. */
export function questXp(level: number): number {
  return 80 + 5 * level;
}

// +3% per streak day, capped at double XP from day 34 onward.
export function streakMultiplier(streak: number): number {
  return 1 + Math.min(streak * 0.03, 1);
}

export function rankForLevel(level: number): Rank {
  return (RANKS.find((r) => level >= r.minLevel) ?? RANKS[RANKS.length - 1]).rank;
}

export function jobForLevel(level: number): string {
  return (JOBS.find((j) => level >= j.minLevel) ?? JOBS[JOBS.length - 1]).job;
}

export function questTier(level: number): number {
  return Math.floor((level - 1) / LEVELS_PER_TIER) + 1;
}

export function nextTierLevel(level: number): number {
  return questTier(level) * LEVELS_PER_TIER + 1;
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export function questTargets(level: number, questLevel: QuestLevel, cardioMode: CardioMode): QuestTarget[] {
  const base = QUEST_BASE[questLevel];
  const tiers = questTier(level) - 1;
  const grow = (key: keyof typeof base) => Math.min(QUEST_CAP[key], base[key] + QUEST_STEP[key] * tiers);

  return [
    { id: 'pushup', unit: 'rep', target: grow('pushup') },
    { id: 'situp', unit: 'rep', target: grow('situp') },
    { id: 'squat', unit: 'rep', target: grow('squat') },
    cardioMode === 'km'
      ? { id: 'cardio', unit: 'km', target: roundTo(grow('km'), 0.5) }
      : { id: 'cardio', unit: 'min', target: grow('min') },
  ];
}

// Short and doable on purpose: the sting is losing the streak and XP, not an impossible workout.
export function penaltyTargets(missedDays: number): QuestTarget<PenaltyItemId>[] {
  const severity = Math.min(Math.max(missedDays, 1), 3);
  return [
    { id: 'burpee', unit: 'rep', target: 5 + 5 * severity },
    { id: 'plank', unit: 'sec', target: 30 + 30 * severity },
  ];
}

export function trainingXp(amount: number, baseXp: number, difficulty: Difficulty, streak: number): number {
  const raw = amount * baseXp * DIFFICULTY_MULTIPLIER[difficulty] * streakMultiplier(streak);
  return Math.max(1, Math.round(raw));
}

export interface XpApplication {
  level: number;
  xp: number;
  levelsGained: number;
  statPoints: number;
}

/** Rolls earned XP into as many level-ups as it covers. */
export function applyXp(level: number, xp: number, gained: number): XpApplication {
  let newLevel = level;
  let progress = xp + gained;
  while (progress >= xpToNext(newLevel)) {
    progress -= xpToNext(newLevel);
    newLevel += 1;
  }
  const levelsGained = newLevel - level;
  return { level: newLevel, xp: progress, levelsGained, statPoints: levelsGained * LEVEL_UP_STAT_POINTS };
}

// The "Random Box" reward from completing the Daily Quest, as in the manhwa.
export function rollRandomBox(rng: Rng): RandomBox {
  const roll = rng();
  const between = (min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
  if (roll < 0.01) return { xp: 500, statPoint: true, jackpot: true };
  if (roll < 0.1) return { xp: 50, statPoint: true, jackpot: false };
  if (roll < 0.4) return { xp: between(60, 120), statPoint: false, jackpot: false };
  return { xp: between(20, 50), statPoint: false, jackpot: false };
}
