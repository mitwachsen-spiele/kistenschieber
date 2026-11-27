// Kalender: Wann beginnt ein Tag in einer Zeitzone? Für Türchen, die an einem Tag aufgehen (Adventskalender der Level).
// Rein und browser-sicher: Die Zeitzone rechnet Intl aus, samt Sommerzeit; die Uhrzeit des Geräts spielt keine Rolle.

/** Abstand der Zeitzone zu UTC zum Zeitpunkt t, in ms (Berlin im Winter +3600000) */
function offset(t: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(t));
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
  const wall = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return wall - Math.floor(t / 1000) * 1000;
}

/** Beginn (0 Uhr) des Tages `date` (JJJJ-MM-TT) in der Zeitzone, als ms seit 1970 */
export function dayStart(date: string, timeZone: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new Error(`Kein Datum: ${date}`);
  const utc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // Erst mit dem Abstand um Mitternacht UTC schätzen, dann mit dem Abstand am geschätzten Zeitpunkt nachrechnen
  const guess = utc - offset(utc, timeZone);
  return utc - offset(guess, timeZone);
}
