import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { STAT_INFO, TITLES, TITLE_ORDER } from '@/engine/constants';
import { jobForLevel, rankForLevel, xpToNext } from '@/engine/progression';
import { STAT_KEYS } from '@/engine/types';
import { haptic } from '@/lib/haptics';
import { useGame } from '@/store/useGame';
import { Chip, Divider, GlowBar, Panel, Row, Screen, Txt } from '@/ui/kit';
import { C, RANK_COLOR, STAT_COLOR, alpha, glow } from '@/ui/theme';

export default function StatusScreen() {
  const router = useRouter();
  const player = useGame((s) => s.game.player);
  const allocate = useGame((s) => s.allocate);
  const equip = useGame((s) => s.equip);

  const rank = rankForLevel(player.level);
  const rankColor = RANK_COLOR[rank];
  const next = xpToNext(player.level);
  const hp = 100 + player.stats.VIT * 10;
  const mp = 20 + player.stats.INT * 8;
  const equipped = player.equippedTitle ? TITLES[player.equippedTitle]?.name : '—';

  return (
    <Screen>
      <Panel
        title="Status"
        icon="i"
        right={
          <Pressable accessibilityLabel="Settings" onPress={() => router.push('/settings')} hitSlop={12}>
            <Ionicons name="settings-outline" size={22} color={C.dim} />
          </Pressable>
        }
      >
        <Row style={styles.top}>
          <View style={styles.levelBox}>
            <Txt variant="label" color={C.dim}>
              Level
            </Txt>
            <Txt variant="display" color={C.blue} glowing>
              {player.level}
            </Txt>
          </View>
          <View style={styles.identity}>
            <Field label="Name" value={player.name} />
            <Field label="Job" value={jobForLevel(player.level)} />
            <Field label="Title" value={equipped} color={C.gold} />
          </View>
          <View style={[styles.rank, { borderColor: rankColor }, glow(rankColor, 14, 0.6)]}>
            <Txt variant="label" color={rankColor}>
              Rank
            </Txt>
            <Txt variant="h1" color={rankColor} glowing>
              {rank}
            </Txt>
          </View>
        </Row>

        <View style={styles.bars}>
          <BarLine label="EXP" value={`${player.xp} / ${next}`} color={C.blue} current={player.xp} max={next} />
          <BarLine label="HP" value={`${hp} / ${hp}`} color={C.green} current={hp} max={hp} />
          <BarLine label="MP" value={`${mp} / ${mp}`} color={C.purple} current={mp} max={mp} />
        </View>

        <Divider />

        <View style={styles.statGrid}>
          {STAT_KEYS.map((key) => (
            <View key={key} style={styles.statCell}>
              <View style={styles.statText}>
                <Txt variant="h2" color={STAT_COLOR[key]}>
                  {key}: <Txt variant="h2">{player.stats[key]}</Txt>
                </Txt>
                <Txt variant="small" color={C.faint}>
                  {STAT_INFO[key].name}
                </Txt>
              </View>
              {player.statPoints > 0 && (
                <Pressable
                  accessibilityLabel={`Add a point to ${key}`}
                  onPress={() => {
                    haptic.tap();
                    allocate(key);
                  }}
                  style={({ pressed }) => [
                    styles.plus,
                    { backgroundColor: alpha(C.gold, pressed ? 0.35 : 0.15) },
                    glow(C.gold, 8, 0.5),
                  ]}
                >
                  <Txt variant="h2" color={C.gold}>
                    +
                  </Txt>
                </Pressable>
              )}
            </View>
          ))}
        </View>

        <Txt variant="strong" color={player.statPoints > 0 ? C.gold : C.dim} center style={styles.points}>
          Available Ability Points: {player.statPoints}
        </Txt>
      </Panel>

      <Panel title="Titles" icon="★" tone="gold">
        {TITLE_ORDER.map((id) => {
          const owned = player.titles.includes(id);
          const active = player.equippedTitle === id;
          return (
            <Pressable
              key={id}
              disabled={!owned}
              onPress={() => {
                haptic.tap();
                equip(id);
              }}
              style={[styles.titleRow, active && styles.titleActive]}
            >
              <View style={styles.flex}>
                <Txt variant="strong" color={owned ? C.text : C.faint}>
                  {owned ? TITLES[id].name : '???'}
                </Txt>
                <Txt variant="small" color={owned ? C.dim : C.faint}>
                  {TITLES[id].desc}
                </Txt>
              </View>
              {active ? <Chip label="Equipped" color={C.gold} /> : owned ? <Chip label="Equip" /> : null}
            </Pressable>
          );
        })}
      </Panel>
    </Screen>
  );
}

function Field({ label, value, color = C.text }: { label: string; value: string; color?: string }) {
  return (
    <Txt variant="small" color={C.dim} numberOfLines={2}>
      {label.toUpperCase()}: <Txt variant="strong" color={color}>{value}</Txt>
    </Txt>
  );
}

function BarLine({
  label,
  value,
  color,
  current,
  max,
}: {
  label: string;
  value: string;
  color: string;
  current: number;
  max: number;
}) {
  return (
    <View style={styles.barLine}>
      <Row style={styles.barHeader}>
        <Txt variant="label" color={color}>
          {label}
        </Txt>
        <Txt variant="small" color={C.dim}>
          {value}
        </Txt>
      </Row>
      <GlowBar value={current} max={max} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: 'center', gap: 14 },
  levelBox: { alignItems: 'center', minWidth: 72 },
  identity: { flex: 1, gap: 4 },
  rank: { borderWidth: 1.5, borderRadius: 4, alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6 },
  bars: { gap: 10, marginTop: 16 },
  barLine: { gap: 4 },
  barHeader: { justifyContent: 'space-between' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 },
  statCell: { width: '50%', flexDirection: 'row', alignItems: 'center', paddingRight: 10 },
  statText: { flex: 1 },
  plus: {
    width: 34,
    height: 34,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: C.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  points: { marginTop: 16 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 4,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  titleActive: { backgroundColor: alpha(C.gold, 0.08) },
  flex: { flex: 1 },
});
