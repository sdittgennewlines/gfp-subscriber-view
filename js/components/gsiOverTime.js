/**
 * gsiOverTime.js: the Overview's "GSI over time" chart: every spotlight
 * country, region and theme across a span of weeks.
 *
 *   [Last week | Last quarter | All time]   Ending: [week of Oct 24–30 ▾]
 *
 * The reader picks the span and the end week (by default the end week
 * follows the week chosen at the top of the page). The drawing adapts to
 * how many columns there are, so it is readable at every span:
 *
 *   1 week            ranked bars left/right of zero, with value, change
 *                     and incident count (a one-column grid says little)
 *   2–16 columns      a grid with the number in every cell
 *   17+ columns       a compact colour strip, no numbers (hover a cell to
 *                     read it; the download has every number)
 *   more than 60 weeks the strip switches to months, so it never gets too
 *                     dense to read or heavy to draw: a month's GSI is the
 *                     average of all its incident scores
 *
 * Cost: at most (23 rows × 60 columns) colour cells as plain <span>s, with
 * no per-cell scripts (native tooltips, one click handler for the whole
 * Overview). The numbers are cached per span/end-week, so the chart isn't
 * recomputed when something unrelated changes.
 *
 * A component of its own (registered in main.js), so if it ever fails the
 * rest of the Overview still works. The Overview leaves an empty
 * <div id="gsiOverTime"> where it goes; this fills it after each Overview
 * render.
 *
 * Reads:  state.week (the default end week)
 * Writes: tab, sel, level, week (clicking a cell opens the GSI Map)
 * Local:  the chosen span and end week (kept while the page is open)
 * DOM:    #gsiOverTime (inside #screen-overview)
 */
import { byId, esc, onAction } from "../ui/dom.js";
import { fmt, fmtInt, fmtChange, fill, ink, plural } from "../ui/format.js";
import { weekShort, weekLabel, MON } from "../model/weeks.js";
import { downloadButton, openExport } from "../actions/exportDialog.js";
import { heatImage, divergingImage } from "../export/pngCharts.js";

export const RANGES = [
  { key: "week", label: "Last week", weeks: 1 },
  { key: "quarter", label: "Last quarter", weeks: 13 },
  { key: "all", label: "All time", weeks: Infinity }
];
const NUMBERS_UP_TO = 16; // columns: up to this many, cells show their numbers
const MONTHLY_AFTER = 60; // weeks: beyond this, "All time" is shown by month
const LEVELS = [["SPOTLIGHT COUNTRIES", "country"], ["REGIONS", "region"], ["GLOBAL THEMES", "theme"]];
const KIND = { country: "Country", region: "Region", theme: "Global theme" };
const r1 = (v) => (v === null || v === undefined ? null : Math.round(v * 10) / 10);

