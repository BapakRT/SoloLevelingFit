// Run with: npx tsx scripts/engine-check.ts
import assert from 'node:assert/strict';
import {
  addPenaltyProgress,
  addQuestProgress,
  allocateStat,
  completeOnboarding,
  createInitialState,
  evaluateDay,
  logTraining,
  updateSettings,
} from '../src/engine/game';
import { parseBackup } from '../src/engine/migrate';
import { questTargets, xpToNext, streakMultiplier } from '../src/engine/progression';
import type { GameState, QuestItemId } from '../src/engine/types';
import { buildReminderCalendar, reminderCalendarPath } from '../src/lib/calendar';

const at = (day: number, hour = 10) => new Date(2026, 0, day, hour, 0, 0);
const fixedRng = () => 0.5;
let passed = 0;

function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

function finishQuest(state: GameState, now: Date) {
  let s = state;
  const events = [];
  for (const t of s.quest.targets) {
    const r = addQuestProgress(s, t.id as QuestItemId, t.target, now, fixedRng);
    s = r.state;
    events.push(...r.events);
  }
  return { state: s, events };
}

const onboard = (day = 1) =>
  completeOnboarding(createInitialState(), { name: '  Jin-Woo ', questLevel: 'light', cardioMode: 'km' }, at(day));

check('onboarding announces the first quest with tiny targets', () => {
  const { state, events } = onboard();
  assert.equal(state.player.name, 'Jin-Woo');
  assert.equal(state.startDate, '2026-01-01');
  assert.deepEqual(events.map((e) => e.type), ['questArrived']);
  assert.deepEqual(state.quest.targets.map((t) => t.target), [5, 10, 10, 1]);
});

check('re-evaluating the same day is a no-op returning the same object', () => {
  const { state } = onboard();
  const again = evaluateDay(state, at(1, 18));
  assert.equal(again.state, state);
  assert.equal(again.events.length, 0);
});

check('completing every goal claims the quest, streak and rewards', () => {
  const { state, events } = finishQuest(onboard().state, at(1));
  const types = events.map((e) => e.type);
  assert.ok(types.includes('questComplete'));
  assert.ok(types.includes('levelUp'));
  assert.equal(state.player.streak, 1);
  assert.deepEqual(state.completedDays, ['2026-01-01']);
  // 85 base * 1.03 streak = 88, plus a 35 XP box with the fixed rng = 123 -> level 2 with 23 left over.
  assert.equal(state.player.level, 2);
  assert.equal(state.player.xp, 23);
  assert.equal(state.player.statPoints, 3 + 5);
  assert.ok(state.player.titles.includes('first_step'));
});

check('partial progress is not enough', () => {
  const { state } = addQuestProgress(onboard().state, 'pushup', 5, at(1), fixedRng);
  assert.equal(state.quest.completed, false);
  assert.equal(state.player.streak, 0);
});

check('no decrement after the quest is claimed', () => {
  const done = finishQuest(onboard().state, at(1)).state;
  const after = addQuestProgress(done, 'pushup', -5, at(1), fixedRng).state;
  assert.equal(after.quest.progress.pushup, done.quest.progress.pushup);
});

check('the awakening day is a free pass', () => {
  const { state, events } = evaluateDay(onboard().state, at(2));
  assert.equal(state.penalty, null);
  assert.deepEqual(events.map((e) => e.type), ['questArrived']);
  assert.equal(state.quest.date, '2026-01-02');
});

check('completing yesterday keeps the streak and rolls a new quest', () => {
  const day1 = finishQuest(onboard().state, at(1)).state;
  const { state, events } = evaluateDay(day1, at(2));
  assert.equal(state.penalty, null);
  assert.equal(state.player.streak, 1);
  assert.equal(state.quest.completed, false);
  assert.deepEqual(events.map((e) => e.type), ['questArrived']);
});

check('a missed day triggers the Penalty Zone', () => {
  const day1 = finishQuest(onboard().state, at(1)).state; // level 2, 23 xp
  const { state, events } = evaluateDay(day1, at(3)); // day 2 missed
  assert.equal(events[0].type, 'penalty');
  assert.equal(state.player.streak, 0);
  const expectedLoss = Math.min(23, Math.round(xpToNext(2) * 0.15));
  assert.equal(state.player.xp, 23 - expectedLoss);
  assert.equal(state.player.level, 2, 'a penalty never removes a level');
  assert.deepEqual(state.penalty?.targets.map((t) => t.target), [10, 60]);
  assert.equal(state.lastEvaluatedDate, '2026-01-02');
});

check('penalty is applied once, not on every re-open', () => {
  const day1 = finishQuest(onboard().state, at(1)).state;
  const penalized = evaluateDay(day1, at(3)).state;
  const reopened = evaluateDay(penalized, at(3, 20));
  assert.equal(reopened.state, penalized);
});

