import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { QUEST_LEVEL_LABEL, goalLabel } from '@/engine/constants';
import { questTargets } from '@/engine/progression';
import type { CardioMode, QuestLevel } from '@/engine/types';
import { haptic } from '@/lib/haptics';
import { useGame } from '@/store/useGame';
import { formatAmount, UNIT_LABEL } from './Counter';
import { Panel, Row, Screen, SysButton, Txt } from './kit';
import { C, F, alpha, glow } from './theme';

const LEVELS: QuestLevel[] = ['light', 'normal', 'hard'];

export function Awakening() {
  const onboard = useGame((s) => s.onboard);
  const [step, setStep] = useState(0);
  const [refused, setRefused] = useState(false);
  const [name, setName] = useState('');
  const [questLevel, setQuestLevel] = useState<QuestLevel>('light');
  const [cardioMode, setCardioMode] = useState<CardioMode>('km');

  return (
    <View style={StyleSheet.absoluteFill}>
      <Screen>
        <View style={styles.spacer} />
        {step === 0 && (
          <Panel title="Notification" icon="!">
            <Txt variant="h2" center style={styles.para}>
              You have acquired the qualifications to be a{'\n'}
              <Txt variant="h1" color={C.blue} glowing>
                "Player"
              </Txt>
            </Txt>
            <Txt variant="body" color={C.dim} center style={styles.para}>
              Will you accept?
            </Txt>
            {refused && (
              <Txt variant="strong" color={C.red} center style={styles.para}>
                Refusal is not permitted.
              </Txt>
            )}
            <Row style={styles.choices}>
              <SysButton label="Decline" tone="red" onPress={() => setRefused(true)} style={styles.flex} />
              <SysButton label="Accept" variant="solid" onPress={() => setStep(1)} style={styles.flex} />
            </Row>
          </Panel>
        )}

        {step === 1 && (
          <Panel title="Player Registration" icon="?">
            <Txt variant="body" color={C.dim} style={styles.para}>
              State your name, Player.
            </Txt>
            <TextInput
              autoFocus
              value={name}
              onChangeText={setName}
              onSubmitEditing={() => name.trim() && setStep(2)}
              placeholder="Name"
              placeholderTextColor={C.faint}
              maxLength={24}
              style={styles.input}
            />
            <SysButton label="Next" variant="solid" disabled={!name.trim()} onPress={() => setStep(2)} />
          </Panel>
        )}

        {step === 2 && (
          <Panel title="Daily Quest Level" icon="!">
            <Txt variant="body" color={C.dim} style={styles.para}>
              Start small. What matters is never skipping a day — goals rise automatically every 5 levels.
            </Txt>
            {LEVELS.map((level) => {
              const selected = level === questLevel;
              const targets = questTargets(1, level, cardioMode);
              return (
                <Pressable
                  key={level}
                  onPress={() => {
                    haptic.tap();
                    setQuestLevel(level);
                  }}
                  style={[styles.option, selected && styles.optionSelected]}
                >
                  <Txt variant="h2" color={selected ? C.blue : C.text} glowing={selected}>
                    {QUEST_LEVEL_LABEL[level]}
                    {level === 'light' ? '  (recommended)' : ''}
                  </Txt>
                  <Txt variant="small" color={C.dim}>
                    {targets
                      .map((t) => `${goalLabel(t).split(' ')[0]} ${formatAmount(t.target)} ${UNIT_LABEL[t.unit]}`)
                      .join(' · ')}
                  </Txt>
                </Pressable>
              );
            })}

            <Txt variant="label" color={C.dim} style={styles.sectionLabel}>
              Track cardio in
            </Txt>
            <Row>
              <SysButton
                label="Kilometers (run)"
                size="sm"
                variant={cardioMode === 'km' ? 'solid' : 'ghost'}
                onPress={() => setCardioMode('km')}
                style={styles.flex}
              />
              <SysButton
                label="Minutes (indoor)"
                size="sm"
                variant={cardioMode === 'min' ? 'solid' : 'ghost'}
                onPress={() => setCardioMode('min')}
                style={styles.flex}
              />
            </Row>
            <SysButton label="Next" variant="solid" onPress={() => setStep(3)} style={styles.next} />
          </Panel>
        )}

        {step === 3 && (
          <Panel title="Contract" icon="!">
            <Txt variant="h1" center glowing style={styles.para}>
              Welcome,{'\n'}
              <Txt variant="h1" color={C.blue} glowing>
                Player {name.trim()}
              </Txt>
            </Txt>
            <Txt variant="body" color={C.dim} center style={styles.para}>
              A Daily Quest will arrive every day. Complete it before midnight to level up.
            </Txt>
            <Txt variant="strong" color={C.red} center style={styles.para}>
              Fail, and you enter the Penalty Zone: your streak is lost, XP is taken, and you must survive first.
            </Txt>
            <Txt variant="small" color={C.dim} center style={styles.para}>
              Today is your awakening — there is no penalty for today.
            </Txt>
            <SysButton label="Arise" variant="solid" size="lg" onPress={() => onboard({ name, questLevel, cardioMode })} />
          </Panel>
        )}
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  spacer: { height: 48 },
  para: { marginBottom: 14 },
  choices: { marginTop: 8 },
  flex: { flex: 1 },
  input: {
    borderWidth: 1.5,
    borderColor: alpha(C.blue, 0.6),
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: C.text,
    fontFamily: F.semibold,
    fontSize: 20,
    marginBottom: 16,
  },
  option: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 4,
    padding: 12,
    marginBottom: 10,
    gap: 2,
  },
  optionSelected: { borderColor: C.blue, backgroundColor: alpha(C.blue, 0.1), ...glow(C.blue, 10, 0.4) },
  sectionLabel: { marginTop: 8, marginBottom: 8 },
  next: { marginTop: 16 },
});
