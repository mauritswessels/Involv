/** Calendar days until the deadline, inclusive of today in the school's timezone. */
export function applicationDeadlineDays(deadline: string, now = new Date()): number {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (name: string) => Number(parts.find(p => p.type === name)?.value);
  const today = Date.UTC(part('year'), part('month') - 1, part('day'));
  return Math.round((Date.parse(`${deadline.slice(0, 10)}T00:00:00Z`) - today) / 86400000);
}
