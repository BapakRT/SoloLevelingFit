import type { CardioMode, Difficulty, QuestItemId, PenaltyItemId, QuestLevel, Rank, StatKey, Unit } from './types';

// ---- Daily Quest -----------------------------------------------------------

type QuestNumbers = { pushup: number; situp: number; squat: number; km: number; min: number };

// Starts deliberately small: the point is to never skip a day, not to max out.
export const QUEST_BASE: Record<QuestLevel, QuestNumbers> = {
  light: { pushup: 5, situp: 10, squat: 10, km: 1, min: 5 },
  normal: { pushup: 20, situp: 20, squat: 20, km: 2, min: 10 },
  hard: { pushup: 50, situp: 50, squat: 50, km: 4, min: 20 },
};

/** Added to every goal once per quest tier (a new tier every 5 levels). */
export const QUEST_STEP: QuestNumbers = { pushup: 5, situp: 5, squat: 5, km: 0.5, min: 3 };

/** The original manhwa quest: 100 / 100 / 100 / 10 km. */
export const QUEST_CAP: QuestNumbers = { pushup: 100, situp: 100, squat: 100, km: 10, min: 60 };

export const LEVELS_PER_TIER = 5;

export const QUEST_LEVEL_LABEL: Record<QuestLevel, string> = {
  light: 'Light',
  normal: 'Normal',
  hard: 'Hard',
};

const GOAL_LABEL: Record<QuestItemId | PenaltyItemId, string> = {
  pushup: 'Push-ups',
  situp: 'Sit-ups',
  squat: 'Squats',
  cardio: 'Run',
  burpee: 'Burpees',
  plank: 'Plank',
};

const CARDIO_LABEL: Record<CardioMode, string> = {
  km: 'Run',
  min: 'Cardio (run in place / jump rope)',
};

export function goalLabel(goal: { id: QuestItemId | PenaltyItemId; unit: Unit }): string {
  if (goal.id === 'cardio') return CARDIO_LABEL[goal.unit === 'km' ? 'km' : 'min'];
  return GOAL_LABEL[goal.id];
}

// ---- Rewards ---------------------------------------------------------------

export const QUEST_STAT_POINTS = 3;
export const LEVEL_UP_STAT_POINTS = 5;
export const PENALTY_CLEAR_XP = 30;
/** Fraction of the current level's requirement lost per missed day. */
export const PENALTY_XP_FRACTION = 0.15;
/** Missed days beyond this stop making the penalty harsher. */
export const PENALTY_MAX_DAYS = 3;
/** Training XP poured into a stat before it grows by 1. */
export const STAT_XP_PER_POINT = 40;
export const HISTORY_LIMIT = 300;

export const STREAK_MILESTONES: Record<number, { xp: number; titleId: string }> = {
  3: { xp: 50, titleId: 'streak_3' },
  7: { xp: 150, titleId: 'streak_7' },
  14: { xp: 300, titleId: 'streak_14' },
  30: { xp: 700, titleId: 'streak_30' },
  60: { xp: 1500, titleId: 'streak_60' },
  100: { xp: 3000, titleId: 'streak_100' },
};

export const LEVEL_TITLES: Record<number, string> = {
  10: 'wolf_slayer',
  25: 'demon_hunter',
  50: 'shadow_monarch',
};

// ---- Ranks & jobs ----------------------------------------------------------

export const RANKS: { rank: Rank; minLevel: number }[] = [
  { rank: 'S', minLevel: 60 },
  { rank: 'A', minLevel: 45 },
  { rank: 'B', minLevel: 30 },
  { rank: 'C', minLevel: 20 },
  { rank: 'D', minLevel: 10 },
  { rank: 'E', minLevel: 1 },
];

export const JOBS: { job: string; minLevel: number }[] = [
  { job: 'Shadow Monarch', minLevel: 80 },
  { job: 'Necromancer', minLevel: 40 },
  { job: 'None', minLevel: 1 },
];

// ---- Titles ----------------------------------------------------------------

export const TITLES: Record<string, { name: string; desc: string }> = {
  player: { name: 'Player', desc: 'Chosen by the System.' },
  first_step: { name: 'First Step', desc: 'Complete your first Daily Quest.' },
  streak_3: { name: 'Getting Consistent', desc: 'Reach a 3-day streak.' },
  streak_7: { name: 'Relentless', desc: 'Reach a 7-day streak.' },
  streak_14: { name: 'Iron Discipline', desc: 'Reach a 14-day streak.' },
  streak_30: { name: 'True Hunter', desc: 'Reach a 30-day streak.' },
  streak_60: { name: 'Unshakable Will', desc: 'Reach a 60-day streak.' },
  streak_100: { name: 'Monarch of Discipline', desc: 'Reach a 100-day streak.' },
  adversity: { name: 'One Who Overcame Adversity', desc: 'Survive a Penalty Quest.' },
  wolf_slayer: { name: 'Wolf Slayer', desc: 'Reach Level 10.' },
  demon_hunter: { name: 'Demon Hunter', desc: 'Reach Level 25.' },
  shadow_monarch: { name: 'Shadow Monarch', desc: 'Reach Level 50.' },
  fighter: { name: 'Fighter', desc: 'Log 60 minutes of boxing in total.' },
  lucky: { name: 'Lucky', desc: 'Hit the Random Box jackpot.' },
};

export const TITLE_ORDER = Object.keys(TITLES);

