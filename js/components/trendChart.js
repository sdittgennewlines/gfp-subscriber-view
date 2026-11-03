/**
 * trendChart.js: the small weekly GSI line chart in the profile panel.
 *
 * trendSvg(points, opts) returns the SVG markup. Pure function: give it the
 * weekly values and it draws them, so the same code makes the on-page chart
 * and the downloadable PNG.
 *
 *   points   [{ week, value, n }] oldest first; value null = blank week
 *            (the line breaks across blank weeks rather than dropping to 0)
 *   opts     { label, markers?, title?, subtitle? }
 *     markers  [{ week, score }] extreme incidents to mark with a vertical
 *              line in their week (red = destabilizing, blue = stabilizing;
 *              a week with both gets one line per direction, side by side)
 *     title/subtitle only for downloads
 *
 * Layout (viewBox 330 × 180): blue band above 0 (stabilizing), red band
 * below (destabilizing). The latest week is a gold dot; its value sits in
 * the right-hand margin, level with the dot, so it never covers the line.
 */
import { fmt } from "../ui/format.js";
import { shortDate } from "../model/weeks.js";
import { xml } from "../actions/download.js";

// Plot area runs from `left` to `right`; the strip from `right` to W holds the latest value.
export const TREND = { W: 330, H: 180, left: 34, right: 290, mid: 85, half: 60 };

/** Range buttons → number of weeks shown (null = everything). */
export const RANGES = { "3M": 13, "6M": 26, "1Y": 52, All: null };

const RED = "#B8352B";
const BLUE = "#2F63A8";

/** x position (viewBox units) of point i of n. Shared with nearestIndex below. */
function xOf(i, n) {
  const { left, right } = TREND;
  return n === 1 ? (left + right) / 2 : left + 10 + (i * (right - left - 20)) / (n - 1);
}

export function trendSvg(points, { label, markers = [], title = "", subtitle = "" }) {
  const { W, left, right, mid, half } = TREND;
  const head = title ? 56 : 0; // extra room on top for a download's title
  const H = TREND.H + head;
  const n = points.length;
  const x = (i) => xOf(i, n);

  // Vertical scale: ±60, widened if any week goes beyond it.
  const maxAbs = Math.max(0, ...points.filter((p) => p.value !== null).map((p) => Math.abs(p.value)));
  const lim = maxAbs <= 60 ? 60 : maxAbs <= 90 ? 90 : 100;
  const y = (v) => head + mid - (Math.max(-lim, Math.min(lim, v)) / lim) * half;
  const top = head + mid - half;
  const bottom = head + mid + half;

  // Event markers: one dashed line per week and direction.
  const index = new Map(points.map((p, i) => [p.week, i]));
  const seen = new Set();
  const markerLines = markers.filter((m) => index.has(m.week)).map((m) => {
    const dir = m.score < 0 ? "neg" : "pos";
    const key = m.week + dir;
    if (seen.has(key)) return "";
    seen.add(key);
    const bothWays = markers.some((o) => o.week === m.week && (o.score < 0) !== (m.score < 0));
    const mx = x(index.get(m.week)) + (bothWays ? (dir === "neg" ? -1.6 : 1.6) : 0);
    const c = dir === "neg" ? RED : BLUE;
    return `<line x1="${mx}" y1="${top - 6}" x2="${mx}" y2="${bottom}" stroke="${c}" stroke-width="1.4" stroke-dasharray="3 2" opacity="0.85"/>
      <path d="M${mx - 4} ${top - 12} L${mx + 4} ${top - 12} L${mx} ${top - 5} Z" fill="${c}"/>`;
  }).join("");

  // Line with gaps over blank weeks, plus dots when there's room for them.
  let line = "";
  let pen = false;
  let dots = "";
  points.forEach((p, i) => {
    if (p.value === null) { pen = false; return; }
    line += `${pen ? "L" : "M"}${x(i).toFixed(1)} ${y(p.value).toFixed(1)} `;
    pen = true;
    if (n <= 30 && i < n - 1) dots += `<circle cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="2.6" fill="#1B1725"/>`;
  });

  // Latest week: gold dot on the line, value in the right margin at the same height.
  const last = points[n - 1];
  const lastMark = last && last.value !== null
    ? `<circle cx="${x(n - 1)}" cy="${y(last.value)}" r="5" fill="#BFA359" stroke="#1B1725" stroke-width="1.5"/>
       <text x="${right + 6}" y="${y(last.value) + 4}" font-size="11.5" font-weight="700" fill="#1B1725">${fmt(last.value)}</text>`
    : `<text x="${right + 6}" y="${head + mid + 4}" font-size="10" fill="#8C8A91">no data</text>`;

  // Four date ticks spread across the range.
  const tickIdx = n <= 1 ? [0] : [...new Set([0, Math.round((n - 1) / 3), Math.round((2 * (n - 1)) / 3), n - 1])];
  const ticks = tickIdx.map((i) => `<text x="${x(i)}" y="${head + 166}" text-anchor="middle" font-size="10" fill="#5E5A66">${shortDate(points[i].week)}</text>`).join("");

  const axis = [lim, lim / 2, 0, -lim / 2, -lim]
    .map((v) => `<text x="28" y="${y(v) + 4}" text-anchor="end" font-size="10" fill="#5E5A66">${v > 0 ? "+" + v : v < 0 ? "−" + Math.abs(v) : "0"}</text>`).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${xml(label)}" font-family="Roboto, Helvetica, Arial, sans-serif">
    ${title ? `<rect width="${W}" height="${H}" fill="#FFFFFF"/><text x="0" y="20" font-size="15" font-weight="700" font-family="Georgia, serif" fill="#1B1725">${xml(title)}</text><text x="0" y="38" font-size="10.5" fill="#3E3A46">${xml(subtitle)}</text>` : ""}
    <rect x="${left}" y="${top}" width="${right - left}" height="${half}" fill="#E9EFF8"/>
    <rect x="${left}" y="${head + mid}" width="${right - left}" height="${half}" fill="#FBF1EF"/>
    <line x1="${left}" y1="${head + mid}" x2="${right}" y2="${head + mid}" stroke="#8C8A91"/>
    <line x1="${left}" y1="${y(lim / 2)}" x2="${right}" y2="${y(lim / 2)}" stroke="#DCDAD3" stroke-dasharray="3 3"/>
    <line x1="${left}" y1="${y(-lim / 2)}" x2="${right}" y2="${y(-lim / 2)}" stroke="#DCDAD3" stroke-dasharray="3 3"/>
    ${axis}${markerLines}
    <path d="${line.trim() || "M0 0"}" fill="none" stroke="#1B1725" stroke-width="2" stroke-linejoin="round"/>
    ${dots}${lastMark}${ticks}
  </svg>`;
}

/** For hover/click: the index of the point nearest an x position (in viewBox units). */
export function nearestIndex(n, vx) {
  const { left, right } = TREND;
  if (n <= 1) return 0;
  const i = Math.round(((vx - left - 10) * (n - 1)) / (right - left - 20));
  return Math.max(0, Math.min(n - 1, i));
}
