/**
 * titleBar.js: the eyebrow, page title and intro under the site header,
 * the week picker (‹ WEEK OF OCT 24–30, 2026 ›) and "Cite this page".
 *
 * The title and intro change with the tab. The week picker and Cite button
 * only show on the tabs that are about one week (Overview, GSI Map).
 *
 * Reads:  state.tab, state.week
 * Writes: week, cite
 * DOM:    #titleBar
 */
import { byId, onAction } from "../ui/dom.js";
import { weekLabel, addDays } from "../model/weeks.js";

const QUOTE_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M7 7h4v4c0 3-1.5 5-4 6M15 7h4v4c0 3-1.5 5-4 6"></path></svg>`;

/** Title and intro per tab. Intro text may contain HTML (written here, not from data). */
function copyFor(tab, ctx) {
  const n = ctx.cfg.entities.filter((e) => e.level === "country").length;
  return {
    overview: ["Weekly Global Forecast Overview", `The week at a glance: GSI movements, the incidents that drove them and the unit's analysis, across ${n} spotlight countries, four regions and two global themes.`],
    map: ["Geopolitical Stability Index", `Country-level GSI for ${n} spotlight countries, updated every Friday by the Geopolitical Forecasting and Analysis Unit. <a href="#method" data-action="method">How GSI works</a>`],
    feed: ["Event Feed", `Every incident the unit has recorded and scored in ${ctx.gsi.latestWeek.slice(0, 4)}, searchable and filterable.`],
    reports: ["Reports", "Weekly Forecast Monitors, quarterly forecasts and podcast episodes from the Geopolitical Forecasting and Analysis Unit."],
    alerts: ["Alerts", "Get notified when a country, region or theme crosses a threshold, or when a severe incident is recorded."]
  }[tab];
}

export function createTitleBar(ctx) {
  const { store, gsi } = ctx;
  const el = byId("titleBar");
  const first = gsi.weeks[0];
  const last = gsi.latestWeek;

  onAction(el, {
    prev: () => store.set({ week: addDays(store.get().week, -7), ev: null }),
    next: () => store.set({ week: addDays(store.get().week, 7), ev: null }),
    cite: () => store.set({ cite: "page" }),
    method: (a, ev) => {
      ev.preventDefault();
      const d = byId("method")?.querySelector("details");
      if (d) { d.open = true; d.scrollIntoView({ behavior: "smooth", block: "start" }); }
    }
  });

  function render(state) {
    const [title, intro] = copyFor(state.tab, ctx);
    const weekly = state.tab === "overview" || state.tab === "map";
    el.innerHTML = `
      <div class="title-block">
        <span class="eyebrow gold">GEOPOLITICAL FORECASTS · SUBSCRIBER</span>
        <h1>${title}</h1>
        <p>${intro}</p>
      </div>
      ${weekly ? `
      <div class="title-actions">
        <div class="week-picker" role="group" aria-label="Week shown">
          <button data-action="prev" aria-label="Previous week" ${state.week <= first ? "disabled" : ""}>‹</button>
          <span class="label" aria-live="polite">${weekLabel(state.week)}</span>
          <button data-action="next" aria-label="Next week" ${state.week >= last ? "disabled" : ""}>›</button>
        </div>
        <button class="btn gold" data-action="cite" style="min-height:44px;font-size:14px;font-weight:500;letter-spacing:0.4px">${QUOTE_ICON}Cite this page</button>
      </div>` : ""}`;
  }

  return { render };
}
