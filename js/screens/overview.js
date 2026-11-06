/**
 * overview.js: the OVERVIEW tab, "Weekly Global Forecast Overview".
 *
 *   ┌ Analyst summary ─┬ Weekly Forecast Monitor ┬ Podcast ┬ Quarterly ┐
 *   ├──────────────────┴─────────┬───────────────┴─────────┴───────────┤
 *   │ Incidents this week │ Most destabilized │ Most stabilized        │
 *   ├─────────────────────────────────────────────────────────────────┤
 *   │ Key incidents this week                              [Download] │
 *   ├────────────────────────────────┬────────────────────────────────┤
 *   │ Biggest movers      [Download] │ Regions and global themes  [⤓] │
 *   ├────────────────────────────────┼────────────────────────────────┤
 *   │ What happened       [Download] │ Escalation balance         [⤓] │
 *   ├────────────────────────────────┴────────────────────────────────┤
 *   │ The last 8 weeks at a glance                         [Download] │
 *   └─────────────────────────────────────────────────────────────────┘
 *
 * HOW EACH CHART IS BUILT
 *   For every chart there is one *data* function (keyIncidentsData,
 *   moversData, ...) that does the counting. Its result feeds both
 *     - the HTML on the page (keyIncidentsHtml, moversHtml, ...), and
 *     - the download spec (specs.<chart>) → CSV, Excel and PNG via
 *       actions/exportDialog.js and export/pngCharts.js.
 *   So the page and every download always show the same numbers.
 *
 * "Key incidents" are picked automatically until the sheet has a Featured
 * column: the week's incidents with the largest headline scores (either
 * direction), ties broken by severity, repeats skipped.
 *
 * Everything links into the other tabs: a country opens it on the GSI Map,
 * an incident opens it in the Event Feed.
 *
 * Reads:  state.week
 * Writes: tab, sel, level, week, ev
 * DOM:    #screen-overview
 */
import { byId, esc, onAction } from "../ui/dom.js";
import { fmt, fmtInt, fmtChange, fill, ink, badgeStyle, plural } from "../ui/format.js";
import { addDays, shortDate, weekShort, weekLabel } from "../model/weeks.js";
import { reportCards } from "../components/reportCards.js";
import { openExport, downloadButton } from "../actions/exportDialog.js";
import { tableImage, barsImage, stackedImage, heatImage } from "../export/pngCharts.js";

const KEY_INCIDENTS = 8; // how many key incidents to list
const MOVERS = 6; // how many biggest movers
const HEAT_WEEKS = 8; // columns in the heat table
const BALANCE_WEEKS = 12; // weeks in the escalation-balance chart
const CATEGORY_COLOURS = ["#1B1725", "#7A6528", "#BFA359", "#8C8A91", "#DCDAD3"];
const SCENARIO_COLOURS = { Escalation: "#C4483B", "Status quo": "#ADA2D3", "De-escalation": "#3D6FB0" };
const KIND = { country: "Country", region: "Region", theme: "Global theme" };

// Round for downloads: one decimal, as shown on the page.
const r1 = (v) => (v === null || v === undefined ? null : Math.round(v * 10) / 10);

