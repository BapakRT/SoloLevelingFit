import { useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import { QUEST_LEVEL_LABEL, goalLabel } from '@/engine/constants';
import { questTargets } from '@/engine/progression';
import type { CardioMode, QuestLevel } from '@/engine/types';
import { APP_URL, MORNING_HOURS, WARNING_HOURS, reminderCalendarPath } from '@/lib/calendar';
import { isInstalledWebApp } from '@/lib/platform';
import {
  disableReminders,
  enableReminders,
  reminderSupport,
  sendTestReminder,
  type ReminderSupport,
} from '@/lib/reminders';
import { useGame } from '@/store/useGame';
import { formatAmount, UNIT_LABEL } from '@/ui/Counter';
import { Panel, Row, Screen, SysButton, Txt } from '@/ui/kit';
import { C, F, alpha } from '@/ui/theme';

const LEVELS: QuestLevel[] = ['light', 'normal', 'hard'];

const hourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

const REMINDER_INTRO: Record<ReminderSupport, string> = {
  native: 'A morning notice when the quest arrives, and an evening warning if it is still unfinished.',
  push: 'A morning notice when the quest arrives, an evening warning, and a final warning at 23:00. Warnings stop automatically once the day\'s quest is done.',
  'install-first': 'A morning notice when the quest arrives, an evening warning, and a final warning at 23:00.',
  unsupported: 'Notifications are not available here. Use Calendar reminders below instead.',
};

function HourStepper({
  label,
  value,
  range,
  onChange,
}: {
  label: string;
  value: number;
  range: { min: number; max: number };
  onChange: (hour: number) => void;
}) {
  return (
    <Row style={styles.hourRow}>
      <SysButton label="−" size="sm" disabled={value <= range.min} onPress={() => onChange(value - 1)} />
      <View style={styles.flex}>
        <Txt variant="label" color={C.dim} center>
          {label}
        </Txt>
        <Txt variant="h2" center>
          {hourLabel(value)}
        </Txt>
      </View>
      <SysButton label="+" size="sm" disabled={value >= range.max} onPress={() => onChange(value + 1)} />
    </Row>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const game = useGame((s) => s.game);
  const { rename, setSettings, exportBackup, importBackup, reset } = useGame.getState();
  const [name, setName] = useState(game.player.name);
  const [notice, setNotice] = useState<string | null>(null);
  const [restoreText, setRestoreText] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const support = reminderSupport();
  const { settings } = game;

  const tomorrowTargets = questTargets(game.player.level, settings.questLevel, settings.cardioMode);

  // Opened straight from a URL (e.g. a reloaded web tab) there is no screen to go back to.
  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/status');
  }

  async function turnOnReminders() {
    setBusy(true);
    // enableReminders asks for permission first, while this tap still counts as a user gesture (iOS).
    const result = await enableReminders(useGame.getState().game);
    setBusy(false);
    if (result === 'on') {
      setSettings({ remindersEnabled: true });
      setNotice('Notifications are on. Tap "Send test" to try them.');
    } else if (result === 'denied') {
      setNotice(
        Platform.OS === 'web'
          ? 'Notification permission was denied. Open iPhone Settings → Notifications → SYSTEM → turn on "Allow Notifications", then try again.'
          : 'Notification permission was denied. Allow it in your phone settings, then try again.'
      );
    } else {
      setNotice('Could not reach the notification server. Check your connection and try again.');
    }
  }

  async function turnOffReminders() {
    setSettings({ remindersEnabled: false });
    await disableReminders();
    setNotice('Notifications turned off.');
  }

  async function testReminder() {
    const ok = await sendTestReminder().catch(() => false);
    setNotice(
      ok
        ? 'Test notification sent — check your lock screen or Notification Center.'
        : 'Test failed. Turn notifications off and on again.'
    );
  }

  const calendarPath = reminderCalendarPath(settings.reminderHour, settings.warningHour);

  // Same-origin navigation to a text/calendar file makes iOS show its "Add to Calendar" sheet.
  function installCalendar() {
    setSettings({ calendarReminders: true });
    if (typeof window !== 'undefined') window.location.href = calendarPath;
  }

  async function copyBackup() {
    await Clipboard.setStringAsync(exportBackup());
    setNotice('Backup copied. Keep it somewhere safe, like your Notes app.');
  }

  function restore() {
    const ok = importBackup(restoreText.trim());
    setNotice(ok ? 'Progress restored.' : 'That backup text is not valid.');
    if (ok) setRestoreText('');
  }

  return (
    <Screen>
      <Row style={styles.header}>
        <Txt variant="h1">Settings</Txt>
        <SysButton label="Close" size="sm" onPress={close} />
      </Row>

      {notice && (
        <Panel tone="gold">
          <Txt variant="body" color={C.gold}>
            {notice}
          </Txt>
        </Panel>
      )}

      <Panel title="Player" icon="i">
        <Row>
          <TextInput value={name} onChangeText={setName} maxLength={24} style={[styles.input, styles.flex]} />
          <SysButton
            label="Save"
            variant="solid"
            disabled={!name.trim() || name.trim() === game.player.name}
            onPress={() => {
              rename(name);
              setNotice('Name saved.');
            }}
          />
        </Row>
      </Panel>

      <Panel title="Daily Quest" icon="!">
        <Txt variant="small" color={C.dim} style={styles.para}>
          Changes apply from tomorrow's quest — today's goals can't be changed.
        </Txt>
        <Txt variant="label" color={C.dim} style={styles.label}>
          Level
        </Txt>
        <Row>
          {LEVELS.map((level) => (
            <SysButton
              key={level}
              size="sm"
              label={QUEST_LEVEL_LABEL[level]}
              variant={settings.questLevel === level ? 'solid' : 'ghost'}
              onPress={() => setSettings({ questLevel: level })}
              style={styles.flex}
            />
          ))}
        </Row>
        <Txt variant="label" color={C.dim} style={styles.label}>
          Cardio
        </Txt>
        <Row>
          {(['km', 'min'] as CardioMode[]).map((mode) => (
            <SysButton
              key={mode}
              size="sm"
              label={mode === 'km' ? 'Kilometers' : 'Minutes'}
              variant={settings.cardioMode === mode ? 'solid' : 'ghost'}
              onPress={() => setSettings({ cardioMode: mode })}
              style={styles.flex}
            />
          ))}
        </Row>
        <Txt variant="small" color={C.blue} style={styles.preview}>
          Tomorrow: {tomorrowTargets.map((t) => `${goalLabel(t).split(' ')[0]} ${formatAmount(t.target)} ${UNIT_LABEL[t.unit]}`).join(' · ')}
        </Txt>
      </Panel>

      <Panel title="Reminders" icon="⏰">
        <Txt variant="small" color={C.dim} style={styles.para}>
          {REMINDER_INTRO[support]}
        </Txt>
        <HourStepper
          label="Morning (quest arrives)"
          value={settings.reminderHour}
          range={MORNING_HOURS}
          onChange={(hour) => setSettings({ reminderHour: hour })}
        />
        <HourStepper
          label="Evening (warning)"
          value={settings.warningHour}
          range={WARNING_HOURS}
          onChange={(hour) => setSettings({ warningHour: hour })}
        />
        {(support === 'native' || support === 'push') &&
          (settings.remindersEnabled ? (
            <>
              <Txt variant="strong" color={C.green} style={styles.steps}>
                ✓ Notifications on
              </Txt>
              <Row style={styles.action}>
                <SysButton label="Send test" onPress={testReminder} style={styles.flex} />
                <SysButton label="Turn off" tone="red" onPress={turnOffReminders} style={styles.flex} />
              </Row>
            </>
          ) : (
            <SysButton
              label={busy ? 'Connecting…' : 'Turn on notifications'}
              variant="solid"
              disabled={busy}
              onPress={turnOnReminders}
              style={styles.action}
            />
          ))}
        {support === 'install-first' && (
          <Txt variant="strong" color={C.green} style={styles.steps}>
            On iPhone, notifications only work once SYSTEM is on your Home Screen. Follow "Install on your phone"
            below, open SYSTEM from its icon, then come back here and tap "Turn on notifications".
          </Txt>
        )}
        {(support === 'install-first' || support === 'unsupported') && (
          <>
            <Txt variant="label" color={C.dim} style={styles.label}>
              Alternative: Calendar reminders
            </Txt>
            <SysButton label="Add to Calendar" onPress={installCalendar} />
            <Txt variant="small" color={C.dim} style={styles.steps}>
              After tapping, choose "Add All". Done — you'll be notified at {hourLabel(settings.reminderHour)} and{' '}
              {hourLabel(settings.warningHour)} every day.
            </Txt>
            <Txt variant="small" color={C.faint} style={styles.steps}>
              Changing the times? In the Calendar app open the [DAILY QUEST] and [WARNING] events → Delete Event →
              Delete All Future Events, then add them again from here. If the button doesn't open Calendar, open this link
              in Safari:{' '}
              {APP_URL}
              {calendarPath}
            </Txt>
          </>
        )}
      </Panel>

      {Platform.OS === 'web' && !isInstalledWebApp() && (
        <Panel title="Install on your phone" icon="↓" tone="green">
          <Txt variant="strong">iPhone (Safari)</Txt>
          <Txt variant="small" color={C.dim} style={styles.para}>
            1. Tap the Share button (the square with an up arrow) at the bottom. On iOS 26, tap ••• first, then
            Share.{'\n'}
            2. Scroll down and choose "Add to Home Screen". If you see "Open as Web App", turn it on.{'\n'}
            3. Tap "Add". Always open SYSTEM from its Home Screen icon.
          </Txt>
          <Txt variant="strong">Android (Chrome)</Txt>
          <Txt variant="small" color={C.dim}>
            Menu ⋮ → "Install app" / "Add to Home screen".
          </Txt>
        </Panel>
      )}

      <Panel title="Backup" icon="⇅">
        <Txt variant="small" color={C.dim} style={styles.para}>
          Your progress lives on this phone. Copy a backup now and then so you keep your level if you switch phones.
        </Txt>
        <SysButton label="Copy backup" onPress={copyBackup} />
        <TextInput
          value={restoreText}
          onChangeText={setRestoreText}
          placeholder="Paste backup text here to restore"
          placeholderTextColor={C.faint}
          multiline
          style={[styles.input, styles.restore]}
        />
        <SysButton label="Restore" tone="gold" disabled={!restoreText.trim()} onPress={restore} />
      </Panel>

      <Panel title="Danger Zone" icon="!" tone="red">
        <Txt variant="small" color={C.dim} style={styles.para}>
          Erase all progress and start over from Level 1.
        </Txt>
        <SysButton
          tone="red"
          variant={confirmReset ? 'solid' : 'ghost'}
          label={confirmReset ? 'Sure? Tap again to confirm' : 'Reset all data'}
          onPress={() => {
            if (!confirmReset) return setConfirmReset(true);
            reset();
            close();
          }}
        />
      </Panel>

      <Txt variant="small" color={C.faint} center>
        THE SYSTEM v{Constants.expoConfig?.version ?? '2'}
      </Txt>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { justifyContent: 'space-between' },
  flex: { flex: 1 },
  para: { marginBottom: 10 },
  label: { marginTop: 10, marginBottom: 6 },
  preview: { marginTop: 12 },
  hourRow: { marginTop: 10 },
  action: { marginTop: 16 },
  steps: { marginTop: 10 },
  input: {
    borderWidth: 1.5,
    borderColor: alpha(C.blue, 0.5),
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: C.text,
    fontFamily: F.semibold,
    fontSize: 16,
  },
  restore: { minHeight: 80, marginVertical: 10, textAlignVertical: 'top', fontSize: 13 },
});
