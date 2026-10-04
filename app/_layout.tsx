import { useEffect } from 'react';
import { ActivityIndicator, AppState, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import {
  useFonts,
  Rajdhani_500Medium,
  Rajdhani_600SemiBold,
  Rajdhani_700Bold,
} from '@expo-google-fonts/rajdhani';
import { useGame, useHydrated } from '@/store/useGame';
import { syncReminders } from '@/lib/reminders';
import { Awakening } from '@/ui/Awakening';
import { SystemModal } from '@/ui/SystemModal';
import { C } from '@/ui/theme';

// Catches midnight while the app stays open, and every return to the foreground.
const EVALUATE_EVERY_MS = 30_000;

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Rajdhani_500Medium, Rajdhani_600SemiBold, Rajdhani_700Bold });
  const hydrated = useHydrated();
  const onboarded = useGame((s) => s.game.onboarded);
  const evaluate = useGame((s) => s.evaluate);
  const questDate = useGame((s) => s.game.quest.date);
  const questDone = useGame((s) => s.game.quest.completed);
  const remindersEnabled = useGame((s) => s.game.settings.remindersEnabled);
  const reminderHour = useGame((s) => s.game.settings.reminderHour);
  const warningHour = useGame((s) => s.game.settings.warningHour);
  const penalty = useGame((s) => !!s.game.penalty);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(C.bg).catch(() => {});
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    evaluate();
    const id = setInterval(evaluate, EVALUATE_EVERY_MS);
    const sub = AppState.addEventListener('change', (state) => state === 'active' && evaluate());
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [hydrated, evaluate]);

  useEffect(() => {
    if (!hydrated) return;
    syncReminders(useGame.getState().game).catch(() => {});
  }, [hydrated, onboarded, questDate, questDone, penalty, remindersEnabled, reminderHour, warningHour]);

  // Screens only mount once the save is loaded, so none of them initialise from the empty default state.
  if (!fontsLoaded || !hydrated) {
    return (
      <View style={[styles.root, styles.loading]}>
        <ActivityIndicator color={C.blue} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
      </Stack>
      {!onboarded && <Awakening />}
      <SystemModal />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  loading: { alignItems: 'center', justifyContent: 'center' },
});
