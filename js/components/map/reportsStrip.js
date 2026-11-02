/**
 * reportsStrip.js: "This week's New Lines reports" at the bottom of the GSI
 * Map: the week's Weekly Forecast Monitor, the latest quarterly forecast and
 * the latest podcast episode. All placeholders except the Q4 quarterly.
 *
 * Reads:  state.week
 * DOM:    #reportsStrip
 * Data:   data/reports.json
 */
import { byId, esc, safeUrl } from "../../ui/dom.js";
import { longDate } from "../../model/weeks.js";

/** The weekly monitor link for a week (placeholder template in reports.json). */
export const weeklyMonitorUrl = (reports, week) => reports.weeklyMonitor.urlTemplate.replace("{week}", week);

export function createReportsStrip(ctx) {
  const { reports } = ctx;
  const el = byId("reportsStrip");

  function render(state) {
    const quarterly = reports.quarterly.filter((q) => q.date <= state.week).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    const pod = reports.podcast[0];
    el.innerHTML = `
      <h2 class="section-h2">This week's New Lines reports</h2>
      <div class="cards">
        <a class="rcard" href="${esc(safeUrl(weeklyMonitorUrl(reports, state.week)))}">
          <span class="k">WEEKLY FORECAST MONITOR</span>
          <span class="t">Weekly Forecast Monitor, ${longDate(state.week).replace(/^(\w{3})\w*/, "$1")}</span>
          <span class="m">FULL REPORT · PDF</span>
        </a>
        ${quarterly ? `<a class="rcard" href="${esc(safeUrl(quarterly.url))}">
          <span class="k">QUARTERLY FORECAST</span>
          <span class="t">${esc(quarterly.title)}</span>
          <span class="m">${esc(longDate(quarterly.date).toUpperCase())} · READ ONLINE</span>
        </a>` : ""}
        ${pod ? `<a class="rcard" href="${esc(safeUrl(pod.url))}">
          <span class="k">PODCAST</span>
          <span class="t">${esc(pod.title)}</span>
          <span class="m">LISTEN · ${esc(pod.duration)}</span>
        </a>` : ""}
      </div>`;
  }

  return { render };
}
