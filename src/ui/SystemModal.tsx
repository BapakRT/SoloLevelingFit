import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { TITLES, goalLabel } from '@/engine/constants';
import type { GameEvent } from '@/engine/types';
import { haptic } from '@/lib/haptics';
import { useGame } from '@/store/useGame';
import { formatAmount, UNIT_LABEL } from './Counter';
import { Panel, SysButton, Txt } from './kit';
import { C, MAX_WIDTH, alpha, type Tone } from './theme';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function Line({ children, color = C.text }: { children: React.ReactNode; color?: string }) {
  return (
    <Txt variant="body" color={color} style={styles.line}>
      {children}
    </Txt>
  );
}

function describe(event: GameEvent): { tone: Tone; title: string; button: string; body: React.ReactNode } {
  switch (event.type) {
    case 'questArrived':
      return {
        tone: 'blue',
        title: 'Daily Quest Has Arrived',
        button: 'Accept',
        body: (
          <>
            <Txt variant="h2" color={C.blue} center glowing style={styles.gap}>
              [Preparations to Become Powerful]
            </Txt>
            <Txt variant="label" color={C.dim} center style={styles.gap}>
              Goals
            </Txt>
            {event.targets.map((t) => (
              <Line key={t.id}>
                · {goalLabel(t)}: {formatAmount(t.target)} {UNIT_LABEL[t.unit]}
              </Line>
            ))}
            <Txt variant="small" color={C.red} center style={styles.warning}>
              WARNING: Failure to complete the Daily Quest will result in an appropriate penalty.
            </Txt>
          </>
        ),
      };
    case 'penalty':
      return {
        tone: 'red',
        title: 'Penalty',
        button: 'Survive',
        body: (
          <>
            <Line>
              You failed to complete the Daily Quest ({plural(event.missedDays, 'day')}). You have been moved to the
              Penalty Zone.
            </Line>
            <Line color={C.red}>· Streak reset to 0</Line>
            {event.xpLost > 0 && <Line color={C.red}>· −{event.xpLost} XP</Line>}
            <Txt variant="label" color={C.red} style={styles.gap}>
              Penalty Quest
            </Txt>
            {event.targets.map((t) => (
              <Line key={t.id}>
                · {goalLabel(t)}: {t.target} {UNIT_LABEL[t.unit]}
              </Line>
            ))}
            <Txt variant="small" color={C.dim} style={styles.warning}>
              The Daily Quest and Training are locked until the Penalty Quest is complete.
            </Txt>
          </>
        ),
      };
    case 'penaltyCleared':
      return {
        tone: 'green',
        title: 'Survived',
        button: 'Continue',
        body: (
          <>
            <Line>You survived the Penalty Zone.</Line>
            <Line color={C.green}>· +{event.xp} XP</Line>
            <Line color={C.dim}>The Daily Quest is unlocked. Complete it before midnight.</Line>
          </>
        ),
      };
    case 'questComplete':
      return {
        tone: 'gold',
        title: 'Quest Complete',
        button: 'Claim Rewards',
        body: (
          <>
            <Line>Rewards have been distributed:</Line>
            <Line color={C.gold}>1. Full Recovery</Line>
            <Line color={C.gold}>2. +{event.statPoints} Ability Points</Line>
            <Line color={C.gold}>
              3. +{event.xp} XP{event.multiplier > 1 ? `  (×${event.multiplier.toFixed(2)} streak)` : ''}
            </Line>
            <Line color={event.box.jackpot ? C.purple : C.gold}>
              4. Random Box: +{event.box.xp} XP{event.box.statPoint ? ' +1 point' : ''}
              {event.box.jackpot ? '  — JACKPOT!' : ''}
            </Line>
            <Txt variant="small" color={C.dim} style={styles.warning}>
              Current streak: {plural(event.streak, 'day')}
            </Txt>
          </>
        ),
      };
    case 'streakMilestone':
      return {
        tone: 'purple',
        title: `${event.days}-Day Streak`,
        button: 'Accept',
        body: (
          <>
            <Line>Your consistency has been recognized by the System.</Line>
            <Line color={C.purple}>· Bonus +{event.xp} XP</Line>
          </>
        ),
      };
    case 'levelUp':
      return {
        tone: 'blue',
        title: 'Level Up',
        button: 'OK',
        body: (
          <>
            <Txt variant="display" color={C.blue} center glowing>
              LEVEL UP!
            </Txt>
            <Txt variant="h1" center style={styles.gap}>
              Lv. {event.from} → Lv. {event.to}
            </Txt>
            <Line color={C.gold}>+{event.statPoints} Ability Points. Allocate them on the Status screen.</Line>
          </>
        ),
      };
    case 'rankUp':
      return {
        tone: 'purple',
        title: 'Rank Up',
        button: 'OK',
        body: (
          <Txt variant="h1" color={C.purple} center glowing>
            {event.rank}-Rank Hunter
          </Txt>
        ),
      };
    case 'jobChange':
      return {
        tone: 'purple',
        title: 'Job Change',
        button: 'Accept',
        body: (
          <>
            <Line>The requirements have been met. Your job has changed.</Line>
            <Txt variant="h1" color={C.purple} center glowing>
              {event.job}
            </Txt>
          </>
        ),
      };
    case 'title': {
      const title = TITLES[event.titleId];
      return {
        tone: 'gold',
        title: 'Title Acquired',
        button: 'OK',
        body: (
          <>
            <Txt variant="h1" color={C.gold} center glowing>
              [{title?.name ?? event.titleId}]
            </Txt>
            <Line color={C.dim}>{title?.desc}</Line>
          </>
        ),
      };
    }
  }
}

export function SystemModal() {
  const event = useGame((s) => s.events[0]);
  const dismiss = useGame((s) => s.dismissEvent);
  const appear = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!event) return;
    if (event.type === 'penalty') haptic.warning();
    else if (event.type === 'levelUp') haptic.heavy();
    else haptic.success();
    appear.setValue(0);
    Animated.timing(appear, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [event, appear]);

  if (!event) return null;
  const { tone, title, button, body } = describe(event);

  return (
    <View style={[StyleSheet.absoluteFill, styles.backdrop, { backgroundColor: alpha(tone === 'red' ? C.redDeep : C.bg, 0.88) }]}>
      <Animated.View
        style={[
          styles.card,
          {
            opacity: appear,
            transform: [{ scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
          },
        ]}
      >
        <Panel title={title} tone={tone} icon={event.type === 'penalty' ? '!' : 'i'}>
          <View style={styles.body}>{body}</View>
          <SysButton label={button} tone={tone} variant="solid" size="lg" onPress={dismiss} style={styles.button} />
        </Panel>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { zIndex: 100, alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: MAX_WIDTH - 40 },
  body: { gap: 4 },
  line: { lineHeight: 24 },
  gap: { marginVertical: 6 },
  warning: { marginTop: 12 },
  button: { marginTop: 20 },
});
