/**
 * profilePanel.js: the profile box of the GSI Map (right-hand column on wide
 * screens; above the events, laid out horizontally, on narrower ones).
 *
 * It is built from four blocks (.pblock), which the CSS stacks or places
 * side by side depending on the width:
 *   1. name + GSI box (value, band, change, scale)
 *   2. country profile (or, for a region/theme, what it covers)
 *   3. weekly trend chart, with extreme incidents marked
 *   4. related work + actions
 * A country without a GSI gets: name + an explanation, its profile (if we
 * have one), related work, actions.
 *
 * Trend markers: incidents scored at least config.trendMarkerThreshold away
 * from zero for this entity are drawn as dashed vertical lines. Hovering the
 * chart names them; clicking a marked week opens that incident below.
 *
 * Country profiles come from data/profiles.json, shown exactly as supplied.
 *
 * Reads:  state.sel, state.week, state.range
 * Writes: range, cite, ev, tab + alertDraft ("Set alert")
 * DOM:    #profilePanel
 */
import { byId, esc, onAction, safeUrl } from "../../ui/dom.js";
import { fmt, fmtInt, ink, tint, band, plural } from "../../ui/format.js";
import { describe } from "../../model/selection.js";
import { weekLabel, weekShort, addDays, longDate } from "../../model/weeks.js";
import { trendSvg, RANGES, nearestIndex, TREND } from "../trendChart.js";
import { showTip, hideTip } from "../../actions/tooltip.js";
import { downloadSvgAsPng, slug } from "../../actions/download.js";

const EYEBROW = { country: "SPOTLIGHT COUNTRY", region: "REGION", theme: "GLOBAL THEME", place: "COUNTRY · NO GSI" };

