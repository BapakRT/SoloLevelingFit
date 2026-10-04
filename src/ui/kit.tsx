import type { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F, MAX_WIDTH, TONE, alpha, glow, textGlow, type Tone } from './theme';
import { haptic } from '@/lib/haptics';

// ---- Text -------------------------------------------------------------------

const VARIANTS = {
  display: { fontFamily: F.bold, fontSize: 64, lineHeight: 68, letterSpacing: 1 },
  h1: { fontFamily: F.bold, fontSize: 26, lineHeight: 30, letterSpacing: 2 },
  h2: { fontFamily: F.bold, fontSize: 19, lineHeight: 24, letterSpacing: 1.5 },
  body: { fontFamily: F.medium, fontSize: 16, lineHeight: 22 },
  strong: { fontFamily: F.semibold, fontSize: 16, lineHeight: 22 },
  small: { fontFamily: F.medium, fontSize: 14, lineHeight: 19 },
  label: { fontFamily: F.semibold, fontSize: 12, lineHeight: 16, letterSpacing: 2.5, textTransform: 'uppercase' },
} satisfies Record<string, TextStyle>;

export type TxtVariant = keyof typeof VARIANTS;

interface TxtProps extends TextProps {
  variant?: TxtVariant;
  color?: string;
  glowing?: boolean;
  center?: boolean;
}

export function Txt({ variant = 'body', color = C.text, glowing, center, style, ...rest }: TxtProps) {
  return (
    <Text
      {...rest}
      style={[
        VARIANTS[variant],
        { color },
        glowing && textGlow(color),
        center && { textAlign: 'center' },
        style,
      ]}
    />
  );
}

// ---- Screen -----------------------------------------------------------------

export function Screen({ children, tone = 'blue' }: { children: ReactNode; tone?: Tone }) {
  const insets = useSafeAreaInsets();
  const top = tone === 'red' ? C.redDeep : C.bgTop;
  return (
    <View style={styles.screen}>
      <LinearGradient colors={[top, C.bg, C.bg]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.column}>{children}</View>
      </ScrollView>
    </View>
  );
}

// ---- Panel (the "System window") -----------------------------------------------

interface PanelProps {
  title?: string;
  icon?: string;
  tone?: Tone;
  right?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Panel({ title, icon = '!', tone = 'blue', right, children, style }: PanelProps) {
  const color = TONE[tone];
  return (
    <View style={[styles.panel, { borderColor: color }, glow(color, 16, 0.45), style]}>
      {title ? (
        <View style={[styles.panelHeader, { borderBottomColor: alpha(color, 0.3) }]}>
          <View style={[styles.panelIcon, { borderColor: color }]}>
            <Txt variant="strong" color={color} glowing>
              {icon}
            </Txt>
          </View>
          <Txt variant="h2" color={C.text} style={styles.panelTitle} glowing>
            {title}
          </Txt>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

// ---- Glow bar ----------------------------------------------------------------

export function GlowBar({
  value,
  max,
  color = C.blue,
  height = 8,
}: {
  value: number;
  max: number;
  color?: string;
  height?: number;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <View style={[styles.barTrack, { height, borderRadius: height / 2, borderColor: alpha(color, 0.35) }]}>
      <View
        style={[
          { width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: height / 2 },
          pct > 0 && glow(color, 8, 0.8),
        ]}
      />
    </View>
  );
}

// ---- Buttons -------------------------------------------------------------------

interface SysButtonProps {
  label: string;
  onPress: () => void;
  tone?: Tone;
  variant?: 'solid' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function SysButton({
  label,
  onPress,
  tone = 'blue',
  variant = 'ghost',
  size = 'md',
  disabled,
  style,
}: SysButtonProps) {
  const color = TONE[tone];
  const solid = variant === 'solid';
  const pad = size === 'sm' ? 8 : size === 'lg' ? 16 : 12;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        {
          paddingVertical: pad,
          paddingHorizontal: pad + 6,
          borderColor: color,
          backgroundColor: solid ? alpha(color, pressed ? 0.35 : 0.22) : pressed ? alpha(color, 0.18) : 'transparent',
          opacity: disabled ? 0.35 : 1,
        },
        solid && !disabled && glow(color, 12, 0.5),
        style,
      ]}
    >
      <Txt variant={size === 'sm' ? 'small' : 'strong'} color={solid ? C.text : color} style={styles.buttonLabel}>
        {label}
      </Txt>
    </Pressable>
  );
}

export function Chip({ label, color = C.dim }: { label: string; color?: string }) {
  return (
    <View style={[styles.chip, { borderColor: alpha(color, 0.5) }]}>
      <Txt variant="label" color={color} style={{ letterSpacing: 1.2 }}>
        {label}
      </Txt>
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 16, alignItems: 'center' },
  column: { width: '100%', maxWidth: MAX_WIDTH, gap: 16 },
  panel: {
    backgroundColor: C.panel,
    borderWidth: 1.5,
    borderRadius: 6,
    padding: 16,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 12,
    marginBottom: 14,
    borderBottomWidth: 1,
  },
  panelIcon: {
    width: 28,
    height: 28,
    borderWidth: 1.5,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelTitle: { flex: 1, textTransform: 'uppercase' },
  barTrack: {
    width: '100%',
    backgroundColor: 'rgba(79, 195, 255, 0.08)',
    borderWidth: 1,
    overflow: 'hidden',
  },
  button: {
    borderWidth: 1.5,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: { letterSpacing: 1.5, textTransform: 'uppercase' },
  chip: { borderWidth: 1, borderRadius: 3, paddingHorizontal: 6, paddingVertical: 2 },
  divider: { height: 1, backgroundColor: C.line, marginVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
