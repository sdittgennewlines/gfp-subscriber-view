/**
 * weeks.js: the GSI week (Saturday to Friday) and date helpers.
 *
 * Every date in the app is a plain "YYYY-MM-DD" string and every calculation
 * is done in UTC, so a reader's time zone can never shift an incident into
 * the wrong week.
 *
 * A week is identified by its LAST day (the Friday), e.g. "2026-10-30" is
 * the week of Saturday Oct 24 to Friday Oct 30, 2026.
 */

const DAY = 864e5;
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "YYYY-MM-DD" → Date at UTC midnight. */
export const toDate = (iso) => new Date(iso + "T00:00:00Z");

/** Date → "YYYY-MM-DD" (UTC). */
export const toIso = (d) => d.toISOString().slice(0, 10);

/** Add n days to an ISO date. */
export const addDays = (iso, n) => toIso(new Date(toDate(iso).getTime() + n * DAY));

/**
 * The week an ISO date falls in, named by the week's last day.
 * weekStartsOn uses JavaScript day numbers (0 = Sunday ... 6 = Saturday);
 * the GSI week starts on Saturday (6), so it ends on Friday.
 */
export function weekOf(iso, weekStartsOn = 6) {
  const lastDay = (weekStartsOn + 6) % 7; // 5 = Friday
  const day = toDate(iso).getUTCDay();
  return addDays(iso, (lastDay - day + 7) % 7);
}

/** Every week end from `first` to `last` inclusive, oldest first. */
export function weekRange(first, last) {
  const out = [];
  for (let w = first; w <= last; w = addDays(w, 7)) out.push(w);
  return out;
}

/** "WEEK OF OCT 24–30, 2026" (or "SEP 27 – OCT 3" across months). */
export function weekLabel(weekEnd, { upper = true, prefix = "Week of " } = {}) {
  const end = toDate(weekEnd);
  const start = new Date(end.getTime() - 6 * DAY);
  const sm = MON[start.getUTCMonth()];
  const em = MON[end.getUTCMonth()];
  const span = sm === em
    ? `${sm} ${start.getUTCDate()}–${end.getUTCDate()}`
    : `${sm} ${start.getUTCDate()} – ${em} ${end.getUTCDate()}`;
  const text = `${prefix}${span}, ${end.getUTCFullYear()}`;
  return upper ? text.toUpperCase() : text;
}

/** "Oct 24–30" (no year, no prefix): for chart axes and compact tables. */
export const weekShort = (weekEnd) => weekLabel(weekEnd, { upper: false, prefix: "" }).replace(/, \d{4}$/, "");

/** "Oct 22" */
export const shortDate = (iso) => { const d = toDate(iso); return `${MON[d.getUTCMonth()]} ${d.getUTCDate()}`; };

/** "October 22, 2026" */
export const longDate = (iso) => { const d = toDate(iso); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`; };

/** "10/22/2026" (the format the mockup's event detail uses). */
export const slashDate = (iso) => { const [y, m, d] = iso.split("-"); return `${m}/${d}/${y}`; };

export { MON, MONTHS };
