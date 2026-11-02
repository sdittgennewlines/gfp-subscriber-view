/**
 * profilePanel.js: the right-hand column of the GSI Map.
 *
 * For a spotlight country:  GSI box (value, band, change, scale) → country
 *                           profile → weekly trend → related work → actions
 * For a region or theme:    GSI box → what it covers → trend → related → actions
 * For a country with no GSI: a note explaining why → country profile (if we
 *                           have one) → related work → actions
 *
 * Country profiles come from data/profiles.json, shown exactly as supplied.
 *
 * Reads:  state.sel, state.week, state.range
 * Writes: range, cite, tab (+ alertDraft) for "Set alert"
 * DOM:    #profilePanel
 */
import { byId, esc, onAction, safeUrl } from "../../ui/dom.js";
import { fmt, ink, tint, band, plural } from "../../ui/format.js";
import { describe } from "../../model/selection.js";
import { weekLabel, weekShort, addDays, longDate } from "../../model/weeks.js";
import { trendSvg, RANGES, nearestIndex, TREND } from "../trendChart.js";
import { showTip, hideTip } from "../../actions/tooltip.js";
import { downloadSvgAsPng, slug } from "../../actions/download.js";

const EYEBROW = { country: "SPOTLIGHT COUNTRY", region: "REGION", theme: "GLOBAL THEME", place: "COUNTRY · NO GSI" };