export function createGsiOverTime(ctx) {
  const { gsi, cfg, store } = ctx;
  let range = "quarter";
  let end = null; // null = follow the page's week
  const cache = new Map(); // "range|endWeek" → computed data

  const endWeek = (pageWeek) => (end && end <= gsi.latestWeek ? end : pageWeek);

  /* ---------------------------------------------------------- the numbers */
  /**
   * {
   *   endWeek, range,
   *   monthly: true when "All time" is long enough to group by month,
   *   periods: [{ key, label, longLabel, weeks: [week...] }]   one per column
   *   groups:  [{ label, level, rows: [{ e, values: [number|null], n: [count], change }] }]
   * }
   */
  function compute(pageWeek) {
    const ew = endWeek(pageWeek);
    const key = `${range}|${ew}`;
    if (cache.has(key)) return cache.get(key);

    const span = RANGES.find((r) => r.key === range).weeks;
    const weeks = gsi.weeks.filter((w) => w <= ew).slice(-Math.min(span, gsi.weeks.length));
    const monthly = weeks.length > MONTHLY_AFTER;

    // Columns: one per week, or one per month (a week belongs to the month of its Friday).
    let periods;
    if (!monthly) {
      periods = weeks.map((w) => ({ key: w, label: weekShort(w), longLabel: weekLabel(w, { upper: false }), weeks: [w] }));
    } else {
      const byMonth = new Map();
      for (const w of weeks) {
        const m = w.slice(0, 7);
        if (!byMonth.has(m)) byMonth.set(m, []);
        byMonth.get(m).push(w);
      }
      periods = [...byMonth.entries()].map(([m, ws]) => {
        const label = `${MON[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;
        return { key: m, label, longLabel: label, weeks: ws };
      });
    }

    // A period's GSI: the average of every incident score in it
    // (for a single week this is exactly that week's GSI).
    const periodValue = (k, p) => {
      let sum = 0;
      let n = 0;
      for (const w of p.weeks) {
        const v = gsi.value(k, w);
        if (v.value !== null) { sum += v.value * v.n; n += v.n; }
      }
      return { value: n ? sum / n : null, n };
    };

    const groups = LEVELS.map(([label, level]) => ({
      label,
      level,
      // Same order as the GSI Map's ranking: by the end week, most destabilized first.
      rows: gsi.ranking(level, ew).map((r) => {
        const vals = periods.map((p) => periodValue(r.entity.key, p));
        return { e: r.entity, values: vals.map((x) => x.value), n: vals.map((x) => x.n), change: r.change };
      })
    }));

    const data = { endWeek: ew, range, monthly, periods, groups };
    cache.set(key, data);
    return data;
  }

  /* ------------------------------------------------------------- drawing */

  /** One week: ranked bars, like the GSI Map's ranking table. */
  function barsHtml(d) {
    const head = `<div class="got-bar-row got-bar-head" aria-hidden="true">
      <span class="c-name"></span><span class="c-bar">← destabilizing · stabilizing →</span>
      <span class="c-val">GSI</span><span class="c-chg">VS WEEK BEFORE</span><span class="c-n">INCIDENTS</span></div>`;
    return head + d.groups.map((g) => `
      <div class="got-group">${g.label}</div>
      ${g.rows.map((r) => {
        const v = r.values[0];
        const w = v === null ? 0 : (Math.min(Math.abs(v), 60) / 60) * 50;
        return `<button class="got-bar-row" data-action="entity" data-key="${r.e.key}" data-week="${d.endWeek}">
          <span class="c-name">${esc(r.e.name)}</span>
          <span class="c-bar"><span class="b" style="background:${fill(v)};${v !== null && v < 0 ? "right:50%" : "left:50%"};width:${w}%"></span></span>
          <span class="c-val" style="color:${ink(v)}">${fmt(v)}</span>
          <span class="c-chg">${fmtChange(r.change)}</span>
          <span class="c-n">${r.n[0]}</span>
        </button>`;
      }).join("")}`).join("");
  }

  /** 2–16 columns: a grid with numbers (the original heat table). */
  function gridHtml(d) {
    const row = (r) => `<tr><th class="rowh" scope="row"><button class="link" data-action="entity" data-key="${r.e.key}">${esc(r.e.name)}</button></th>${r.values.map((v, i) => {
      const p = d.periods[i];
      const label = `${r.e.name}, ${p.longLabel}: ${v === null ? "no incidents" : `GSI ${fmt(v)} (${plural(r.n[i], "incident")})`}`;
      return `<td><button data-action="entity" data-key="${r.e.key}" data-week="${p.weeks[p.weeks.length - 1]}" aria-label="${esc(label)}" title="${esc(label)}" ${v === null ? 'class="blank">·' : `style="background:${fill(v)};color:${Math.abs(v) >= 40 ? "#FFFFFF" : "#1B1725"}">${fmtInt(v)}`}</button></td>`;
    }).join("")}</tr>`;
    return `<div class="heat"><table>
      <thead><tr><th></th>${d.periods.map((p) => `<th scope="col">${esc(p.label)}</th>`).join("")}</tr></thead>
      <tbody>${d.groups.map((g) => `<tr><th colspan="${d.periods.length + 1}" class="got-group-th">${g.label}</th></tr>` + g.rows.map(row).join("")).join("")}</tbody>
    </table></div>`;
  }

  /** 17+ columns: compact colour strip, a label at each new month. */
  function stripHtml(d) {
    const n = d.periods.length;
    const cols = `grid-template-columns: minmax(150px, 200px) repeat(${n}, minmax(0, 1fr))`;
    // Month labels: weekly strip → at the first week of each month; monthly strip → every 3rd month.
    const heads = d.periods.map((p, i) => {
      let lab = "";
      if (d.monthly) lab = i % 3 === 0 ? p.label : "";
      else if (i === 0 || p.key.slice(0, 7) !== d.periods[i - 1].key.slice(0, 7)) lab = MON[Number(p.key.slice(5, 7)) - 1];
      return `<span class="got-h">${lab}</span>`;
    }).join("");
    const rows = d.groups.map((g) => `<span class="got-gl" style="grid-column: 1 / -1">${g.label}</span>` + g.rows.map((r) =>
      `<button class="got-name link" data-action="entity" data-key="${r.e.key}">${esc(r.e.name)}</button>` +
      r.values.map((v, i) => {
        const p = d.periods[i];
        const tip = `${r.e.name}, ${p.longLabel}: ${v === null ? "no incidents" : `GSI ${fmt(v)}`}`;
        return `<span class="got-c${v === null ? " blank" : ""}" data-action="entity" data-key="${r.e.key}" data-week="${p.weeks[p.weeks.length - 1]}" title="${esc(tip)}"${v === null ? "" : ` style="background:${fill(v)}"`}></span>`;
      }).join("")).join("")).join("");
    return `<div class="got-strip" style="${cols}" role="img" aria-label="GSI for every spotlight country, region and theme, ${esc(d.periods[0].longLabel)} to ${esc(d.periods[n - 1].longLabel)}. Use the download for the numbers.">
      <span></span>${heads}${rows}</div>
      <div class="got-key">${cfg.scale.map((s) => `<i style="background:${s.fill}" title="${esc(s.label)}"></i>`).join("")}
        <span>Destabilizing → stabilizing · dashed = no incidents · hover a cell for its value${d.monthly ? " · shown by month" : ""}</span></div>`;
  }

  /* --------------------------------------------------------------- public */

  function html(pageWeek) {
    const d = compute(pageWeek);
    const n = d.periods.length;
    const view = n === 1 ? barsHtml(d) : n <= NUMBERS_UP_TO ? gridHtml(d) : stripHtml(d);
    const options = [...gsi.weeks].reverse().map((w) => `<option value="${w}"${w === d.endWeek ? " selected" : ""}>${weekLabel(w, { upper: false, prefix: "" })}</option>`).join("");
    const caption = n === 1
      ? `Each spotlight country, region and theme in the ${weekLabel(d.endWeek, { upper: false, prefix: "week of " })}, most destabilized first.`
      : `${n} ${d.monthly ? "months" : "weeks"}, ${d.periods[0].longLabel.replace(/^Week of /, "")} to ${d.periods[n - 1].longLabel.replace(/^Week of /, "")}. Rows sorted by the GSI in the last week. Select a ${n <= NUMBERS_UP_TO ? "cell" : "cell or name"} to open it on the GSI Map.`;
    return `
      <div class="ov-box">
        <div class="ov-head"><h2>GSI over time</h2>${downloadButton("gsiOverTime").replace('data-action="download"', 'data-action="got-download"')}</div>
        <div class="got-controls">
          <div class="switch" role="group" aria-label="Time span">
            ${RANGES.map((r) => `<button data-action="got-range" data-range="${r.key}" aria-pressed="${r.key === range}">${r.label}</button>`).join("")}
          </div>
          <label class="picker">ENDING
            <select id="gotEnd">${options}</select>
          </label>
          ${end ? `<button class="cat-toggle" data-action="got-end-reset" style="padding:0">Follow the page's week</button>` : ""}
        </div>
        <span class="ov-sub" style="margin:4px 0 10px">${caption}</span>
        ${view}
      </div>`;
  }

  /** Download spec: numbers per period (CSV/Excel) and the matching picture (PNG). */
  function spec(pageWeek) {
    const d = compute(pageWeek);
    const n = d.periods.length;
    const span = n === 1 ? weekLabel(d.endWeek, { upper: false }) : `${d.periods[0].longLabel.replace(/^Week of /, "")} to ${d.periods[n - 1].longLabel.replace(/^Week of /, "")}`;
    const title = "GSI over time";
    const filename = `gsi-over-time-${range}-${d.endWeek}`;
    if (n === 1) {
      return {
        title, subtitle: span, filename,
        columns: [{ label: "Name", width: 28 }, { label: "Kind", width: 14 }, { label: "GSI", width: 10 }, { label: "Change vs previous week", width: 22 }, { label: "Incidents", width: 10 }],
        rows: d.groups.flatMap((g) => g.rows.map((r) => [r.e.name, KIND[r.e.level], r1(r.values[0]), r1(r.change), r.n[0]])),
        image: () => divergingImage({ title, subtitle: span, groups: d.groups.map((g) => ({ label: g.label, rows: g.rows.map((r) => ({ name: r.e.name, value: r.values[0], change: r.change, n: r.n[0] })) })) })
      };
    }
    return {
      title, subtitle: `${span} · ${d.monthly ? "monthly" : "weekly"} GSI`, filename,
      columns: [{ label: "Name", width: 28 }, { label: "Kind", width: 14 }, ...d.periods.map((p) => ({ label: d.monthly ? p.label : `Week ending ${p.key}`, width: d.monthly ? 11 : 20 }))],
      rows: d.groups.flatMap((g) => g.rows.map((r) => [r.e.name, KIND[r.e.level], ...r.values.map(r1)])),
      image: () => heatImage({
        title, subtitle: `${span} · ${d.monthly ? "monthly" : "weekly"} GSI`,
        columns: d.periods.map((p) => p.label),
        groups: d.groups.map((g) => ({ label: g.label, rows: g.rows.map((r) => ({ name: r.e.name, values: r.values })) }))
      })
    };
  }

  /* ------------------------------------------------------- interaction */
  // Handlers sit on the Overview screen (which stays put) rather than on
  // #gsiOverTime (which the Overview redraws). Cell and name clicks use the
  // Overview's own "entity" action, which opens the GSI Map.
  const screen = byId("screen-overview");
  const redraw = () => render(store.get());
  onAction(screen, {
    "got-range": (b) => { range = b.dataset.range; redraw(); },
    "got-end-reset": () => { end = null; redraw(); },
    "got-download": () => openExport(spec(store.get().week))
  });
  screen.addEventListener("change", (ev) => {
    if (ev.target.id !== "gotEnd") return;
    end = ev.target.value === store.get().week ? null : ev.target.value;
    redraw();
  });

  function render(state) {
    const el = byId("gsiOverTime");
    if (el) el.innerHTML = html(state.week);
  }

  return { render };
}
