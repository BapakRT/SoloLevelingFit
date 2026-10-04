import { StyleSheet, View } from 'react-native';
import { CATALOG, TOTAL_LABELS } from '@/engine/constants';
import { addDays, dateKey, daysBetween, parseKey } from '@/engine/date';
import type { HistoryEntry } from '@/engine/types';
import { useGame } from '@/store/useGame';
import { UNIT_LABEL, formatAmount } from '@/ui/Counter';
import { Panel, Row, Screen, Txt } from '@/ui/kit';
import { C, alpha, glow } from '@/ui/theme';
import { useNow } from '@/ui/useNow';

const WEEKS = 5;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const dayCount = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;

function describeEntry(entry: HistoryEntry): string {
  switch (entry.kind) {
    case 'quest':
      return 'Daily Quest complete';
    case 'training': {
      const name = CATALOG.find((e) => e.id === entry.exerciseId)?.name ?? entry.exerciseId;
      return `${name} · ${formatAmount(entry.amount)} ${UNIT_LABEL[entry.unit]}`;
    }
    case 'penalty':
      return `Daily Quest failed (${dayCount(entry.days)})`;
    case 'penaltyCleared':
      return 'Penalty Quest survived';
    case 'streakBonus':
      return `${entry.days}-day streak bonus`;
  }
}

type Cell = 'done' | 'missed' | 'today' | 'future' | 'inactive';

const CELL_STYLE: Record<Cell, object> = {
  done: { backgroundColor: alpha(C.blue, 0.55), borderColor: C.blue, ...glow(C.blue, 8, 0.6) },
  missed: { backgroundColor: alpha(C.red, 0.25), borderColor: alpha(C.red, 0.7) },
  today: { borderColor: C.blue, borderStyle: 'dashed' },
  future: { borderColor: alpha(C.blue, 0.12) },
  inactive: { borderColor: alpha(C.blue, 0.12), backgroundColor: alpha(C.blue, 0.03) },
};

export default function HistoryScreen() {
  const game = useGame((s) => s.game);
  const now = useNow(60_000);
  const today = dateKey(now);
  const done = new Set(game.completedDays);

  // Monday-first grid ending with the current week.
  const mondayOffset = (now.getDay() + 6) % 7;
  const gridStart = addDays(today, -mondayOffset - (WEEKS - 1) * 7);
  const days = daysBetween(gridStart, addDays(gridStart, WEEKS * 7 - 1));

  function cellFor(day: string): Cell {
    if (done.has(day)) return 'done';
    if (day > today) return 'future';
    if (day === today) return 'today';
    if (!game.startDate || day <= game.startDate) return 'inactive';
    return 'missed';
  }

  const totals = Object.entries(game.totals).filter(([key, value]) => value > 0 && TOTAL_LABELS[key]);
  const activeDays = game.startDate ? daysBetween(game.startDate, today).length : 0;

  return (
    <Screen>
      <View>
        <Txt variant="label" color={C.blue}>
          Log
        </Txt>
        <Txt variant="h1">Don't break the chain</Txt>
      </View>

      <Panel title="Discipline Chain" icon="◆">
        <Row style={styles.weekHeader}>
          {WEEKDAYS.map((d) => (
            <Txt key={d} variant="label" color={C.faint} center style={styles.weekLabel}>
              {d}
            </Txt>
          ))}
        </Row>
        <View style={styles.grid}>
          {days.map((day) => {
            const cell = cellFor(day);
            return (
              <View key={day} style={styles.cellWrap}>
                <View style={[styles.cell, CELL_STYLE[cell]]}>
                  <Txt variant="small" color={cell === 'future' || cell === 'inactive' ? C.faint : C.text} center>
                    {parseKey(day).getDate()}
                  </Txt>
                </View>
              </View>
            );
          })}
        </View>
        <Row style={styles.legend}>
          <Legend color={C.blue} label="Completed" />
          <Legend color={C.red} label="Missed" />
        </Row>
      </Panel>

      <Panel title="Records" icon="★" tone="gold">
        <View style={styles.records}>
          <Record label="Streak" value={dayCount(game.player.streak)} />
          <Record label="Best streak" value={dayCount(game.player.bestStreak)} />
          <Record label="Quests completed" value={`${game.completedDays.length} / ${dayCount(activeDays)}`} />
          <Record label="Total XP" value={game.player.totalXp.toLocaleString('en-US')} />
        </View>
      </Panel>

      {totals.length > 0 && (
        <Panel title="Lifetime Totals" icon="Σ">
          {totals.map(([key, value]) => (
            <Row key={key} style={styles.line}>
              <Txt variant="body" style={styles.flex}>
                {TOTAL_LABELS[key].label}
              </Txt>
              <Txt variant="strong" color={C.blue}>
                {formatAmount(value)} {UNIT_LABEL[TOTAL_LABELS[key].unit]}
              </Txt>
            </Row>
          ))}
        </Panel>
      )}

      <Panel title="Recent Activity" icon="≡">
        {game.history.length === 0 ? (
          <Txt variant="body" color={C.dim}>
            Nothing logged yet. Your Daily Quest awaits.
          </Txt>
        ) : (
          game.history.slice(0, 40).map((entry) => <LogLine key={entry.id} entry={entry} />)
        )}
      </Panel>
    </Screen>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <Row>
      <View style={[styles.legendDot, { backgroundColor: alpha(color, 0.55), borderColor: color }]} />
      <Txt variant="small" color={C.dim}>
        {label}
      </Txt>
    </Row>
  );
}

function Record({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.record}>
      <Txt variant="label" color={C.dim}>
        {label}
      </Txt>
      <Txt variant="h2" color={C.gold}>
        {value}
      </Txt>
    </View>
  );
}

function LogLine({ entry }: { entry: HistoryEntry }) {
  const when = new Date(entry.at).toLocaleString('en-US', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  const color = entry.xp < 0 ? C.red : entry.kind === 'quest' || entry.kind === 'streakBonus' ? C.gold : C.blue;
  return (
    <Row style={styles.line}>
      <View style={styles.flex}>
        <Txt variant="strong" color={entry.kind === 'penalty' ? C.red : C.text}>
          {describeEntry(entry)}
        </Txt>
        <Txt variant="small" color={C.faint}>
          {when}
        </Txt>
      </View>
      <Txt variant="strong" color={color}>
        {entry.xp >= 0 ? '+' : ''}
        {entry.xp} XP
      </Txt>
    </Row>
  );
}

const styles = StyleSheet.create({
  weekHeader: { gap: 0, marginBottom: 6 },
  weekLabel: { flex: 1, letterSpacing: 0.5 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cellWrap: { width: `${100 / 7}%`, padding: 3 },
  cell: { aspectRatio: 1, borderWidth: 1, borderRadius: 4, justifyContent: 'center' },
  legend: { marginTop: 12, gap: 16 },
  legendDot: { width: 12, height: 12, borderRadius: 2, borderWidth: 1 },
  records: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 },
  record: { width: '50%', gap: 2 },
  line: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line, gap: 10 },
  flex: { flex: 1 },
});
