/**
 * overview.js: the OVERVIEW tab, "Weekly Global Forecast Overview".
 *
 *   ┌ key figures: incidents · average GSI · most destabilized · most stabilized ┐
 *   ├─────────────────────────────────────────────┬──────────────────────────────┤
 *   │ Analyst summary (placeholder)               │ Biggest movers vs last week  │
 *   │ Key incidents this week                     │ Regions and global themes    │
 *   │ Last 8 weeks at a glance (heat table)       │ What happened (by category)  │
 *   └─────────────────────────────────────────────┴──────────────────────────────┘
 *
 * "Key incidents" are picked automatically until the sheet has a Featured
 * column: the week's incidents with the largest headline scores (either
 * direction), ties broken by severity.
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

const KEY_INCIDENTS = 8; // how many to list
const HEAT_WEEKS = 8; // columns in the heat table
const CATEGORY_COLOURS = ["#1B1725", "#7A6528", "#BFA359", "#8C8A91", "#DCDAD3"];

export function createOverview(ctx) {
  const { cfg, store, gsi, incidents } = ctx;
  const el = byId("screen-overview");
  const sevRank = (s) => cfg.severities.indexOf(s);

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

  function keyFigures(week, weekIncs) {
    const ranks = gsi.ranking("country", week).filter((r) => r.value !== null);
    const avg = ranks.length ? ranks.reduce((s, r) => s + r.value, 0) / ranks.length : null;
    const prevRanks = gsi.ranking("country", addDays(week, -7)).filter((r) => r.value !== null);
    const prevAvg = prevRanks.length ? prevRanks.reduce((s, r) => s + r.value, 0) / prevRanks.length : null;
    const worst = ranks[0];
    const best = ranks[ranks.length - 1];
    const quiet = gsi.ranking("country", week).filter((r) => r.value === null).map((r) => r.entity.name);

    const scen = ["Escalation", "Status quo", "De-escalation"].map((s) => [s, weekIncs.filter((i) => i.scenario === s).length]);
    const scenColours = { Escalation: "#C4483B", "Status quo": "#9C8EC2", "De-escalation": "#3D6FB0" };
    const total = weekIncs.length || 1;

    // Only call a country "most destabilized" if it's below zero, "most stabilized" if above.
    const named = (r, ok, none) => r && ok
      ? `<button class="link" data-action="entity" data-key="${r.entity.key}"><span class="v" style="color:${ink(r.value)}">${esc(r.entity.name)}</span></button><span class="s">GSI ${fmt(r.value)} · ${plural(r.n, "event")}</span>`
      : `<span class="v">–</span><span class="s">${none}</span>`;

    return `
      <div class="stat-row">
        <div class="stat">
          <span class="eyebrow">INCIDENTS THIS WEEK</span>
          <span class="v">${weekIncs.length}</span>
          <div class="mix" aria-hidden="true">${scen.map(([s, n]) => `<span style="flex:${n / total};background:${scenColours[s]}"></span>`).join("")}</div>
          <span class="mix-legend">${scen.map(([s, n]) => `<span><i style="background:${scenColours[s]}"></i>${s} ${n}</span>`).join("")}</span>
        </div>
        <div class="stat">
          <span class="eyebrow">AVERAGE SPOTLIGHT GSI</span>
          <span class="v" style="color:${ink(avg)}">${fmt(avg)}</span>
          <span class="s">Across the ${ranks.length} countries with events this week${prevAvg !== null && avg !== null ? `; ${fmtChange(avg - prevAvg)} on last week` : ""}.${quiet.length ? ` No events: ${esc(quiet.join(", "))}.` : ""}</span>
        </div>
        <div class="stat"><span class="eyebrow">MOST DESTABILIZED</span>${named(worst, worst?.value < 0, "No spotlight country destabilized this week.")}</div>
        <div class="stat"><span class="eyebrow">MOST STABILIZED</span>${named(best, best?.value > 0, "No spotlight country stabilized this week.")}</div>
      </div>`;
  }

  function keyIncidents(weekIncs) {
    // Skip repeats: the sheet sometimes records one event twice under different types.
    const seen = new Set();
    const picked = [...weekIncs]
      .sort((a, b) => Math.abs(b.gsi ?? 0) - Math.abs(a.gsi ?? 0) || sevRank(b.severity) - sevRank(a.severity))
      .filter((i) => { const k = i.title.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
      .slice(0, KEY_INCIDENTS);
    if (!picked.length) return `<p class="empty" style="padding:0">No incidents were recorded this week.</p>`;
    return picked.map((i) => `
      <button class="key-ev" data-action="incident" data-id="${i.id}">
        <span class="d">${shortDate(i.date)}</span>
        <span class="b">
          <span class="t">${esc(i.title)}</span>
          <span class="m">${esc(i.location)} · ${esc(i.type)}${i.severity ? ` · Severity: ${esc(i.severity)}` : ""}</span>
        </span>
        <span class="badge lg" style="${badgeStyle(i.gsi)};align-self:flex-start">GSI ${fmtInt(i.gsi)}</span>
      </button>`).join("");
  }

  function heatTable(week) {
    const weeks = gsi.weeks.filter((w) => w <= week).slice(-HEAT_WEEKS);
    const row = (e) => `<tr><th class="rowh" scope="row"><button class="link" data-action="entity" data-key="${e.key}" style="background:none;border:none;padding:0;cursor:pointer;font:inherit;text-align:left">${esc(e.name)}</button></th>${weeks.map((w) => {
      const v = gsi.value(e.key, w).value;
      const label = `${e.name}, ${weekShort(w)}: ${v === null ? "no events" : "GSI " + fmt(v)}`;
      return `<td><button data-action="entity" data-key="${e.key}" data-week="${w}" aria-label="${esc(label)}" title="${esc(label)}" ${v === null ? 'class="blank">·' : `style="background:${fill(v)};color:${Math.abs(v) >= 40 ? "#FFFFFF" : "#1B1725"}">${fmtInt(v)}`}</button></td>`;
    }).join("")}</tr>`;
    const group = (label, level) => `<tr><th colspan="${weeks.length + 1}" style="text-align:left;padding-top:14px;color:var(--gold-ink)">${label}</th></tr>` +
      gsi.ranking(level, week).map((r) => row(r.entity)).join("");
    return `
      <div class="heat"><table>
        <thead><tr><th></th>${weeks.map((w) => `<th scope="col">${weekShort(w)}</th>`).join("")}</tr></thead>
        <tbody>${group("SPOTLIGHT COUNTRIES", "country")}${group("REGIONS", "region")}${group("GLOBAL THEMES", "theme")}</tbody>
      </table></div>
      <span style="font-size:12px;color:var(--muted);margin-top:8px">Rows sorted by this week's GSI. Select any cell to open that country or region on the GSI Map for that week.</span>`;
  }

  function movers(week) {
    const rows = cfg.entities
      .map((e) => ({ e, v: gsi.value(e.key, week).value, c: gsi.change(e.key, week) }))
      .filter((r) => r.c !== null && Math.abs(r.c) >= 0.05)
      .sort((a, b) => Math.abs(b.c) - Math.abs(a.c))
      .slice(0, 6);
    if (!rows.length) return `<p class="empty" style="padding:0">No week-on-week changes to show.</p>`;
    return rows.map((r) => `
      <button class="mover" data-action="entity" data-key="${r.e.key}">
        <span class="n">${esc(r.e.name)}</span>
        <span class="r"><span style="color:${ink(r.c)};font-weight:700">${r.c > 0 ? "▲" : "▼"} ${fmtChange(r.c)}</span><span class="badge" style="${badgeStyle(r.v)}">${fmt(r.v)}</span></span>
      </button>`).join("");
  }

  function regionList(week) {
    return ["region", "theme"].map((level) => gsi.ranking(level, week).map((r) => `
      <button class="mover" data-action="entity" data-key="${r.entity.key}">
        <span class="n">${esc(r.entity.name)}<span style="display:block;font-size:12px;color:var(--muted)">${level === "theme" ? "Global theme" : "Region"} · ${plural(r.n, "event")}</span></span>
        <span class="r"><span>${fmtChange(r.change)}</span><span class="badge lg" style="${badgeStyle(r.value)}">${fmt(r.value)}</span></span>
      </button>`).join("")).join("");
  }

  function categoryMix(weekIncs) {
    const counts = new Map();
    weekIncs.forEach((i) => counts.set(i.category || "Uncategorized", (counts.get(i.category || "Uncategorized") || 0) + 1));
    const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const max = Math.max(1, ...rows.map((r) => r[1]));
    return rows.map(([cat, n], i) => `
      <div style="display:flex;flex-direction:column;gap:4px;padding:8px 0;border-bottom:1px solid var(--line-3)">
        <span style="display:flex;justify-content:space-between;font-size:13.5px"><span>${esc(cat)}</span><b style="font-weight:500">${n}</b></span>
        <span style="height:8px;background:${CATEGORY_COLOURS[i % CATEGORY_COLOURS.length]};width:${(n / max) * 100}%"></span>
      </div>`).join("") || `<p class="empty" style="padding:0">No incidents this week.</p>`;
  }

  /* ------------------------------------------------------------ render */
  function render(state) {
    const weekIncs = incidents.filter((i) => i.week === state.week);
    el.innerHTML = `
      ${keyFigures(state.week, weekIncs)}
      <div class="ov-grid">
        <div class="ov-main">
          <div class="ov-block">
            <h2>Analyst summary</h2>
            <div class="summary-box placeholder">[The unit's summary of the week: what moved, why, and what to watch next week. Written by the Geopolitical Forecasting and Analysis Unit for each Weekly Forecast Monitor.]</div>
          </div>
          <div class="ov-block">
            <h2>Key incidents this week</h2>
            <span style="font-size:12.5px;color:var(--muted);margin:-6px 0 6px">The week's highest-scoring incidents. Select one to read it in the Event Feed.</span>
            ${keyIncidents(weekIncs)}
          </div>
          <div class="ov-block">
            <h2>The last ${HEAT_WEEKS} weeks at a glance</h2>
            ${heatTable(state.week)}
          </div>
        </div>
        <div class="ov-side">
          <div class="ov-block"><h2>Biggest movers</h2><span class="block-hd">CHANGE IN GSI VS LAST WEEK</span>${movers(state.week)}</div>
          <div class="ov-block"><h2>Regions and global themes</h2><span class="block-hd" style="display:flex;justify-content:space-between"><span>THIS WEEK</span><span>VS LAST WEEK · GSI</span></span>${regionList(state.week)}</div>
          <div class="ov-block"><h2>What happened</h2><span class="block-hd">INCIDENTS THIS WEEK BY CATEGORY</span>${categoryMix(weekIncs)}</div>
        </div>
      </div>`;
  }

  return { render };
}
