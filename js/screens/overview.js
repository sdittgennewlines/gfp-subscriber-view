/**
 * overview.js: the OVERVIEW tab, "Weekly Global Forecast Overview".
 *
 *   ┌ Analyst summary ─┬ Weekly Forecast Monitor ┬ Podcast ┬ Quarterly ┐
 *   ├──────────────────┴─────────┬───────────────┴─────────┴───────────┤
 *   │ Incidents this week │ Most destabilized │ Most stabilized        │
 *   ├─────────────────────────────────────────────────────────────────┤
 *   │ Key incidents this week                                          │
 *   ├────────────────────────────────┬────────────────────────────────┤
 *   │ Biggest movers                 │ Regions and global themes      │
 *   ├────────────────────────────────┼────────────────────────────────┤
 *   │ What happened (by category)    │ Escalation balance (12 weeks)  │
 *   ├────────────────────────────────┴────────────────────────────────┤
 *   │ The last 8 weeks at a glance (heat table)                        │
 *   └─────────────────────────────────────────────────────────────────┘
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
import { addDays, shortDate, weekShort } from "../model/weeks.js";
import { reportCards } from "../components/reportCards.js";

const KEY_INCIDENTS = 8; // how many key incidents to list
const HEAT_WEEKS = 8; // columns in the heat table
const BALANCE_WEEKS = 12; // weeks in the escalation-balance chart
const CATEGORY_COLOURS = ["#1B1725", "#7A6528", "#BFA359", "#8C8A91", "#DCDAD3"];
const SCENARIO_COLOURS = { Escalation: "#C4483B", "Status quo": "#C9A94E", "De-escalation": "#3D6FB0" };

export function createOverview(ctx) {
  const { cfg, store, gsi, incidents, reports } = ctx;
  const el = byId("screen-overview");
  const sevRank = (s) => cfg.severities.indexOf(s);
  const inWeek = (week) => incidents.filter((i) => i.week === week);

  onAction(el, {
    // Open an entity on the GSI Map (optionally at another week).
    entity: (b) => {
      const e = gsi.entity(b.dataset.key);
      store.set({ tab: "map", level: e.level === "country" ? "country" : "region", sel: e.key, week: b.dataset.week || store.get().week, ev: null });
      window.scrollTo({ top: 0 });
    },
    // Open an incident in the Event Feed.
    incident: (b) => { store.set({ tab: "feed", ev: b.dataset.id }); window.scrollTo({ top: 0 }); }
  });

  /* ------------------------------------------------------------ pieces */

  /** Row 1: analyst summary (left third) + the three report cards. */
  const top = (week) => `
    <div class="ov-top">
      <div class="ov-box ov-summary">
        <h2>Analyst summary</h2>
        <p class="placeholder">[The unit's summary of the week: what moved, why, and what to watch next week. Written by the Geopolitical Forecasting and Analysis Unit for each Weekly Forecast Monitor.]</p>
      </div>
      <div class="cards">${reportCards(reports, week)}</div>
    </div>`;

  /** Row 2: incidents this week · most destabilized · most stabilized. */
  function keyFigures(week, weekIncs) {
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

  /** Row 3: the week's highest-scoring incidents. */
  function keyIncidents(weekIncs) {
    const seen = new Set(); // skip repeats: the sheet sometimes records one event twice under different types
    const picked = [...weekIncs]
      .sort((a, b) => Math.abs(b.gsi ?? 0) - Math.abs(a.gsi ?? 0) || sevRank(b.severity) - sevRank(a.severity))
      .filter((i) => { const k = i.title.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
      .slice(0, KEY_INCIDENTS);
    const list = picked.length ? picked.map((i) => `
      <button class="key-ev" data-action="incident" data-id="${i.id}">
        <span class="d">${shortDate(i.date)}</span>
        <span class="b">
          <span class="t">${esc(i.title)}</span>
          <span class="m">${esc(i.location)} · ${esc(i.type)}${i.severity ? ` · Severity: ${esc(i.severity)}` : ""}</span>
        </span>
        <span class="badge lg" style="${badgeStyle(i.gsi)};align-self:flex-start">GSI ${fmtInt(i.gsi)}</span>
      </button>`).join("") : `<p class="empty" style="padding:0">No incidents were recorded this week.</p>`;
    return `
      <div class="ov-box">
        <h2>Key incidents this week</h2>
        <span class="ov-sub">The week's highest-scoring incidents. Select one to read it in the Event Feed.</span>
        <div class="key-grid">${list}</div>
      </div>`;
  }

  /** Box: largest week-on-week GSI changes across countries, regions and themes. */
  function movers(week) {
    const rows = cfg.entities
      .map((e) => ({ e, v: gsi.value(e.key, week).value, c: gsi.change(e.key, week) }))
      .filter((r) => r.c !== null && Math.abs(r.c) >= 0.05)
      .sort((a, b) => Math.abs(b.c) - Math.abs(a.c))
      .slice(0, 6);
    const body = rows.length ? rows.map((r) => `
      <button class="mover" data-action="entity" data-key="${r.e.key}">
        <span class="n">${esc(r.e.name)}</span>
        <span class="r"><span style="color:${ink(r.c)};font-weight:700">${r.c > 0 ? "▲" : "▼"} ${fmtChange(r.c)}</span><span class="badge" style="${badgeStyle(r.v)}">${fmt(r.v)}</span></span>
      </button>`).join("") : `<p class="empty" style="padding:0">No week-on-week changes to show.</p>`;
    return `<div class="ov-box"><h2>Biggest movers</h2><span class="block-hd" style="display:flex;justify-content:space-between"><span>CHANGE VS LAST WEEK</span><span>CHANGE · GSI</span></span>${body}</div>`;
  }

  /** Box: the four regions and two themes. */
  function regionList(week) {
    const body = ["region", "theme"].map((level) => gsi.ranking(level, week).map((r) => `
      <button class="mover" data-action="entity" data-key="${r.entity.key}">
        <span class="n">${esc(r.entity.name)}<span style="display:block;font-size:12px;color:var(--muted)">${level === "theme" ? "Global theme" : "Region"} · ${plural(r.n, "incident")}</span></span>
        <span class="r"><span>${fmtChange(r.change)}</span><span class="badge lg" style="${badgeStyle(r.value)}">${fmt(r.value)}</span></span>
      </button>`).join("")).join("");
    return `<div class="ov-box"><h2>Regions and global themes</h2><span class="block-hd" style="display:flex;justify-content:space-between"><span>THIS WEEK</span><span>VS LAST WEEK · GSI</span></span>${body}</div>`;
  }

  /** Box: the week's incidents by category. */
  function categoryMix(weekIncs) {
    const counts = new Map();
    weekIncs.forEach((i) => counts.set(i.category || "Uncategorized", (counts.get(i.category || "Uncategorized") || 0) + 1));
    const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const max = Math.max(1, ...rows.map((r) => r[1]));
    const body = rows.map(([cat, n], i) => `
      <div style="display:flex;flex-direction:column;gap:4px;padding:8px 0;border-bottom:1px solid var(--line-3)">
        <span style="display:flex;justify-content:space-between;font-size:13.5px"><span>${esc(cat)}</span><b style="font-weight:500">${n}</b></span>
        <span style="height:8px;background:${CATEGORY_COLOURS[i % CATEGORY_COLOURS.length]};width:${(n / max) * 100}%"></span>
      </div>`).join("") || `<p class="empty" style="padding:0">No incidents this week.</p>`;
    return `<div class="ov-box"><h2>What happened</h2><span class="block-hd">INCIDENTS THIS WEEK BY CATEGORY</span>${body}</div>`;
  }

  /**
   * Box: escalation balance. For each of the last 12 weeks, escalations vs
   * de-escalations (status quo in the middle), so the reader can see whether
   * this week was unusually tense or calm.
   */
  function escalationBalance(week) {
    const weeks = gsi.weeks.filter((w) => w <= week).slice(-BALANCE_WEEKS);
    const data = weeks.map((w) => {
      const incs = inWeek(w);
      return { w, esc: incs.filter((i) => i.scenario === "Escalation").length, sq: incs.filter((i) => i.scenario === "Status quo").length, de: incs.filter((i) => i.scenario === "De-escalation").length };
    });
    const max = Math.max(1, ...data.map((d) => d.esc + d.sq + d.de));
    const share = (d) => (d.esc + d.de ? d.esc / (d.esc + d.de) : 0);
    const now = data[data.length - 1];
    const avg = data.slice(0, -1).reduce((s, d) => s + share(d), 0) / Math.max(1, data.length - 1);
    const verdict = !now || now.esc + now.de === 0 ? "No escalations or de-escalations this week."
      : `This week ${Math.round(share(now) * 100)}% of escalation/de-escalation incidents were escalations, ${share(now) > avg + 0.05 ? "above" : share(now) < avg - 0.05 ? "below" : "close to"} the ${data.length - 1}-week average of ${Math.round(avg * 100)}%.`;

    // Simple stacked columns: escalation on top, status quo, de-escalation at the bottom.
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
    return `
      <div class="ov-box">
        <h2>Escalation balance</h2>
        <span class="block-hd">INCIDENTS BY SCENARIO, LAST ${data.length} WEEKS</span>
        <p class="ov-sub" style="margin:10px 0 12px">${verdict}</p>
        <div class="bal" role="img" aria-label="${esc(data.map((d) => `${weekShort(d.w)}: ${d.esc} escalation, ${d.sq} status quo, ${d.de} de-escalation`).join("; "))}">${bars}</div>
        <span class="mix-legend" style="margin-top:8px">${Object.entries(SCENARIO_COLOURS).map(([s, c]) => `<span><i style="background:${c}"></i>${s}</span>`).join("")}</span>
      </div>`;
  }

  /** Bottom: every entity × the last 8 weeks. */
  function heatTable(week) {
    const weeks = gsi.weeks.filter((w) => w <= week).slice(-HEAT_WEEKS);
    const row = (e) => `<tr><th class="rowh" scope="row"><button class="link" data-action="entity" data-key="${e.key}" style="background:none;border:none;padding:0;cursor:pointer;font:inherit;text-align:left">${esc(e.name)}</button></th>${weeks.map((w) => {
      const v = gsi.value(e.key, w).value;
      const label = `${e.name}, ${weekShort(w)}: ${v === null ? "no incidents" : "GSI " + fmt(v)}`;
      return `<td><button data-action="entity" data-key="${e.key}" data-week="${w}" aria-label="${esc(label)}" title="${esc(label)}" ${v === null ? 'class="blank">·' : `style="background:${fill(v)};color:${Math.abs(v) >= 40 ? "#FFFFFF" : "#1B1725"}">${fmtInt(v)}`}</button></td>`;
    }).join("")}</tr>`;
    const group = (label, level) => `<tr><th colspan="${weeks.length + 1}" style="text-align:left;padding-top:14px;color:var(--gold-ink)">${label}</th></tr>` +
      gsi.ranking(level, week).map((r) => row(r.entity)).join("");
    return `
      <div class="ov-box">
        <h2>The last ${HEAT_WEEKS} weeks at a glance</h2>
        <div class="heat"><table>
          <thead><tr><th></th>${weeks.map((w) => `<th scope="col">${weekShort(w)}</th>`).join("")}</tr></thead>
          <tbody>${group("SPOTLIGHT COUNTRIES", "country")}${group("REGIONS", "region")}${group("GLOBAL THEMES", "theme")}</tbody>
        </table></div>
        <span style="font-size:12px;color:var(--muted);margin-top:8px">Rows sorted by this week's GSI. Select any cell to open that country or region on the GSI Map for that week.</span>
      </div>`;
  }

  /* ------------------------------------------------------------ render */
  function render(state) {
    const weekIncs = inWeek(state.week);
    el.innerHTML = `
      ${top(state.week)}
      ${keyFigures(state.week, weekIncs)}
      ${keyIncidents(weekIncs)}
      <div class="ov-pair">${movers(state.week)}${regionList(state.week)}</div>
      <div class="ov-pair">${categoryMix(weekIncs)}${escalationBalance(state.week)}</div>
      ${heatTable(state.week)}`;
  }

  return { render };
}
