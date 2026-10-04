import { Platform, type TextStyle } from 'react-native';
import type { Rank, StatKey } from '@/engine/types';

export const C = {
  bg: '#02050B',
  bgTop: '#071631',
  panel: 'rgba(5, 16, 36, 0.92)',
  panelSoft: 'rgba(12, 32, 66, 0.55)',
  line: 'rgba(79, 195, 255, 0.28)',
  blue: '#4FC3FF',
  blueDeep: '#1E7BFF',
  text: '#E8F4FF',
  dim: '#8FB0D6',
  faint: '#4D6E96',
  gold: '#FFD166',
  red: '#FF3B4E',
  redDeep: '#2A0509',
  green: '#3DDC97',
  purple: '#A07BFF',
};

export type Tone = 'blue' | 'red' | 'gold' | 'purple' | 'green';

export const TONE: Record<Tone, string> = {
  blue: C.blue,
  red: C.red,
  gold: C.gold,
  purple: C.purple,
  green: C.green,
};

export const F = {
  medium: 'Rajdhani_500Medium',
  semibold: 'Rajdhani_600SemiBold',
  bold: 'Rajdhani_700Bold',
};

export const STAT_COLOR: Record<StatKey, string> = {
  STR: '#FF6B6B',
  AGI: '#3DDC97',
  VIT: '#4FC3FF',
  INT: '#A07BFF',
  SEN: '#FFD166',
};

export const RANK_COLOR: Record<Rank, string> = {
  E: '#8FB0D6',
  D: '#4FC3FF',
  C: '#3DDC97',
  B: '#FFD166',
  A: '#FF8A4C',
  S: '#A07BFF',
};

/** Hex colour with alpha, e.g. alpha('#4FC3FF', 0.5). */
export function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export function glow(color: string, radius = 14, strength = 0.55) {
  return { boxShadow: `0 0 ${radius}px ${alpha(color, strength)}` };
}

export function textGlow(color: string, radius = 10): TextStyle {
  // react-native-web deprecates the textShadow* longhands in favour of the CSS shorthand.
  return Platform.OS === 'web'
    ? ({ textShadow: `0 0 ${radius}px ${alpha(color, 0.8)}` } as TextStyle)
    : { textShadowColor: alpha(color, 0.8), textShadowOffset: { width: 0, height: 0 }, textShadowRadius: radius };
}

export const MAX_WIDTH = 560;
