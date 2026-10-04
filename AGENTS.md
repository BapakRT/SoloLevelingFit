# Expo SDK 54

This project is pinned to Expo SDK 54. Use the versioned docs at https://docs.expo.dev/versions/v54.0.0/ — not the latest.

- Game rules live in `src/engine/` as pure functions. Verify rule changes with `npm run check:engine`.
- iPhone install path is the web build (`npm run deploy:web`, then Add to Home Screen). Android is an APK built on EAS (`npm run build:apk`).
- `.npmrc` sets `legacy-peer-deps=true`; `npx expo install --fix` fails on a peer conflict without it.
