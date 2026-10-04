import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { CATALOG, DIFFICULTY_MULTIPLIER, type Exercise } from '@/engine/constants';
import { streakMultiplier } from '@/engine/progression';
import type { StatKey, Unit } from '@/engine/types';
import { useGame } from '@/store/useGame';
import { UNIT_LABEL, formatAmount } from '@/ui/Counter';
import { Chip, Panel, Row, Screen, SysButton, Txt } from '@/ui/kit';
import { C, F, STAT_COLOR, alpha } from '@/ui/theme';

const QUICK: Record<Unit, number[]> = {
  rep: [10, 20, 50],
  min: [5, 10, 20],
  km: [1, 3, 5],
  sec: [30, 60],
};

const CATEGORIES = [...new Set(CATALOG.map((e) => e.category))];

const DIFFICULTY_COLOR = { Easy: C.green, Medium: C.blue, Hard: C.gold, Elite: C.purple } as const;

export default function TrainingScreen() {
  const streak = useGame((s) => s.game.player.streak);
  const locked = useGame((s) => !!s.game.penalty);
  const [openId, setOpenId] = useState<string | null>(null);
  const multiplier = streakMultiplier(streak);

  return (
    <Screen tone={locked ? 'red' : 'blue'}>
      <View>
        <Txt variant="label" color={C.blue}>
          Extra Training
        </Txt>
        <Txt variant="h1">Become stronger</Txt>
        <Txt variant="small" color={C.dim}>
          Bonus XP on top of the Daily Quest. The harder the exercise, the more XP it pays. Current streak: ×
          {multiplier.toFixed(2)}.
        </Txt>
      </View>

      {locked && (
        <Panel title="Locked" tone="red">
          <Txt variant="body">You are in the Penalty Zone. Complete the Penalty Quest on the Quest tab first.</Txt>
        </Panel>
      )}

      {CATEGORIES.map((category) => (
        <Panel key={category} title={category} icon="+" style={locked ? styles.locked : undefined}>
          {CATALOG.filter((e) => e.category === category).map((exercise) => (
            <ExerciseRow
              key={exercise.id}
              exercise={exercise}
              multiplier={multiplier}
              open={openId === exercise.id}
              disabled={locked}
              onToggle={() => setOpenId(openId === exercise.id ? null : exercise.id)}
            />
          ))}
        </Panel>
      ))}
    </Screen>
  );
}

function ExerciseRow({
  exercise,
  multiplier,
  open,
  disabled,
  onToggle,
}: {
  exercise: Exercise;
  multiplier: number;
  open: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const train = useGame((s) => s.train);
  const [amount, setAmount] = useState('');
  const [result, setResult] = useState<{ xp: number; statGain: number; stat: StatKey } | null>(null);

  useEffect(() => {
    if (!result) return;
    const id = setTimeout(() => setResult(null), 4000);
    return () => clearTimeout(id);
  }, [result]);

  const perUnit = exercise.baseXp * DIFFICULTY_MULTIPLIER[exercise.difficulty] * multiplier;
  const value = Number(amount.replace(',', '.'));

  function log(n: number) {
    if (!(n > 0)) return;
    const res = train(exercise.id, n);
    setResult({ ...res, stat: exercise.stat });
    setAmount('');
  }

  return (
    <View style={styles.item}>
      <Pressable disabled={disabled} onPress={onToggle} style={styles.itemHeader}>
        <View style={styles.flex}>
          <Txt variant="strong">{exercise.name}</Txt>
          <Row style={styles.chips}>
            <Chip label={exercise.stat} color={STAT_COLOR[exercise.stat]} />
            <Chip label={exercise.difficulty} color={DIFFICULTY_COLOR[exercise.difficulty]} />
            <Txt variant="small" color={C.dim}>
              ~{formatAmount(Math.round(perUnit * 10) / 10)} XP/{exercise.unit}
            </Txt>
          </Row>
        </View>
        {result ? (
          <View style={styles.result}>
            <Txt variant="strong" color={C.gold} glowing>
              +{result.xp} XP
            </Txt>
            {result.statGain > 0 && (
              <Txt variant="small" color={STAT_COLOR[result.stat]}>
                +{result.statGain} {result.stat}
              </Txt>
            )}
          </View>
        ) : (
          <Txt variant="h2" color={C.faint}>
            {open ? '−' : '+'}
          </Txt>
        )}
      </Pressable>

      {open && !disabled && (
        <View style={styles.form}>
          <Row style={styles.wrap}>
            {QUICK[exercise.unit].map((n) => (
              <SysButton key={n} size="sm" label={`${n} ${UNIT_LABEL[exercise.unit]}`} onPress={() => log(n)} />
            ))}
          </Row>
          <Row>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              onSubmitEditing={() => log(value)}
              keyboardType="decimal-pad"
              placeholder={`Amount (${UNIT_LABEL[exercise.unit]})`}
              placeholderTextColor={C.faint}
              style={styles.input}
            />
            <SysButton label="Log" variant="solid" disabled={!(value > 0)} onPress={() => log(value)} />
          </Row>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  locked: { opacity: 0.45 },
  item: { borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 10 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
  chips: { marginTop: 4, flexWrap: 'wrap' },
  result: { alignItems: 'flex-end' },
  form: { gap: 10, marginTop: 12 },
  wrap: { flexWrap: 'wrap' },
  input: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: alpha(C.blue, 0.5),
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: C.text,
    fontFamily: F.semibold,
    fontSize: 16,
  },
});