check('the Daily Quest and training are locked during a penalty', () => {
  const day1 = finishQuest(onboard().state, at(1)).state;
  const penalized = evaluateDay(day1, at(3)).state;
  assert.equal(addQuestProgress(penalized, 'pushup', 5, at(3)).state, penalized);
  assert.equal(logTraining(penalized, 'crunch', 10, at(3)).xp, 0);
});

check('clearing the penalty quest unlocks the day and a title', () => {
  const day1 = finishQuest(onboard().state, at(1)).state;
  let s = evaluateDay(day1, at(3)).state;
  s = addPenaltyProgress(s, 'burpee', 10, at(3)).state;
  const { state, events } = addPenaltyProgress(s, 'plank', 60, at(3));
  assert.equal(state.penalty, null);
  assert.ok(events.some((e) => e.type === 'penaltyCleared'));
  assert.ok(state.player.titles.includes('adversity'));
  const resumed = addQuestProgress(state, 'pushup', 1, at(3)).state;
  assert.equal(resumed.quest.progress.pushup, 1);
});

check('several missed days stack onto an unfinished penalty (capped severity)', () => {
  const day1 = finishQuest(onboard().state, at(1)).state;
  const first = evaluateDay(day1, at(3)).state; // missed day 2
  const second = evaluateDay(first, at(7)); // missed 3,4,5,6
  assert.equal(second.state.penalty?.missedDays, 5);
  assert.deepEqual(second.state.penalty?.targets.map((t) => t.target), [20, 120]);
  assert.equal(second.events.filter((e) => e.type === 'penalty').length, 1);
});

check('streak milestone at 3 days pays a bonus and a title', () => {
  let s = onboard().state;
  for (const day of [1, 2, 3]) {
    s = evaluateDay(s, at(day)).state;
    const r = finishQuest(s, at(day));
    s = r.state;
    if (day === 3) assert.ok(r.events.some((e) => e.type === 'streakMilestone'));
  }
  assert.equal(s.player.streak, 3);
  assert.ok(s.player.titles.includes('streak_3'));
});

check('quest goals grow every 5 levels and cap at the manhwa quest', () => {
  assert.deepEqual(questTargets(6, 'light', 'km').map((t) => t.target), [10, 15, 15, 1.5]);
  assert.deepEqual(questTargets(200, 'hard', 'km').map((t) => t.target), [100, 100, 100, 10]);
  assert.equal(questTargets(1, 'light', 'min')[3].unit, 'min');
});

check('settings changes wait for tomorrow', () => {
  const s = updateSettings(onboard().state, { questLevel: 'hard' });
  assert.equal(s.quest.targets[0].target, 5);
  const tomorrow = evaluateDay(s, at(2)).state;
  assert.equal(tomorrow.quest.targets[0].target, 50);
});

check('training pays difficulty x streak XP and grows the trained stat', () => {
  const { state, xp } = logTraining(onboard().state, 'shadowboxing', 10, at(1));
  assert.equal(xp, Math.round(10 * 3 * 1.5 * streakMultiplier(0)));
  assert.equal(state.player.stats.AGI, 10 + Math.floor(xp / 40));
  assert.equal(state.totals.shadowboxing, 10);
});

check('big XP rolls multiple levels, rank, job and level titles', () => {
  const { state, events } = logTraining(onboard().state, 'sparring', 20000, at(1));
  assert.ok(state.player.level >= 40);
  assert.ok(events.some((e) => e.type === 'rankUp'));
  assert.ok(events.some((e) => e.type === 'jobChange'));
  assert.ok(state.player.titles.includes('wolf_slayer'));
  assert.ok(state.player.titles.includes('fighter'));
});

check('stat points are spent one at a time', () => {
  const done = finishQuest(onboard().state, at(1)).state;
  const s = allocateStat(done, 'STR');
  assert.equal(s.player.stats.STR, 11);
  assert.equal(s.player.statPoints, done.player.statPoints - 1);
  assert.equal(allocateStat({ ...s, player: { ...s.player, statPoints: 0 } }, 'STR').player.stats.STR, 11);
});

check('backup round-trips and rejects junk', () => {
  const s = finishQuest(onboard().state, at(1)).state;
  assert.deepEqual(parseBackup(JSON.stringify(s)), s);
  assert.equal(parseBackup('{"hello":1}'), null);
  assert.equal(parseBackup('not json'), null);
});

check('saves from before a new setting existed get its default', () => {
  const s = finishQuest(onboard().state, at(1)).state;
  const old = { ...s, settings: { ...s.settings, warningHour: undefined } };
  assert.equal(parseBackup(JSON.stringify(old))?.settings.warningHour, 20);
});

check('reminder calendar is valid iCalendar with two daily alarms', () => {
  const ics = buildReminderCalendar(7, 20);
  const lines = ics.split('\r\n');
  assert.ok(ics.endsWith('\r\n'));
  assert.ok(!ics.replace(/\r\n/g, '').includes('\n'), 'only CRLF line breaks');
  assert.ok(lines.every((l) => l.length <= 75), 'lines folded at 75 octets');
  assert.equal(lines.filter((l) => l === 'RRULE:FREQ=DAILY').length, 2);
  assert.equal(lines.filter((l) => l === 'BEGIN:VALARM').length, 2);
  assert.ok(lines.includes('DTSTART:20260101T070000'));
  assert.ok(lines.includes('DTSTART:20260101T200000'));
  assert.equal(reminderCalendarPath(7, 20), '/reminders/morning-07-evening-20.ics');
});

