import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useGame } from '@/store/useGame';
import { C, F } from '@/ui/theme';

type IconName = keyof typeof Ionicons.glyphMap;

const badge = { fontFamily: F.bold, fontSize: 11 };

const icon =
  (name: IconName) =>
  ({ color, size }: { color: string; size: number }) => <Ionicons name={name} color={color} size={size} />;

export default function TabsLayout() {
  const questPending = useGame((s) => !!s.game.penalty || !s.game.quest.completed);
  const penalty = useGame((s) => !!s.game.penalty);
  const statPoints = useGame((s) => s.game.player.statPoints);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.blue,
        tabBarInactiveTintColor: C.faint,
        tabBarStyle: { backgroundColor: C.bg, borderTopColor: C.line },
        tabBarLabelStyle: { fontFamily: F.semibold, fontSize: 12, letterSpacing: 1 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Quest',
          tabBarIcon: icon('flash'),
          tabBarBadge: questPending ? '!' : undefined,
          tabBarBadgeStyle: { ...badge, backgroundColor: penalty ? C.red : C.blueDeep, color: C.text },
        }}
      />
      <Tabs.Screen
        name="status"
        options={{
          title: 'Status',
          tabBarIcon: icon('person'),
          tabBarBadge: statPoints > 0 ? statPoints : undefined,
          tabBarBadgeStyle: { ...badge, backgroundColor: C.gold, color: C.bg },
        }}
      />
      <Tabs.Screen name="training" options={{ title: 'Training', tabBarIcon: icon('barbell') }} />
      <Tabs.Screen name="history" options={{ title: 'Log', tabBarIcon: icon('calendar') }} />
    </Tabs>
  );
}
