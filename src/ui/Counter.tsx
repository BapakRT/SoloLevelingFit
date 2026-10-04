import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { goalLabel } from '@/engine/constants';
import type { PenaltyItemId, QuestItemId, QuestTarget, Unit } from '@/engine/types';
import { C, F, TONE, alpha, type Tone } from './theme';
import { GlowBar, Row, SysButton, Txt } from './kit';

const STEPS: Record<Unit, number[]> = {
  rep: [1, 5, 10],
  km: [0.5, 1],
  min: [1, 5],
  sec: [10, 30],
};

export const UNIT_LABEL: Record<Unit, string> = { rep: 'reps', km: 'km', min: 'min', sec: 'sec' };

export function formatAmount(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
}

interface CounterProps {
  goal: QuestTarget<QuestItemId | PenaltyItemId>;
  value: number;
  onAdd: (delta: number) => void;
  tone?: Tone;
  locked?: boolean;
  allowMinus?: boolean;
}

export function Counter({ goal, value, onAdd, tone = 'blue', locked, allowMinus }: CounterProps) {
  const [custom, setCustom] = useState<string | null>(null);
  const done = value >= goal.target;
  const color = done ? C.green : TONE[tone];
  const steps = STEPS[goal.unit];

  function submitCustom() {
    const amount = Number((custom ?? '').replace(',', '.'));
    if (amount > 0) onAdd(amount);
    setCustom(null);
  }

  return (
    <View style={styles.wrap}>
      <Row style={styles.header}>
        <Txt variant="strong" color={done ? C.green : C.text} style={styles.label}>
          {done ? '✓ ' : '· '}
          {goalLabel(goal)}
        </Txt>
        <Txt variant="strong" color={color}>
          {formatAmount(Math.min(value, goal.target))} / {formatAmount(goal.target)} {UNIT_LABEL[goal.unit]}
        </Txt>
      </Row>
      <GlowBar value={value} max={goal.target} color={color} />

      {!locked && (
        <Row style={styles.buttons}>
          {allowMinus && value > 0 && (
            <SysButton size="sm" tone={tone} label={`−${formatAmount(steps[0])}`} onPress={() => onAdd(-steps[0])} />
          )}
          {steps.map((step) => (
            <SysButton key={step} size="sm" tone={tone} label={`+${formatAmount(step)}`} onPress={() => onAdd(step)} />
          ))}
          {custom === null ? (
            <SysButton size="sm" tone={tone} label="Enter" onPress={() => setCustom('')} />
          ) : (
            <Row style={styles.customRow}>
              <TextInput
                autoFocus
                value={custom}
                onChangeText={setCustom}
                onSubmitEditing={submitCustom}
                keyboardType="decimal-pad"
                placeholder="amount"
                placeholderTextColor={C.faint}
                style={[styles.input, { borderColor: alpha(TONE[tone], 0.6) }]}
              />
              <SysButton size="sm" tone={tone} variant="solid" label="OK" onPress={submitCustom} />
            </Row>
          )}
        </Row>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, paddingVertical: 6 },
  header: { justifyContent: 'space-between' },
  label: { flex: 1 },
  buttons: { flexWrap: 'wrap', marginTop: 2 },
  customRow: { gap: 6 },
  input: {
    width: 76,
    borderWidth: 1.5,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: C.text,
    fontFamily: F.semibold,
    fontSize: 15,
  },
});
