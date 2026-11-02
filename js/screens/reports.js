/**
 * reports.js: the REPORTS tab.
 *
 *   Weekly Forecast Monitors   one per published week, newest first, with
 *                              that week's incident count and the countries
 *                              that moved most (links are placeholders)
 *   Quarterly forecasts        from data/reports.json
 *   Podcast                    from data/reports.json
 *
 * Reads:  nothing from state (the list doesn't change with the selected week)
 * Writes: tab, week (opening a week on the Overview)
 * DOM:    #screen-reports
 * Data:   data/reports.json (edit it to replace the placeholder links)
 */
import { byId, esc, onAction, safeUrl } from "../ui/dom.js";
import { fmt, badgeStyle, plural } from "../ui/format.js";
import { weekLabel, longDate } from "../model/weeks.js";
import { weeklyMonitorUrl } from "../components/map/reportsStrip.js";

const WEEKS_SHOWN = 12; // weekly monitors listed before "Show all"

export function createReports(ctx) {
  const { store, gsi, reports, incidents } = ctx;
  const el = byId("screen-reports");
  let showAll = false;

  onAction(el, {
    week: (b) => { store.set({ tab: "overview", week: b.dataset.week }); window.scrollTo({ top: 0 }); },
    all: () => { showAll = true; render(); }
  });

  /** One weekly monitor row: title, incident count, the two biggest country GSI values that week. */
  function weekly(week) {
    const n = incidents.filter((i) => i.week === week).length;
    const ranked = gsi.ranking("country", week).filter((r) => r.value !== null);
    const extremes = [ranked[0], ranked[ranked.length - 1]].filter((r, i, a) => r && a.indexOf(r) === i);
    return `
      <div class="rep-item">
        <span style="display:flex;flex-direction:column;gap:4px">
          <a class="t" href="${esc(safeUrl(weeklyMonitorUrl(reports, week)))}">${esc(reports.weeklyMonitor.label)}, ${longDate(week)}</a>
          <span class="m">${weekLabel(week, { upper: false })} · ${plural(n, "incident")} · <span class="placeholder">PDF link to be added</span></span>
        </span>
        <span class="stats">
          ${extremes.map((r) => `<span>${esc(r.entity.name)} <span class="badge" style="${badgeStyle(r.value)}">${fmt(r.value)}</span></span>`).join("")}
          <button class="btn" data-action="week" data-week="${week}">Open week</button>
        </span>
      </div>`;
  }

  function render() {
    const weeks = [...gsi.weeks].reverse();
    const shown = showAll ? weeks : weeks.slice(0, WEEKS_SHOWN);
    el.innerHTML = `
      <div class="rep-section">
        <h2>Weekly Forecast Monitors</h2>
        <p style="margin:-4px 0 14px;font-size:14.5px;color:var(--ink-2)">The full weekly report behind each week's GSI, published every Friday.</p>
        <div class="rep-list">${shown.map(weekly).join("")}</div>
        ${!showAll && weeks.length > WEEKS_SHOWN ? `<button class="more" data-action="all">Show all ${weeks.length} weeks</button>` : ""}
      </div>
      <div class="rep-section">
        <h2>Quarterly forecasts</h2>
        <div class="rep-list">${reports.quarterly.map((q) => `
          <div class="rep-item">
            <span style="display:flex;flex-direction:column;gap:4px;max-width:760px">
              <a class="t" href="${esc(safeUrl(q.url))}">${esc(q.title)}</a>
              <span class="m">${esc(longDate(q.date))}</span>
              <span style="font-size:14px;line-height:1.6" class="placeholder">${esc(q.summary)}</span>
            </span>
            <a class="btn gold" href="${esc(safeUrl(q.url))}">Read online</a>
          </div>`).join("")}</div>
      </div>
      <div class="rep-section">
        <h2>Podcast</h2>
        <div class="rep-list">${reports.podcast.map((p) => `
          <div class="rep-item">
            <span style="display:flex;flex-direction:column;gap:4px">
              <a class="t" href="${esc(safeUrl(p.url))}">${esc(p.title)}</a>
              <span class="m">${esc(longDate(p.date))} · ${esc(p.duration)}</span>
            </span>
            <a class="btn" href="${esc(safeUrl(p.url))}">Listen</a>
          </div>`).join("")}</div>
      </div>`;
  }

  let drawn = false;
  return { render: () => { if (!drawn) { drawn = true; render(); } } };
}
