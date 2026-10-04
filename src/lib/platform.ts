import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';

/** Launched from the home screen icon rather than a browser tab. */
export function isInstalledWebApp(): boolean {
  if (!isWeb) return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.('(display-mode: standalone)').matches || nav.standalone === true;
}

export function isIosWeb(): boolean {
  if (!isWeb) return false;
  const { userAgent, maxTouchPoints } = window.navigator;
  // iPadOS reports itself as a Mac; touch support gives it away.
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}