export function createProfilePanel(ctx) {
  const { cfg, store, gsi, places, profiles } = ctx;
  const el = byId("profilePanel");
  let points = []; // the trend chart's current points (for hover + download)

  /** Weekly points for the trend: the chosen range, ending at the selected week. */
  function trendPoints(key, state) {
    const all = gsi.series(key).filter((p) => p.week <= state.week);
    const n = RANGES[state.range];
    return n ? all.slice(-n) : all;
  }

  onAction(el, {
    range: (b) => store.set({ range: b.dataset.range }),
    cite: () => store.set({ cite: "page" }),
    alert: () => store.set({ tab: "alerts", alertDraft: { target: store.get().sel } }),
    chart: () => {
      const state = store.get();
      const d = describe(ctx, state);
      const svg = trendSvg(points, {
        label: `Weekly GSI for ${d.name}`,
        title: `${d.name}: weekly GSI`,
        subtitle: `${weekShort(points[0].week)} to ${weekLabel(state.week, { upper: false, prefix: "" })} · New Lines Institute`
      });
      downloadSvgAsPng(svg, TREND.W, TREND.H + 56, `${slug(`${d.name}-gsi-trend-${state.week}`)}.png`);
    }
  });

  // Hover over the chart: the nearest week's value.
  el.addEventListener("pointermove", (ev) => {
    const svg = ev.target.closest(".trend svg");
    if (!svg || !points.length) return hideTip();
    const r = svg.getBoundingClientRect();
    const vx = ((ev.clientX - r.left) / r.width) * TREND.W;
    const p = points[nearestIndex(points.length, vx)];
    showTip(`<b>${weekLabel(p.week, { upper: false })}</b><br>${p.value === null ? "No events" : `GSI ${fmt(p.value)} · ${plural(p.n, "event")}`}`, ev);
  });
  el.addEventListener("pointerleave", hideTip);

  /* ------------------------------------------------------------ pieces */

  function gsiBox(key, state) {
    const { value: v, n } = gsi.value(key, state.week);
    const prev = gsi.value(key, addDays(state.week, -7)).value;
    const change = v === null ? "No events were scored this week."
      : prev === null ? "No scored events the week before."
      : `${v > prev ? "More stable than" : v < prev ? "Less stable than" : "Unchanged from"} last week (${fmt(prev)}).`;
    return `
      <div class="gsi-box">
        <span class="eyebrow">GSI · ${weekLabel(state.week)}</span>
        <span style="display:flex;align-items:baseline;gap:6px"><span class="big" style="color:${ink(v)}">${fmt(v)}</span><span style="font-size:14px;color:var(--muted)">/ 100</span></span>
        <span class="band" style="background:${tint(v)};color:${ink(v)}">${band(v)}</span>
        <span class="chg">${change}${v !== null ? ` Based on ${plural(n, "event")}.` : ""}</span>
        <div class="scale-bar"><div class="grad"></div>${v !== null ? `<div class="mark" style="left:${(v + 100) / 2}%"></div>` : ""}</div>
        <div class="scale-ends"><span>−100</span><span>Status quo</span><span>+100</span></div>
      </div>`;
  }

  function facts(placeName) {
    const p = profiles?.countries?.[placeName];
    if (!p) return "";
    const rows = profiles.fields.map((f) => `<div class="row"><span class="k">${esc(f.label)}</span><span class="v">${esc(p[f.key] ?? "N/A")}</span></div>`).join("");
    return `
      <div class="facts">
        <span class="hd">COUNTRY PROFILE</span>
        ${rows}
        <p class="summary">[Brief country summary, written by the Geopolitical Forecasting and Analysis Unit]</p>
        <span class="src">${esc(profiles.sources)}</span>
      </div>`;
  }

  function trend(key, state, name) {
    points = trendPoints(key, state);
    return `
      <div class="trend" style="display:flex;flex-direction:column;gap:8px">
        <div class="trend-hd">
          <span class="eyebrow">GSI TREND · WEEKLY</span>
          <span class="ranges" role="group" aria-label="Time span">${Object.keys(RANGES).map((r) => `<button data-action="range" data-range="${r}" aria-pressed="${r === state.range}">${r}</button>`).join("")}</span>
        </div>
        ${trendSvg(points, { label: `Weekly GSI for ${name}, ${weekShort(points[0].week)} to ${weekShort(state.week)}` })}
      </div>`;
  }

  const related = () => `
    <div class="related" style="display:flex;flex-direction:column;gap:4px">
      <span class="block-hd">RELATED NEW LINES WORK</span>
      ${cfg.relatedPlaceholder.map((r) => `<a href="${esc(safeUrl(r.url))}"><span class="t">${esc(r.title)}</span><span class="m">${esc(r.meta)}</span></a>`).join("")}
    </div>`;

  /* ------------------------------------------------------------ render */
  function render(state) {
    const d = describe(ctx, state);
    let body = "";

    if (d.kind === "entity") {
      const coverage = d.level === "country" ? facts(d.place) : `
        <div class="facts"><span class="hd">COVERAGE</span>
          <p class="members" style="margin:10px 0 0">${esc(d.entity.note || "")}${d.entity.members ? `.<br><span class="muted">Shaded on the map: ${esc(d.entity.members.join(", "))}.</span>` : "."}</p></div>`;
      body = gsiBox(d.entity.key, state) + coverage + trend(d.entity.key, state, d.name) + related() + `
        <div class="aside-actions">
          <button class="btn gold" data-action="alert">Set alert</button>
          <button class="btn" data-action="chart">Download chart</button>
          <button class="btn" data-action="cite">Cite</button>
        </div>`;
    } else {
      points = [];
      const incs = places.incidentsAt(d.place).filter((i) => i.week <= state.week);
      const thisWeek = incs.filter((i) => i.week === state.week).length;
      body = `
        <div class="nogsi">${esc(d.name)} isn't one of the ${cfg.entities.filter((e) => e.level === "country").length} spotlight countries, so it has no GSI of its own.
          Its incidents still count toward the GSI of the countries, regions and themes the analysts tied them to: open an incident to see which.
          <br><br><b style="font-weight:500">${plural(incs.length, "incident")}</b> on record${incs.length ? `, most recently ${longDate(incs[0].date)}` : ""}${thisWeek ? `; ${thisWeek} this week` : ""}.</div>
        ${facts(d.place)}
        ${related()}
        <div class="aside-actions"><button class="btn" data-action="cite">Cite</button></div>`;
    }

    el.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:4px">
        <span class="eyebrow gold">${EYEBROW[d.level]}</span>
        <span class="name">${esc(d.name)}</span>
      </div>${body}`;
  }

  return { render };
}