check('a v2 (Indonesian) save is migrated without losing progress', () => {
  const v2 = {
    schemaVersion: 2,
    onboarded: true,
    startDate: '2026-09-29',
    player: { ...createInitialState().player, name: 'Ryan', level: 3, xp: 40, streak: 2, titles: ['player', 'first_step'], equippedTitle: 'first_step' },
    quest: {
      date: '2026-10-01',
      targets: [
        { id: 'pushup', label: 'Push-up', unit: 'rep', target: 5 },
        { id: 'cardio', label: 'Kardio (lari di tempat / skipping)', unit: 'menit', target: 5 },
      ],
      progress: { pushup: 5, situp: 0, squat: 0, cardio: 2 },
      completed: false,
    },
    penalty: {
      since: '2026-10-01',
      missedDays: 1,
      targets: [
        { id: 'burpee', label: 'Burpee', unit: 'rep', target: 10 },
        { id: 'plank', label: 'Plank', unit: 'detik', target: 60 },
      ],
      progress: { burpee: 0, plank: 30 },
    },
    completedDays: ['2026-09-29', '2026-09-30'],
    lastEvaluatedDate: '2026-09-30',
    lastArrivalShown: '2026-10-01',
    totals: { pushup: 25, cardio_menit: 12, penalty_plank_detik: 30, shadowboxing: 10 },
    history: [
      { id: 'a', at: '2026-10-01T03:00:00Z', kind: 'penalty', label: 'Gagal Quest Harian (2 hari)', xp: -21 },
      { id: 'b', at: '2026-09-30T12:00:00Z', kind: 'training', label: 'Bersepeda', amount: 3, unit: 'km', xp: 15 },
      { id: 'c', at: '2026-09-30T11:00:00Z', kind: 'training', label: 'Plank', amount: 2, unit: 'menit', xp: 9 },
      { id: 'd', at: '2026-09-30T10:00:00Z', kind: 'quest', label: 'Quest Harian selesai', xp: 120 },
      { id: 'e', at: '2026-09-30T10:00:01Z', kind: 'bonus', label: 'Streak 3 hari', xp: 50 },
      { id: 'f', at: '2026-09-29T10:00:00Z', kind: 'penalty', label: 'Misi Hukuman selesai', xp: 30 },
    ],
    settings: { questLevel: 'berat', cardioMode: 'menit', remindersEnabled: true, reminderHour: 6, warningHour: 21, calendarReminders: false },
  };
  const s = parseBackup(JSON.stringify(v2));
  assert.ok(s, 'v2 save is accepted');
  assert.equal(s.schemaVersion, 3);
  assert.equal(s.player.level, 3);
  assert.equal(s.player.xp, 40);
  assert.deepEqual(s.completedDays, ['2026-09-29', '2026-09-30']);
  assert.deepEqual(s.settings, { ...v2.settings, questLevel: 'hard', cardioMode: 'min' });
  assert.deepEqual(s.quest.targets, [
    { id: 'pushup', unit: 'rep', target: 5 },
    { id: 'cardio', unit: 'min', target: 5 },
  ]);
  assert.deepEqual(s.quest.progress, v2.quest.progress);
  assert.deepEqual(s.penalty?.targets, [
    { id: 'burpee', unit: 'rep', target: 10 },
    { id: 'plank', unit: 'sec', target: 60 },
  ]);
  assert.deepEqual(s.totals, { pushup: 25, cardio_min: 12, penalty_plank_sec: 30, shadowboxing: 10 });
  assert.deepEqual(
    s.history.map(({ id, at, ...rest }) => rest),
    [
      { kind: 'penalty', days: 2, xp: -21 },
      { kind: 'training', exerciseId: 'cycling', amount: 3, unit: 'km', xp: 15 },
      { kind: 'training', exerciseId: 'plank', amount: 2, unit: 'min', xp: 9 },
      { kind: 'quest', xp: 120 },
      { kind: 'streakBonus', days: 3, xp: 50 },
      { kind: 'penaltyCleared', xp: 30 },
    ]
  );
  // The migrated save keeps playing normally.
  const next = evaluateDay(s, new Date(2026, 9, 1, 12));
  assert.equal(next.state.penalty?.missedDays, 1);
  assert.equal(addPenaltyProgress(next.state, 'plank', 30, new Date(2026, 9, 1, 12)).state.penalty?.progress.plank, 60);
});

check('unknown save versions are rejected', () => {
  const s = onboard().state;
  assert.equal(parseBackup(JSON.stringify({ ...s, schemaVersion: 99 })), null);
});

console.log(`\n${passed} checks passed`);