// ---- Stats -----------------------------------------------------------------

export const STAT_INFO: Record<StatKey, { name: string; desc: string }> = {
  STR: { name: 'Strength', desc: 'Push-ups, pull-ups, heavy bag' },
  AGI: { name: 'Agility', desc: 'Running, burpees, shadowboxing' },
  VIT: { name: 'Vitality', desc: 'Core, plank, endurance' },
  INT: { name: 'Intelligence', desc: 'Stretching, meditation' },
  SEN: { name: 'Sense', desc: 'Speed bag, sparring' },
};

export const STARTING_STAT = 10;

// ---- Extra training catalog -------------------------------------------------

export const DIFFICULTY_MULTIPLIER: Record<Difficulty, number> = {
  Easy: 1,
  Medium: 1.5,
  Hard: 2,
  Elite: 3,
};

export interface Exercise {
  id: string;
  name: string;
  category: 'Strength' | 'Core' | 'Cardio' | 'Boxing' | 'Recovery';
  stat: StatKey;
  unit: Unit;
  baseXp: number;
  difficulty: Difficulty;
}

// The four Daily Quest movements are not here: they are logged on the quest screen.
export const CATALOG: Exercise[] = [
  { id: 'pullup', name: 'Pull-ups', category: 'Strength', stat: 'STR', unit: 'rep', baseXp: 3, difficulty: 'Hard' },
  { id: 'dip', name: 'Dips', category: 'Strength', stat: 'STR', unit: 'rep', baseXp: 2, difficulty: 'Medium' },
  { id: 'lunge', name: 'Lunges', category: 'Strength', stat: 'STR', unit: 'rep', baseXp: 1, difficulty: 'Easy' },
  { id: 'crunch', name: 'Crunches', category: 'Core', stat: 'VIT', unit: 'rep', baseXp: 1, difficulty: 'Easy' },
  { id: 'leg_raise', name: 'Leg raises', category: 'Core', stat: 'VIT', unit: 'rep', baseXp: 1.5, difficulty: 'Medium' },
  { id: 'plank', name: 'Plank', category: 'Core', stat: 'VIT', unit: 'min', baseXp: 3, difficulty: 'Medium' },
  { id: 'mountain_climber', name: 'Mountain climbers', category: 'Core', stat: 'AGI', unit: 'rep', baseXp: 0.8, difficulty: 'Medium' },
  { id: 'burpee', name: 'Burpees', category: 'Cardio', stat: 'AGI', unit: 'rep', baseXp: 2.5, difficulty: 'Hard' },
  { id: 'jumping_jack', name: 'Jumping jacks', category: 'Cardio', stat: 'AGI', unit: 'rep', baseXp: 0.4, difficulty: 'Easy' },
  { id: 'jump_rope', name: 'Jump rope', category: 'Cardio', stat: 'AGI', unit: 'min', baseXp: 3, difficulty: 'Medium' },
  { id: 'cycling', name: 'Cycling', category: 'Cardio', stat: 'AGI', unit: 'km', baseXp: 5, difficulty: 'Easy' },
  { id: 'extra_run', name: 'Extra run', category: 'Cardio', stat: 'AGI', unit: 'km', baseXp: 15, difficulty: 'Medium' },
  { id: 'shadowboxing', name: 'Shadowboxing', category: 'Boxing', stat: 'AGI', unit: 'min', baseXp: 3, difficulty: 'Medium' },
  { id: 'heavy_bag', name: 'Heavy bag', category: 'Boxing', stat: 'STR', unit: 'min', baseXp: 4, difficulty: 'Hard' },
  { id: 'speed_bag', name: 'Speed bag', category: 'Boxing', stat: 'SEN', unit: 'min', baseXp: 3, difficulty: 'Medium' },
  { id: 'sparring', name: 'Sparring', category: 'Boxing', stat: 'SEN', unit: 'min', baseXp: 6, difficulty: 'Elite' },
  { id: 'stretching', name: 'Stretching', category: 'Recovery', stat: 'INT', unit: 'min', baseXp: 1.5, difficulty: 'Easy' },
  { id: 'meditation', name: 'Meditation', category: 'Recovery', stat: 'INT', unit: 'min', baseXp: 1, difficulty: 'Easy' },
];

export const BOXING_IDS = CATALOG.filter((e) => e.category === 'Boxing').map((e) => e.id);
export const BOXING_TITLE_MINUTES = 60;

/** Lifetime-total keys for the quest and penalty movements. */
export const TOTAL_KEYS = {
  pushup: 'pushup',
  situp: 'situp',
  squat: 'squat',
  cardio_km: 'run_km',
  cardio_min: 'cardio_min',
  burpee: 'penalty_burpee',
  plank: 'penalty_plank_sec',
} as const;

export const TOTAL_LABELS: Record<string, { label: string; unit: Unit }> = {
  pushup: { label: 'Push-ups', unit: 'rep' },
  situp: { label: 'Sit-ups', unit: 'rep' },
  squat: { label: 'Squats', unit: 'rep' },
  run_km: { label: 'Running', unit: 'km' },
  cardio_min: { label: 'Cardio', unit: 'min' },
  penalty_burpee: { label: 'Burpees (penalty)', unit: 'rep' },
  penalty_plank_sec: { label: 'Plank (penalty)', unit: 'sec' },
  ...Object.fromEntries(CATALOG.map((e) => [e.id, { label: e.name, unit: e.unit }])),
};
