/**
 * reportCards.js: the week's three report cards, in a fixed order:
 *   1. Weekly Forecast Monitor (that week's)
 *   2. Podcast (latest episode)
 *   3. Quarterly Forecast (the latest one published by that week)
 *
 * Shared by the Overview (top right) and the bottom of the GSI Map.
 * reportCards(reports, week) returns the HTML of the three cards; wrap it in
 * an element with class "cards". Links come from data/reports.json and are
 * placeholders except the Q4 2026 quarterly.
 */
import { esc, safeUrl } from "../ui/dom.js";
import { longDate } from "../model/weeks.js";

/** The weekly monitor link for a week (placeholder template in reports.json). */
export const weeklyMonitorUrl = (reports, week) => reports.weeklyMonitor.urlTemplate.replace("{week}", week);

export function reportCards(reports, week) {
  const quarterly = reports.quarterly.filter((q) => q.date <= week).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const pod = reports.podcast[0];
  const card = (url, kind, title, meta) => `
    <a class="rcard" href="${esc(safeUrl(url))}">
      <span class="k">${kind}</span>
      <span class="t">${esc(title)}</span>
      <span class="m">${esc(meta)}</span>
    </a>`;
  return [
    card(weeklyMonitorUrl(reports, week), "WEEKLY FORECAST MONITOR", `Weekly Forecast Monitor, ${longDate(week).replace(/^(\w{3})\w*/, "$1")}`, "FULL REPORT · PDF"),
    pod ? card(pod.url, "PODCAST", pod.title, `LISTEN · ${pod.duration}`) : "",
    quarterly ? card(quarterly.url, "QUARTERLY FORECAST", quarterly.title, `${longDate(quarterly.date).toUpperCase()} · READ ONLINE`) : ""
  ].join("");
}
