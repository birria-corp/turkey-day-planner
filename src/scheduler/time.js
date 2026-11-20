// Local-time stamp helpers. Stamps are "YYYY-MM-DDTHH:mm" strings in local time
// (never UTC), so they sort as text and the day never shifts.

const pad = (n) => String(n).padStart(2, '0');

/** "2026-11-26T13:00" -> local Date. */
export function parseStamp(stamp) {
  const [datePart, timePart] = stamp.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = timePart.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

/** Local Date -> "YYYY-MM-DDTHH:mm". */
export function toStamp(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Stamp plus minutes -> stamp. */
export function addMinutes(stamp, minutes) {
  const d = parseStamp(stamp);
  d.setMinutes(d.getMinutes() + minutes);
  return toStamp(d);
}

/** Day key + minutes since midnight -> stamp. ("2026-11-26", 810) -> "2026-11-26T13:30". */
export function stampAt(key, minutes) {
  return `${key}T${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/** Minutes from stamp a to stamp b (negative when b is earlier). */
export function diffMinutes(a, b) {
  return Math.round((parseStamp(b) - parseStamp(a)) / 60000);
}

/** "2026-11-26T15:00" -> "Thursday, November 26, 2026 at 3:00 PM". */
export function fmtWhen(stamp) {
  const d = parseStamp(stamp);
  const day = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  return `${day} at ${fmtTime(stamp)}`;
}

/** "2026-11-26T13:00" -> "1:00 PM". */
export function fmtTime(stamp) {
  const d = parseStamp(stamp);
  const h = d.getHours();
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${pad(d.getMinutes())} ${h < 12 ? 'AM' : 'PM'}`;
}

/** "2026-11-26T13:00" -> "2026-11-26". */
export const dayKey = (stamp) => stamp.slice(0, 10);

/** "2026-11-26" -> "Thursday, November 26". */
export function fmtDayHeading(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}
