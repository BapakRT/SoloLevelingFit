// Web Push server: the Cloudflare Worker in push-worker/. The public key must
// match the worker's VAPID_PUBLIC_KEY (push-worker/wrangler.toml).
// Leave empty to disable push; the app then offers only the Calendar fallback.
export const PUSH_API: string = 'https://system-push.system-push.workers.dev';
export const VAPID_PUBLIC_KEY =
  'BHp_5zuq5cVxulTrynaOC51EpaLMUeoi0jgqrgWYQHclcUkopRxNHBMLj8f8_MGrmv2qb7MZRcNRO8-EnBPb2Nc';
