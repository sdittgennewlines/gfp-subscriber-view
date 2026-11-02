/**
 * eventDetail.js: the full view of one incident. Shared by the GSI Map
 * (right of the event list) and the Event Feed.
 *
 *   date | LOCATION | TYPE
 *   Title
 *   Scenario · Severity · Scope · Category
 *   [cross-link callout, e.g. Mass Atrocities Monitor (placeholder)]
 *   Description
 *   WHERE THIS EVENT MOVED THE GSI           Headline score
 *     COUNTRY   Iran                 −30     (click a name to open it on the map)
 *     REGION    Middle East & ...    −10
 *   SOURCE  apnews.com ↗      RELATED NEW LINES WORK  [placeholder]
 *   [Cite this event] [Share]
 *
 * renderEventDetail(ctx, inc) returns HTML. The buttons carry data-action
 * values that the host component handles with eventDetailActions(ctx):
 *   cite-event, share-event, goto (data-key = entity key)
 */
import { esc, safeUrl } from "../ui/dom.js";
import { fmtInt, badgeStyle, domain } from "../ui/format.js";
import { slashDate } from "../model/weeks.js";
import { share } from "../actions/share.js";

const QUOTE_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M7 7h4v4c0 3-1.5 5-4 6M15 7h4v4c0 3-1.5 5-4 6"></path></svg>`;
const KIND = { country: "COUNTRY", region: "REGION", theme: "GLOBAL THEME" };

/** The placeholder cross-link (config.crossLinks) that applies to an incident, if any. */
export const crossLinkFor = (cfg, inc) =>
  cfg.crossLinks.find((x) =>
    x.places.includes(inc.location) &&
    (!x.titleIncludes || x.titleIncludes.some((w) => inc.title.toLowerCase().includes(w.toLowerCase())))
  ) || null;

export function renderEventDetail(ctx, inc) {
  const { cfg } = ctx;
  const xl = crossLinkFor(cfg, inc);

  // Every entity this incident counts toward, countries first, in config order.
  const order = { country: 0, region: 1, theme: 2 };
  const moved = cfg.entities
    .filter((e) => e.key in inc.scores)
    .sort((a, b) => order[a.level] - order[b.level])
    .map((e) => `
      <div class="row">
        <span class="kind">${KIND[e.level]}</span>
        <button class="nm" data-action="goto" data-key="${e.key}" title="Open ${esc(e.name)} on the GSI map">${esc(e.name)}</button>
        <span class="badge lg" style="${badgeStyle(inc.scores[e.key])}">${fmtInt(inc.scores[e.key])}</span>
      </div>`).join("");

  const related = cfg.relatedPlaceholder.map((r) => `<a href="${esc(safeUrl(r.url))}">${esc(r.title)}</a>`).join("");

  return `
    <div class="crumbs"><span>${slashDate(inc.date)}</span><span class="bar" aria-hidden="true">|</span><span>${esc(inc.location.toUpperCase())}</span><span class="bar" aria-hidden="true">|</span><span>${esc(inc.type.toUpperCase())}</span></div>
    <h3>${esc(inc.title)}</h3>
    <div class="chips">
      ${inc.scenario ? `<span>Scenario: ${esc(inc.scenario)}</span>` : ""}
      ${inc.severity ? `<span>Severity: ${esc(inc.severity)}</span>` : ""}
      ${inc.scope ? `<span>Scope: ${esc(inc.scope)}</span>` : ""}
      ${inc.category ? `<span>Category: ${esc(inc.category)}</span>` : ""}
    </div>
    ${xl ? `
    <div class="xlink">
      <span style="display:flex;flex-direction:column;gap:4px"><span class="k">ALSO TRACKED BY NEW LINES</span><span class="txt">${esc(xl.text)}</span></span>
      <a class="btn dark" href="${esc(safeUrl(xl.url))}" style="min-height:44px">${esc(xl.cta)}</a>
    </div>` : ""}
    <p class="desc">${esc(inc.description)}</p>
    <div class="moved">
      <div class="hd">
        <span class="eyebrow">WHERE THIS EVENT MOVED THE GSI</span>
        <span style="display:flex;align-items:center;gap:8px;font-size:13px">Headline score <span class="badge lg" style="${badgeStyle(inc.gsi)}">GSI ${fmtInt(inc.gsi)}</span></span>
      </div>
      ${moved || `<div class="none">Not counted toward any spotlight country, region or theme.</div>`}
    </div>
    <div class="ev-meta">
      <span><span class="eyebrow muted">SOURCE</span>${inc.url ? `<a href="${esc(safeUrl(inc.url))}" target="_blank" rel="noopener">${esc(domain(inc.url))} ↗</a>` : `<span class="muted">No link recorded</span>`}</span>
      <span><span class="eyebrow muted">RELATED NEW LINES WORK</span>${related}</span>
    </div>
    <div class="ev-actions">
      <button class="btn gold" data-action="cite-event">${QUOTE_ICON}Cite this event</button>
      <button class="btn" data-action="share-event">Share</button>
    </div>`;
}

/**
 * Click handlers for the buttons above, to merge into a host's onAction map.
 * `currentId()` returns the id of the incident being shown.
 */
export function eventDetailActions(ctx, currentId) {
  const { store, cfg } = ctx;
  return {
    "cite-event": () => store.set({ ev: currentId(), cite: "event" }),
    "share-event": () => {
      const inc = ctx.byId.get(currentId());
      store.set({ ev: currentId() });
      share(store.get(), cfg, inc?.title || "Geopolitical Forecasting Platform");
    },
    goto: (b) => {
      // Open the entity on the map, at the week of this incident, with the incident open.
      const e = ctx.gsi.entity(b.dataset.key);
      const inc = ctx.byId.get(currentId());
      store.set({ tab: "map", level: e.level === "country" ? "country" : "region", sel: e.key, week: inc ? inc.week : store.get().week, ev: currentId() });
      document.getElementById("screen-map")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };
}
