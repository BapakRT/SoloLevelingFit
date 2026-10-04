import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { QUEST_STAT_POINTS } from '@/engine/constants';
import { msUntilMidnight } from '@/engine/date';
import { nextTierLevel, questTier, questXp, streakMultiplier } from '@/engine/progression';
import type { PenaltyItemId, QuestItemId } from '@/engine/types';
import { isInstalledWebApp, isIosWeb } from '@/lib/platform';
import { useGame } from '@/store/useGame';
import { Counter } from '@/ui/Counter';
import { Chip, Panel, Row, Screen, SysButton, Txt } from '@/ui/kit';
import { C, alpha } from '@/ui/theme';
import { useNow } from '@/ui/useNow';

const URGENT_MS = 3 * 60 * 60 * 1000;

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

// Only this ticks every second, so the rest of the screen isn't re-rendered each tick.
function Countdown({ completed }: { completed: boolean }) {
  const remaining = msUntilMidnight(useNow());
  const urgent = !completed && remaining < URGENT_MS;
  return (
    <View style={styles.timer}>
      <Txt variant="label" color={C.dim}>
        {completed ? 'Next quest in' : 'Time left'}
      </Txt>
      <Txt variant="h1" color={urgent ? C.red : C.blue} glowing>
        {formatCountdown(remaining)}
      </Txt>
    </View>
  );
}

export default function QuestScreen() {
  const router = useRouter();
  const game = useGame((s) => s.game);
  const addQuest = useGame((s) => s.addQuest);
  const addPenalty = useGame((s) => s.addPenalty);

  const { quest, penalty, player, settings } = game;
  const showInstallTip = isIosWeb() && !isInstalledWebApp();
  const showReminderTip = !showInstallTip && !settings.remindersEnabled && !settings.calendarReminders;
  const nextMultiplier = streakMultiplier(player.streak + 1);
  const reward = Math.round(questXp(player.level) * nextMultiplier);
  const doneCount = quest.targets.filter((t) => quest.progress[t.id] >= t.target).length;

  return (
    <Screen tone={penalty ? 'red' : 'blue'}>
      <Row style={styles.header}>
        <View>
          <Txt variant="label" color={penalty ? C.red : C.blue}>
            {penalty ? 'Penalty Zone' : 'Daily Quest'}
          </Txt>
          <Txt variant="h1">Player {player.name}</Txt>
        </View>
        <Countdown completed={quest.completed} />
      </Row>

      {showInstallTip && (
        <Panel tone="green">
          <Txt variant="strong" color={C.green}>
            Install SYSTEM on your Home Screen
          </Txt>
          <Txt variant="small" color={C.dim}>
            Tap Share (the square with an up arrow; on iOS 26 it's inside the ••• menu) → "Add to Home Screen" → Add.
            SYSTEM then opens full screen, works offline, and can send you reminder notifications.
          </Txt>
        </Panel>
      )}

      {showReminderTip && (
        <Panel tone="gold">
          <Row>
            <Txt variant="small" color={C.dim} style={styles.flex}>
              No daily reminders yet. Set them up so you never miss a quest.
            </Txt>
            <SysButton label="Set up" size="sm" tone="gold" onPress={() => router.push('/settings')} />
          </Row>
        </Panel>
      )}

      {penalty && (
        <Panel title="Penalty Quest" tone="red">
          <Txt variant="body" color={C.dim} style={styles.intro}>
            Survive. Complete this quest to unlock the Daily Quest and Training again.
          </Txt>
          {penalty.targets.map((goal) => (
            <Counter
              key={goal.id}
              goal={goal}
              tone="red"
              allowMinus
              value={penalty.progress[goal.id]}
              onAdd={(delta) => addPenalty(goal.id as PenaltyItemId, delta)}
            />
          ))}
        </Panel>
      )}

      <Panel
        title="Daily Quest"
        right={
          quest.completed ? (
            <Chip label="Done" color={C.green} />
          ) : (
            <Chip label={`${doneCount}/${quest.targets.length}`} color={C.blue} />
          )
        }
        style={penalty ? styles.lockedPanel : undefined}
      >
        <Txt variant="h2" color={C.blue} center glowing style={styles.questName}>
          [Preparations to Become Powerful]
        </Txt>
        <Txt variant="label" color={C.dim} center style={styles.goalLabel}>
          Goals
        </Txt>

        {quest.targets.map((goal) => (
          <Counter
            key={goal.id}
            goal={goal}
            locked={!!penalty}
            allowMinus={!quest.completed}
            value={quest.progress[goal.id]}
            onAdd={(delta) => addQuest(goal.id as QuestItemId, delta)}
          />
        ))}

        {penalty ? (
          <Txt variant="strong" color={C.red} center style={styles.footer}>
            LOCKED — complete the Penalty Quest first.
          </Txt>
        ) : quest.completed ? (
          <View style={styles.footer}>
            <Txt variant="h2" color={C.green} center glowing>
              QUEST COMPLETE
            </Txt>
            <Txt variant="small" color={C.dim} center>
              A new quest arrives at midnight. Want more XP? Extra training awaits.
            </Txt>
            <SysButton label="Extra Training" size="sm" onPress={() => router.navigate('/training')} style={styles.more} />
          </View>
        ) : (
          <View style={styles.footer}>
            <Txt variant="small" color={C.gold} center>
              Rewards: +{reward} XP · +{QUEST_STAT_POINTS} Ability Points · Random Box
            </Txt>
            <Txt variant="small" color={C.red} center style={styles.warning}>
              WARNING: Failure to complete the Daily Quest will result in an appropriate penalty.
            </Txt>
          </View>
        )}
      </Panel>

      <Panel>
        <Row style={styles.infoRow}>
          <View style={styles.info}>
            <Txt variant="label" color={C.dim}>
              Streak
            </Txt>
            <Txt variant="h1" color={player.streak > 0 ? C.gold : C.text} glowing={player.streak > 0}>
              {player.streak} {player.streak === 1 ? 'day' : 'days'}
            </Txt>
            <Txt variant="small" color={C.dim}>
              XP ×{streakMultiplier(player.streak).toFixed(2)}
            </Txt>
          </View>
          <View style={styles.info}>
            <Txt variant="label" color={C.dim}>
              Quest Tier
            </Txt>
            <Txt variant="h1">{questTier(player.level)}</Txt>
            <Txt variant="small" color={C.dim}>
              Next tier at Lv. {nextTierLevel(player.level)}
            </Txt>
          </View>
        </Row>
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { justifyContent: 'space-between', alignItems: 'flex-end' },
  timer: { alignItems: 'flex-end' },
  intro: { marginBottom: 8 },
  lockedPanel: { opacity: 0.55, borderColor: alpha(C.red, 0.5) },
  questName: { marginBottom: 4 },
  goalLabel: { marginBottom: 6 },
  footer: { marginTop: 14, gap: 6 },
  warning: { marginTop: 4 },
  more: { alignSelf: 'center', marginTop: 6 },
  infoRow: { alignItems: 'flex-start' },
  info: { flex: 1, gap: 2 },
  flex: { flex: 1 },
});
