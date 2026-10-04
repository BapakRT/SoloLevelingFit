// Daily reminders for the web app via the phone's own Calendar.
//
// Browsers (iPhone Safari especially) can't schedule local notifications
// without a push server, but Calendar can: importing this .ics adds two
// repeating daily events whose alarms fire as normal system notifications,
// even when SYSTEM is closed. One static file per hour combination is written
// at build time (scripts/postbuild-web.ts), so no server is needed.

export const APP_URL = 'https://bapakrt-system.expo.app';

export const MORNING_HOURS = { min: 5, max: 11 };
export const WARNING_HOURS = { min: 17, max: 23 };

const pad = (n: number) => String(n).padStart(2, '0');

export function reminderCalendarPath(morningHour: number, warningHour: number): string {
  return `/reminders/morning-${pad(morningHour)}-evening-${pad(warningHour)}.ics`;
}

function escapeText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

// RFC 5545: content lines longer than 75 octets are folded with CRLF + space.
// All text here is ASCII, so characters equal octets.
function fold(line: string): string {
  const parts: string[] = [];
  for (let i = 0; i < line.length; i += 74) parts.push(line.slice(i, i + 74));
  return parts.join('\r\n ');
}

function dailyEvent(id: string, hour: number, summary: string, description: string): string[] {
  return [
    'BEGIN:VEVENT',
    `UID:system-${id}@bapakrt-system.expo.app`,
    'DTSTAMP:20260101T000000Z',
    // Floating time (no zone): fires at this hour in whatever time zone the phone is in.
    `DTSTART:20260101T${pad(hour)}0000`,
    'DURATION:PT10M',
    'RRULE:FREQ=DAILY',
    `SUMMARY:${escapeText(summary)}`,
    `DESCRIPTION:${escapeText(`${description}\n${APP_URL}`)}`,
    `URL:${APP_URL}`,
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(summary)}`,
    'TRIGGER:PT0S',
    'END:VALARM',
    'END:VEVENT',
  ];
}

export function buildReminderCalendar(morningHour: number, warningHour: number): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SYSTEM//Daily Quest//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:SYSTEM',
    ...dailyEvent(
      'morning',
      morningHour,
      '[DAILY QUEST] Has arrived',
      'Preparations to Become Powerful. Open SYSTEM and complete it before midnight.'
    ),
    ...dailyEvent(
      'evening',
      warningHour,
      '[WARNING] Daily Quest',
      'Done yet? If not, the Penalty Zone awaits at midnight.'
    ),
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}
