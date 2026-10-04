import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

const native = Platform.OS !== 'web';
const ignore = () => {};

export const haptic = {
  tap: () => native && Haptics.selectionAsync().catch(ignore),
  success: () => native && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(ignore),
  warning: () => native && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(ignore),
  heavy: () => native && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(ignore),
};
