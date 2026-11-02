/**
 * rankTable.js: "All spotlight countries this week" under the map.
 *
 * One row per entity, sorted from most destabilized to most stabilized,
 * with a diverging bar (left of centre = negative), the value, the change
 * from last week and the number of events. Blank weeks sort last.
 *
 * At the "Regions & themes" level the table has two sorted groups, Regions
 * then Global themes, so the two kinds are never ranked against each other.
 *
 * Reads:  state.level, state.sel, state.week
 * Writes: sel, ev
 * DOM:    #rankTable
 */
import { byId, esc, onAction } from "../../ui/dom.js";
import { fmt, fmtChange, fill, ink } from "../../ui/format.js";
import { weekLabel } from "../../model/weeks.js";

export function createRankTable(ctx) {
  const { store, gsi } = ctx;
  const el = byId("rankTable");

  onAction(el, {
    pick: (b) => {
      store.set({ sel: b.dataset.key, ev: null });
      byId("screen-map").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  function row(r, sel) {
    const v = r.value;
    const w = v === null ? 0 : (Math.min(Math.abs(v), 60) / 60) * 50; // % of the bar's width
    const bar = `position:absolute;top:0;height:14px;background:${fill(v)};${v !== null && v < 0 ? "right:50%" : "left:50%"};width:${w}%`;
    return `<button class="rank-row" data-action="pick" data-key="${r.entity.key}" aria-pressed="${r.entity.key === sel}">
      <span class="c-name">${esc(r.entity.name)}</span>
      <span class="c-bar"><span class="b" style="${bar}"></span></span>
      <span class="c-val" style="color:${ink(v)}">${fmt(v)}</span>
      <span class="c-chg">${fmtChange(r.change)}</span>
      <span class="c-n">${r.n}</span>
    </button>`;
  }

  function render(state) {
    const regionMode = state.level === "region";
    const groups = regionMode
      ? [["REGIONS", gsi.ranking("region", state.week)], ["GLOBAL THEMES", gsi.ranking("theme", state.week)]]
      : [[null, gsi.ranking("country", state.week)]];

    el.innerHTML = `
      <div class="hd">
        <h2 class="section-h2">${regionMode ? "All regions and themes this week" : "All spotlight countries this week"}</h2>
        <span style="font-size:13px;color:var(--muted)">Sorted from most destabilized to most stabilized${regionMode ? " within each group" : ""} · select a row to open it</span>
      </div>
      <div class="rank-table" role="group" aria-label="Ranking">
        <div class="rank-cols">
          <span class="c-name">${regionMode ? "REGION / THEME" : "COUNTRY"}</span>
          <span class="c-bar">GSI, ${weekLabel(state.week, { prefix: "WEEK OF " })}</span>
          <span class="c-val">GSI</span>
          <span class="c-chg">VS LAST WEEK</span>
          <span class="c-n">EVENTS</span>
        </div>
        ${groups.map(([label, rows]) => (label ? `<div class="rank-group">${label}</div>` : "") + rows.map((r) => row(r, state.sel)).join("")).join("")}
      </div>`;
  }

  return { render };
}