export function createProfilePanel(ctx) {
  const { cfg, store, gsi, places, profiles } = ctx;
  const el = byId("profilePanel");
  // The chart currently shown (kept for hover, click and download).
  let points = [];
  let markers = []; // [{ week, score, inc }]

  /** Weekly points for the trend: the chosen range, ending at the selected week. */
  function trendPoints(key, state) {
    const all = gsi.series(key).filter((p) => p.week <= state.week);
    const n = RANGES[state.range];
    return n ? all.slice(-n) : all;
  }

  /** The entity's extreme incidents within the charted weeks. */
  function trendMarkers(key, pts) {
    if (!pts.length) return [];
    const from = pts[0].week;
    const to = pts[pts.length - 1].week;
    return gsi.scoredIncidents(key)
      .filter((inc) => inc.week >= from && inc.week <= to && Math.abs(inc.scores[key]) >= cfg.trendMarkerThreshold)
      .map((inc) => ({ week: inc.week, score: inc.scores[key], inc }));
  }

  /** The chart point under the pointer (index into `points`). */
  function pointAt(ev) {
    const svg = ev.target.closest(".trend svg");
    if (!svg || !points.length) return null;
    const r = svg.getBoundingClientRect();
    return nearestIndex(points.length, ((ev.clientX - r.left) / r.width) * TREND.W);
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
        markers,
        title: `${d.name}: weekly GSI`,
        subtitle: `${weekShort(points[0].week)} to ${weekLabel(state.week, { upper: false, prefix: "" })} · dashed lines: incidents scored ±${cfg.trendMarkerThreshold} or more`
      });
      downloadSvgAsPng(svg, TREND.W, TREND.H + 56, `${slug(`${d.name}-gsi-trend-${state.week}`)}.png`);
    }
  });

  // Hover: the week's value, plus any extreme incidents that week.
  el.addEventListener("pointermove", (ev) => {
    const i = pointAt(ev);
    if (i === null) return hideTip();
    const p = points[i];
    const extreme = markers.filter((m) => m.week === p.week);
    showTip(`<b>${weekLabel(p.week, { upper: false })}</b><br>${p.value === null ? "No incidents" : `GSI ${fmt(p.value)} · ${plural(p.n, "incident")}`}` +
      extreme.map((m) => `<br><span style="color:${m.score < 0 ? "#9E2F20" : "#1F4E8C"};font-weight:500">${fmtInt(m.score)}</span> ${esc(m.inc.title)}`).join("") +
      (extreme.length ? `<br><span style="color:#5E5A66">Click to open</span>` : ""), ev);
  });
  el.addEventListener("pointerleave", hideTip);

  // Click on a marked week: open its (most extreme) incident in the events list.
  el.addEventListener("click", (ev) => {
    const i = pointAt(ev);
    if (i === null) return;
    const hit = markers.filter((m) => m.week === points[i].week).sort((a, b) => Math.abs(b.score) - Math.abs(a.score))[0];
    if (hit) {
      store.set({ ev: hit.inc.id });
      byId("eventsPanel").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  /* ------------------------------------------------------------ blocks */

  const head = (d) => `
    <div style="display:flex;flex-direction:column;gap:4px">
      <span class="eyebrow gold">${EYEBROW[d.level]}</span>
      <span class="name">${esc(d.name)}</span>
    </div>`;

  function gsiBox(key, state) {
    const { value: v, n } = gsi.value(key, state.week);
    const prev = gsi.value(key, addDays(state.week, -7)).value;
    const change = v === null ? "No incidents were scored this week."
      : prev === null ? "No scored incidents the week before."
      : `${v > prev ? "More stable than" : v < prev ? "Less stable than" : "Unchanged from"} last week (${fmt(prev)}).`;
    return `
      <div class="gsi-box">
        <span class="eyebrow">GSI · ${weekLabel(state.week)}</span>
        <span style="display:flex;align-items:baseline;gap:6px"><span class="big" style="color:${ink(v)}">${fmt(v)}</span><span style="font-size:14px;color:var(--muted)">/ 100</span></span>
        <span class="band" style="background:${tint(v)};color:${ink(v)}">${band(v)}</span>
        <span class="chg">${change}${v !== null ? ` Based on ${plural(n, "incident")}.` : ""}</span>
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

  function coverage(entity) {
    return `
      <div class="facts"><span class="hd">COVERAGE</span>
        <p class="members" style="margin:10px 0 0">${esc(entity.note || "")}.${entity.members ? `<br><span class="muted">Shaded on the map: ${esc(entity.members.join(", "))}.</span>` : ""}</p></div>`;
  }

  function trend(key, state, name) {
    points = trendPoints(key, state);
    markers = trendMarkers(key, points);
    const t = cfg.trendMarkerThreshold;
    return `
      <div class="trend" style="display:flex;flex-direction:column;gap:8px">
        <div class="trend-hd">
          <span class="eyebrow">GSI TREND · WEEKLY</span>
          <span class="ranges" role="group" aria-label="Time span">${Object.keys(RANGES).map((r) => `<button data-action="range" data-range="${r}" aria-pressed="${r === state.range}">${r}</button>`).join("")}</span>
        </div>
        ${trendSvg(points, { label: `Weekly GSI for ${name}, ${weekShort(points[0].week)} to ${weekShort(state.week)}`, markers })}
        <div class="trend-key">
          <span><i style="border-color:#B8352B"></i>Incident scored −${t} or lower</span>
          <span><i style="border-color:#2F63A8"></i>+${t} or higher</span>
          <span>${markers.length ? `${plural(markers.length, "marked incident")} · hover for details, click to open` : "None in this period"}</span>
        </div>
      </div>`;
  }

  const related = () => `
    <div class="related" style="display:flex;flex-direction:column;gap:4px">
      <span class="block-hd">RELATED NEW LINES WORK</span>
      ${cfg.relatedPlaceholder.map((r) => `<a href="${esc(safeUrl(r.url))}"><span class="t">${esc(r.title)}</span><span class="m">${esc(r.meta)}</span></a>`).join("")}
    </div>`;

  const block = (html) => (html.trim() ? `<div class="pblock">${html}</div>` : "");

  /* ------------------------------------------------------------ render */
  function render(state) {
    const d = describe(ctx, state);

    if (d.kind === "entity") {
      el.innerHTML =
        block(head(d) + gsiBox(d.entity.key, state)) +
        block(d.level === "country" ? facts(d.place) : coverage(d.entity)) +
        block(trend(d.entity.key, state, d.name)) +
        block(related() + `
          <div class="aside-actions">
            <button class="btn gold" data-action="alert">Set alert</button>
            <button class="btn" data-action="chart">Download chart</button>
            <button class="btn" data-action="cite">Cite</button>
          </div>`);
      return;
    }

    // A country without a GSI.
    points = [];
    markers = [];
    const incs = places.incidentsAt(d.place).filter((i) => i.week <= state.week);
    const thisWeek = incs.filter((i) => i.week === state.week).length;
    el.innerHTML =
      block(head(d) + `
        <div class="nogsi">${esc(d.name)} isn't one of the ${cfg.entities.filter((e) => e.level === "country").length} spotlight countries, so it has no GSI of its own.
          Its incidents still count toward the GSI of the countries, regions and themes the analysts tied them to: open an incident to see which.
          <br><br><b style="font-weight:500">${plural(incs.length, "incident")}</b> on record${incs.length ? `, most recently ${longDate(incs[0].date)}` : ""}${thisWeek ? `; ${thisWeek} this week` : ""}.</div>`) +
      block(facts(d.place)) +
      block(related() + `<div class="aside-actions"><button class="btn" data-action="cite">Cite</button></div>`);
  }

  return { render };
}
