// Calendar helpers. All dates are local-time Date objects at midnight (never UTC),
// so the weekday and day number never shift.

/** Thanksgiving (US) = 4th Thursday of November. Returns a local Date. */
export function thanksgivingDate(year) {
  const firstOfNov = new Date(year, 10, 1);
  const THURSDAY = 4;
  const offsetToFirstThursday = (THURSDAY - firstOfNov.getDay() + 7) % 7;
  const day = 1 + offsetToFirstThursday + 21;
  return new Date(year, 10, day);
}

/** Add whole days to a local Date without touching time of day. */
export function addDays(date, n) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + n);
  return d;
}

/**
 * Default planning range: Monday of Thanksgiving week through the Saturday after.
 * (2025: Mon Nov 24 to Sat Nov 29.)
 */
export function eventRange(year) {
  const t = thanksgivingDate(year);
  return { start: addDays(t, -3), end: addDays(t, 2) };
}

/** Every day in [start, end] with a weekday label, for column headers. */
export function daysInRange(start, end) {
  const out = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    out.push({
      date: d,
      iso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      weekday: d.toLocaleDateString('en-US', { weekday: 'long' }),
    });
  }
  return out;
}
