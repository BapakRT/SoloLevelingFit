// Runs after `expo export -p web`:
// 1. stamps the service worker with a unique build id so installed copies
//    pick up the new version on next launch;
// 2. writes one reminder calendar per hour combination (see src/lib/calendar.ts).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MORNING_HOURS,
  WARNING_HOURS,
  buildReminderCalendar,
  reminderCalendarPath,
} from '../src/lib/calendar';

const dist = join(__dirname, '..', 'dist');

const swPath = join(dist, 'sw.js');
const buildId = Date.now().toString(36);
writeFileSync(swPath, readFileSync(swPath, 'utf8').replaceAll('__BUILD_ID__', buildId));
console.log(`sw.js stamped with build ${buildId}`);

mkdirSync(join(dist, 'reminders'), { recursive: true });
let count = 0;
for (let morning = MORNING_HOURS.min; morning <= MORNING_HOURS.max; morning++) {
  for (let warning = WARNING_HOURS.min; warning <= WARNING_HOURS.max; warning++) {
    writeFileSync(join(dist, reminderCalendarPath(morning, warning)), buildReminderCalendar(morning, warning));
    count++;
  }
}
console.log(`wrote ${count} reminder calendars`);