export function createOverview(ctx) {
  const { cfg, store, gsi, incidents, reports } = ctx;
  const el = byId("screen-overview");
  const sevRank = (s) => cfg.severities.indexOf(s);
  const inWeek = (week) => incidents.filter((i) => i.week === week);
  let specs = {}; // download specs for the current week, by chart id

  onAction(el, {
    // Open an entity on the GSI Map (optionally at another week).
    entity: (b) => {
      const e = gsi.entity(b.dataset.key);
      store.set({ tab: "map", level: e.level === "country" ? "country" : "region", sel: e.key, week: b.dataset.week || store.get().week, ev: null });
      window.scrollTo({ top: 0 });
    },
    // Open an incident in the Event Feed.
    incident: (b) => { store.set({ tab: "feed", ev: b.dataset.id }); window.scrollTo({ top: 0 }); },
    // A chart's Download button.
    download: (b) => specs[b.dataset.chart] && openExport(specs[b.dataset.chart])
  });

  /** A box with a heading and a Download button. */
  const box = (id, title, inner) => `
    <div class="ov-box">
      <div class="ov-head"><h2>${title}</h2>${downloadButton(id)}</div>
      ${inner}
    </div>`;

  /* ======================================================= DATA (counting) */

  function keyIncidentsData(weekIncs) {
    const seen = new Set(); // skip repeats: the sheet sometimes records one event twice under different types
    return [...weekIncs]
      .sort((a, b) => Math.abs(b.gsi ?? 0) - Math.abs(a.gsi ?? 0) || sevRank(b.severity) - sevRank(a.severity))
      .filter((i) => { const k = i.title.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
      .slice(0, KEY_INCIDENTS);
  }

  function moversData(week) {
    return cfg.entities
      .map((e) => ({ e, v: gsi.value(e.key, week).value, prev: gsi.value(e.key, addDays(week, -7)).value, c: gsi.change(e.key, week) }))
      .filter((r) => r.c !== null && Math.abs(r.c) >= 0.05)
      .sort((a, b) => Math.abs(b.c) - Math.abs(a.c))
      .slice(0, MOVERS);
  }

  const regionsData = (week) => ["region", "theme"].flatMap((level) => gsi.ranking(level, week));

  function categoryData(weekIncs) {
    const counts = new Map();
    weekIncs.forEach((i) => counts.set(i.category || "Uncategorized", (counts.get(i.category || "Uncategorized") || 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([category, n], i) => ({ category, n, colour: CATEGORY_COLOURS[i % CATEGORY_COLOURS.length] }));
  }

  function balanceData(week) {
    const weeks = gsi.weeks.filter((w) => w <= week).slice(-BALANCE_WEEKS);
    const data = weeks.map((w) => {
      const incs = inWeek(w);
      const count = (s) => incs.filter((i) => i.scenario === s).length;
      return { w, esc: count("Escalation"), sq: count("Status quo"), de: count("De-escalation") };
    });
    const share = (d) => (d.esc + d.de ? d.esc / (d.esc + d.de) : 0);
    const now = data[data.length - 1];
    const avg = data.slice(0, -1).reduce((s, d) => s + share(d), 0) / Math.max(1, data.length - 1);
    const verdict = !now || now.esc + now.de === 0 ? "No escalations or de-escalations this week."
      : `This week ${Math.round(share(now) * 100)}% of escalation/de-escalation incidents were escalations, ${share(now) > avg + 0.05 ? "above" : share(now) < avg - 0.05 ? "below" : "close to"} the ${data.length - 1}-week average of ${Math.round(avg * 100)}%.`;
    return { data, share, verdict };
  }

  function heatData(week) {
    const weeks = gsi.weeks.filter((w) => w <= week).slice(-HEAT_WEEKS);
    const groups = [["SPOTLIGHT COUNTRIES", "country"], ["REGIONS", "region"], ["GLOBAL THEMES", "theme"]].map(([label, level]) => ({
      label, level,
      rows: gsi.ranking(level, week).map((r) => ({ e: r.entity, values: weeks.map((w) => gsi.value(r.entity.key, w).value) }))
    }));
    return { weeks, groups };
  }

  /* ================================================== HTML (the page) */

  const top = (week) => `
    <div class="ov-top">
      <div class="ov-box ov-summary">
        <h2>Analyst summary</h2>
        <p class="placeholder">[The unit's summary of the week: what moved, why, and what to watch next week. Written by the Geopolitical Forecasting and Analysis Unit for each Weekly Forecast Monitor.]</p>
      </div>
      <div class="cards">${reportCards(reports, week)}</div>
    </div>`;

  function keyFiguresHtml(week, weekIncs) {
    const ranks = gsi.ranking("country", week).filter((r) => r.value !== null);
    const worst = ranks[0];
    const best = ranks[ranks.length - 1];
    const scen = Object.keys(SCENARIO_COLOURS).map((s) => [s, weekIncs.filter((i) => i.scenario === s).length]);
    const total = weekIncs.length || 1;
    const prevN = inWeek(addDays(week, -7)).length;
    // Only call a country "most destabilized" if it's below zero, "most stabilized" if above.
    const named = (r, ok, none) => r && ok
      ? `<button class="link" data-action="entity" data-key="${r.entity.key}"><span class="v" style="color:${ink(r.value)}">${esc(r.entity.name)}</span></button><span class="s">GSI ${fmt(r.value)} · ${plural(r.n, "incident")}</span>`
      : `<span class="v">–</span><span class="s">${none}</span>`;
    return `
      <div class="stat-row">
        <div class="stat">
          <span class="eyebrow">INCIDENTS THIS WEEK</span>
          <span class="v">${weekIncs.length}</span>
          <div class="mix" aria-hidden="true">${scen.map(([s, n]) => `<span style="flex:${n / total};background:${SCENARIO_COLOURS[s]}"></span>`).join("")}</div>
          <span class="mix-legend">${scen.map(([s, n]) => `<span><i style="background:${SCENARIO_COLOURS[s]}"></i>${s} ${n}</span>`).join("")}</span>
          <span class="s">${prevN} the week before.</span>
        </div>
        <div class="stat"><span class="eyebrow">MOST DESTABILIZED</span>${named(worst, worst?.value < 0, "No spotlight country destabilized this week.")}</div>
        <div class="stat"><span class="eyebrow">MOST STABILIZED</span>${named(best, best?.value > 0, "No spotlight country stabilized this week.")}</div>
      </div>`;
  }

  const keyIncidentsHtml = (picked) => box("keyIncidents", "Key incidents this week", `
    <span class="ov-sub">The week's highest-scoring incidents. Select one to read it in the Event Feed.</span>
    <div class="key-grid">${picked.length ? picked.map((i) => `
      <button class="key-ev" data-action="incident" data-id="${i.id}">
        <span class="d">${shortDate(i.date)}</span>
        <span class="b">
          <span class="t">${esc(i.title)}</span>
          <span class="m">${esc(i.location)} · ${esc(i.type)}${i.severity ? ` · Severity: ${esc(i.severity)}` : ""}</span>
        </span>
        <span class="badge lg" style="${badgeStyle(i.gsi)};align-self:flex-start">GSI ${fmtInt(i.gsi)}</span>
      </button>`).join("") : `<p class="empty" style="padding:0">No incidents were recorded this week.</p>`}</div>`);

  const moversHtml = (rows) => box("movers", "Biggest movers", `
    <span class="block-hd" style="display:flex;justify-content:space-between"><span>CHANGE VS LAST WEEK</span><span>CHANGE · GSI</span></span>
    ${rows.length ? rows.map((r) => `
      <button class="mover" data-action="entity" data-key="${r.e.key}">
        <span class="n">${esc(r.e.name)}</span>
        <span class="r"><span style="color:${ink(r.c)};font-weight:700">${r.c > 0 ? "▲" : "▼"} ${fmtChange(r.c)}</span><span class="badge" style="${badgeStyle(r.v)}">${fmt(r.v)}</span></span>
      </button>`).join("") : `<p class="empty" style="padding:0">No week-on-week changes to show.</p>`}`);

  const regionsHtml = (rows) => box("regions", "Regions and global themes", `
    <span class="block-hd" style="display:flex;justify-content:space-between"><span>THIS WEEK</span><span>VS LAST WEEK · GSI</span></span>
    ${rows.map((r) => `
      <button class="mover" data-action="entity" data-key="${r.entity.key}">
        <span class="n">${esc(r.entity.name)}<span style="display:block;font-size:12px;color:var(--muted)">${KIND[r.entity.level]} · ${plural(r.n, "incident")}</span></span>
        <span class="r"><span>${fmtChange(r.change)}</span><span class="badge lg" style="${badgeStyle(r.value)}">${fmt(r.value)}</span></span>
      </button>`).join("")}`);

  function categoryHtml(rows) {
    const max = Math.max(1, ...rows.map((r) => r.n));
    return box("categories", "What happened", `
      <span class="block-hd">INCIDENTS THIS WEEK BY CATEGORY</span>
      ${rows.map((r) => `
        <div style="display:flex;flex-direction:column;gap:4px;padding:8px 0;border-bottom:1px solid var(--line-3)">
          <span style="display:flex;justify-content:space-between;font-size:13.5px"><span>${esc(r.category)}</span><b style="font-weight:500">${r.n}</b></span>
          <span style="height:8px;background:${r.colour};width:${(r.n / max) * 100}%"></span>
        </div>`).join("") || `<p class="empty" style="padding:0">No incidents this week.</p>`}`);
  }

  function balanceHtml(week, { data, verdict }) {
    const max = Math.max(1, ...data.map((d) => d.esc + d.sq + d.de));
    const colW = 100 / data.length;
    const bars = data.map((d, i) => {
      const h = (n) => (n / max) * 100;
      const on = d.w === week;
      return `<div class="bal-col${on ? " on" : ""}" style="width:${colW}%" title="${esc(`${weekShort(d.w)}: ${d.esc} escalation, ${d.sq} status quo, ${d.de} de-escalation`)}">
        <div class="bal-stack">
          <span style="height:${h(d.esc)}%;background:${SCENARIO_COLOURS.Escalation}"></span>
          <span style="height:${h(d.sq)}%;background:${SCENARIO_COLOURS["Status quo"]}"></span>
          <span style="height:${h(d.de)}%;background:${SCENARIO_COLOURS["De-escalation"]}"></span>
        </div>
        <span class="bal-x">${i % 3 === 0 || on ? weekShort(d.w).replace(/[–-].*$/, "") : ""}</span>
      </div>`;
    }).join("");
    return box("balance", "Escalation balance", `
      <span class="block-hd">INCIDENTS BY SCENARIO, LAST ${data.length} WEEKS</span>
      <p class="ov-sub" style="margin:10px 0 12px">${verdict}</p>
      <div class="bal" role="img" aria-label="${esc(data.map((d) => `${weekShort(d.w)}: ${d.esc} escalation, ${d.sq} status quo, ${d.de} de-escalation`).join("; "))}">${bars}</div>
      <span class="mix-legend" style="margin-top:8px">${Object.entries(SCENARIO_COLOURS).map(([s, c]) => `<span><i style="background:${c}"></i>${s}</span>`).join("")}</span>`);
  }

  function heatHtml({ weeks, groups }) {
    const row = ({ e, values }) => `<tr><th class="rowh" scope="row"><button class="link" data-action="entity" data-key="${e.key}" style="background:none;border:none;padding:0;cursor:pointer;font:inherit;text-align:left">${esc(e.name)}</button></th>${values.map((v, i) => {
      const w = weeks[i];
      const label = `${e.name}, ${weekShort(w)}: ${v === null ? "no incidents" : "GSI " + fmt(v)}`;
      return `<td><button data-action="entity" data-key="${e.key}" data-week="${w}" aria-label="${esc(label)}" title="${esc(label)}" ${v === null ? 'class="blank">·' : `style="background:${fill(v)};color:${Math.abs(v) >= 40 ? "#FFFFFF" : "#1B1725"}">${fmtInt(v)}`}</button></td>`;
    }).join("")}</tr>`;
    return box("heat", `The last ${HEAT_WEEKS} weeks at a glance`, `
      <div class="heat"><table>
        <thead><tr><th></th>${weeks.map((w) => `<th scope="col">${weekShort(w)}</th>`).join("")}</tr></thead>
        <tbody>${groups.map((g) => `<tr><th colspan="${weeks.length + 1}" style="text-align:left;padding-top:14px;color:var(--gold-ink)">${g.label}</th></tr>` + g.rows.map(row).join("")).join("")}</tbody>
      </table></div>
      <span style="font-size:12px;color:var(--muted);margin-top:8px">Rows sorted by this week's GSI. Select any cell to open that country or region on the GSI Map for that week.</span>`);
  }

  /* ============================================ DOWNLOADS (one spec per chart) */

  function buildSpecs(week, d) {
    const wk = weekLabel(week, { upper: false });
    const file = (name) => `${name}-${week}`;
    return {
      keyIncidents: {
        title: "Key incidents this week", subtitle: `${wk} · highest-scoring incidents`, filename: file("key-incidents"),
        columns: [{ label: "Date", width: 12 }, { label: "Title", width: 60 }, { label: "Location", width: 18 }, { label: "Type", width: 26 }, { label: "Severity", width: 12 }, { label: "Headline GSI", width: 12 }, { label: "Source", width: 40 }],
        rows: d.keyIncidents.map((i) => [i.date, i.title, i.location, i.type, i.severity, i.gsi, i.url]),
        image: () => tableImage({
          title: "Key incidents this week", subtitle: wk,
          // The 5th value of each row (location · type) is printed small under the title.
          columns: [{ label: "Date", width: 70 }, { label: "Incident", width: 560, sub: 4 }, { label: "Severity", width: 110 }, { label: "GSI", width: 80, kind: "gsiInt", align: "center" }],
          rows: d.keyIncidents.map((i) => [shortDate(i.date), i.title, i.severity || "–", i.gsi, `${i.location} · ${i.type}`])
        })
      },
      movers: {
        title: "Biggest movers", subtitle: `${wk} · change in GSI vs last week`, filename: file("biggest-movers"),
        columns: [{ label: "Name", width: 28 }, { label: "Kind", width: 14 }, { label: "GSI this week", width: 14 }, { label: "GSI last week", width: 14 }, { label: "Change", width: 10 }],
        rows: d.movers.map((r) => [r.e.name, KIND[r.e.level], r1(r.v), r1(r.prev), r1(r.c)]),
        image: () => tableImage({
          title: "Biggest movers", subtitle: `${wk} · change in GSI vs last week`,
          columns: [{ label: "Name", width: 260 }, { label: "Kind", width: 130 }, { label: "Change", width: 140, kind: "change", align: "right" }, { label: "GSI", width: 110, kind: "gsi", align: "center" }],
          rows: d.movers.map((r) => [r.e.name, KIND[r.e.level], r.c, r.v])
        })
      },
      regions: {
        title: "Regions and global themes", subtitle: `${wk} · weekly GSI`, filename: file("regions-and-themes"),
        columns: [{ label: "Name", width: 30 }, { label: "Kind", width: 14 }, { label: "GSI", width: 10 }, { label: "Change vs last week", width: 20 }, { label: "Incidents", width: 10 }],
        rows: d.regions.map((r) => [r.entity.name, KIND[r.entity.level], r1(r.value), r1(r.change), r.n]),
        image: () => tableImage({
          title: "Regions and global themes", subtitle: `${wk} · weekly GSI`,
          columns: [{ label: "Name", width: 270 }, { label: "Kind", width: 120 }, { label: "Incidents", width: 90, kind: "num", align: "right" }, { label: "Vs last week", width: 130, kind: "change", align: "right" }, { label: "GSI", width: 100, kind: "gsi", align: "center" }],
          rows: d.regions.map((r) => [r.entity.name, KIND[r.entity.level], r.n, r.change, r.value])
        })
      },
      categories: {
        title: "What happened", subtitle: `${wk} · incidents by category`, filename: file("incidents-by-category"),
        columns: [{ label: "Category", width: 32 }, { label: "Incidents", width: 12 }],
        rows: d.categories.map((r) => [r.category, r.n]),
        image: () => barsImage({ title: "What happened", subtitle: `${wk} · incidents by category`, rows: d.categories.map((r) => ({ label: r.category, value: r.n, colour: r.colour })) })
      },
      balance: {
        title: "Escalation balance", subtitle: `Incidents by scenario, ${d.balance.data.length} weeks to ${wk.replace(/^Week of /, "")}`, filename: file("escalation-balance"),
        columns: [{ label: "Week ending", width: 14 }, { label: "Escalation", width: 12 }, { label: "Status quo", width: 12 }, { label: "De-escalation", width: 14 }, { label: "Escalation share (%)", width: 20 }],
        rows: d.balance.data.map((x) => [x.w, x.esc, x.sq, x.de, x.esc + x.de ? Math.round(d.balance.share(x) * 100) : null]),
        image: () => stackedImage({
          title: "Escalation balance", subtitle: `Incidents by scenario, last ${d.balance.data.length} weeks`, note: d.balance.verdict,
          columns: d.balance.data.map((x) => ({ label: weekShort(x.w).replace(/[–-].*$/, ""), highlight: x.w === week, parts: [
            { value: x.de, colour: SCENARIO_COLOURS["De-escalation"] }, { value: x.sq, colour: SCENARIO_COLOURS["Status quo"] }, { value: x.esc, colour: SCENARIO_COLOURS.Escalation }] })),
          legend: Object.entries(SCENARIO_COLOURS).map(([label, colour]) => ({ label, colour }))
        })
      },
      heat: {
        title: `The last ${HEAT_WEEKS} weeks at a glance`, subtitle: `Weekly GSI, ${weekShort(d.heat.weeks[0])} to ${wk.replace(/^Week of /, "")}`, filename: file("gsi-last-8-weeks"),
        columns: [{ label: "Name", width: 28 }, { label: "Kind", width: 14 }, ...d.heat.weeks.map((w) => ({ label: `Week ending ${w}`, width: 20 }))],
        rows: d.heat.groups.flatMap((g) => g.rows.map((r) => [r.e.name, KIND[r.e.level], ...r.values.map(r1)])),
        image: () => heatImage({
          title: `The last ${HEAT_WEEKS} weeks at a glance`, subtitle: `Weekly GSI · blank = no incidents that week`,
          weeks: d.heat.weeks.map(weekShort),
          groups: d.heat.groups.map((g) => ({ label: g.label, rows: g.rows.map((r) => ({ name: r.e.name, values: r.values })) }))
        })
      }
    };
  }

  /* ============================================================ render */
  function render(state) {
    const week = state.week;
    const weekIncs = inWeek(week);
    const d = {
      keyIncidents: keyIncidentsData(weekIncs),
      movers: moversData(week),
      regions: regionsData(week),
      categories: categoryData(weekIncs),
      balance: balanceData(week),
      heat: heatData(week)
    };
    specs = buildSpecs(week, d);
    el.innerHTML = `
      ${top(week)}
      ${keyFiguresHtml(week, weekIncs)}
      ${keyIncidentsHtml(d.keyIncidents)}
      <div class="ov-pair">${moversHtml(d.movers)}${regionsHtml(d.regions)}</div>
      <div class="ov-pair">${categoryHtml(d.categories)}${balanceHtml(week, d.balance)}</div>
      ${heatHtml(d.heat)}`;
  }

  return { render };
}
