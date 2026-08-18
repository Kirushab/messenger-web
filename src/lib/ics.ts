// Генератор .ics файлов для экспорта событий в Apple/Google Calendar.

function pad(n: number): string { return n.toString().padStart(2, '0'); }

function toIcsDate(iso: string, allDay = false): string {
  const d = new Date(iso);
  if (allDay) {
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
  }
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function esc(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

export interface IcsEventInput {
  uid: string;
  title: string;
  description?: string | null;
  location?: string | null;
  start: string; // ISO
  end?: string | null; // ISO
  isParty?: boolean; // тусы — одна точка времени, у поездок может быть all-day
}

export function buildIcs(event: IcsEventInput): string {
  const dtStart = toIcsDate(event.start);
  const dtEnd = event.end
    ? toIcsDate(event.end)
    : toIcsDate(new Date(new Date(event.start).getTime() + 2 * 60 * 60 * 1000).toISOString()); // +2 часа по умолчанию

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Sigmas//Messenger//RU',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.uid}@sigmas`,
    `DTSTAMP:${toIcsDate(new Date().toISOString())}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${esc(event.title)}`,
  ];
  if (event.description) lines.push(`DESCRIPTION:${esc(event.description)}`);
  if (event.location) lines.push(`LOCATION:${esc(event.location)}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadIcs(event: IcsEventInput) {
  const ics = buildIcs(event);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${event.title.replace(/[^a-zA-Zа-яА-Я0-9_-]/g, '_').slice(0, 40)}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
