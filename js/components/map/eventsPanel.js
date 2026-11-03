/**
 * eventsPanel.js: "Events · <selection>" under the map.
 *
 *   ┌ Events · Sudan ──────────── 40 events · newest first ─┐
 *   │ WEEK OF OCT 24–30   GSI −30.0 │  event detail          │
 *   │ ▌Oct 29 · Military …    −30   │  (eventDetail.js)      │
 *   │ ▌…                            │                        │
 *   └───────────────────────────────┴────────────────────────┘
 *
 * Lists the selection's incidents week by week, newest first, from the
 * selected week back to the start of the record. Each week header shows
 * that week's GSI (or, for countries without a GSI, the incident count).
 *
 * Spotlight countries also get a checkbox to include incidents located in
 * the country that the analysts did not score for it ("not scored").
 *
 * The list is only rebuilt when the selection, week or checkbox change, so
 * picking an event keeps the list's scroll position.
 *
 * Reads:  state.sel, state.week, state.ev, state.unscored
 * Writes: ev, unscored (+ the detail's actions)
 * DOM:    #eventsPanel
 */
import { byId, esc, onAction } from "../../ui/dom.js";
import { fmt, fmtInt, ink, badgeStyle, plural, edge } from "../../ui/format.js";
import { describe, events, unscoredCount } from "../../model/selection.js";
import { weekLabel, shortDate, longDate } from "../../model/weeks.js";
import { renderEventDetail, eventDetailActions, crossLinkFor } from "../eventDetail.js";


export function createEventsPanel(ctx) {
  const { store, gsi } = ctx;
  const el = byId("eventsPanel");
  let listKey = "";
  let shownId = null;

  el.innerHTML = `
    <div class="ev-head"><h2 id="evTitle"></h2><div class="meta" id="evMeta"></div></div>
    <div class="ev-body">
      <div class="ev-list" id="evList" tabindex="0" aria-label="Events, newest first"></div>
      <article class="ev-detail" id="evDetail" aria-live="polite"></article>
    </div>`;

  onAction(el, {
    pick: (b) => store.set({ ev: b.dataset.id }),
    ...eventDetailActions(ctx, () => shownId)
  });
  el.addEventListener("change", (ev) => {
    if (ev.target.id === "unscoredToggle") store.set({ unscored: ev.target.checked, ev: null });
  });

  /** One week group: sticky header + rows. */
  function weekGroup(week, items, d) {
    let right;
    if (d.hasGsi) {
      const v = gsi.value(d.entity.key, week).value;
      right = `<span class="v" style="color:${ink(v)}">${v === null ? "" : "GSI " + fmt(v)}</span>`;
    } else {
      right = `<span>${plural(items.length, "incident")}</span>`;
    }
    return `<div class="wk-head"><span>${weekLabel(week)}</span>${right}</div>` + items.map(({ inc, score }) => {
      const xl = crossLinkFor(ctx.cfg, inc);
      const badge = score !== null
        ? `<span class="badge" style="${badgeStyle(score)}">${fmtInt(score)}</span>`
        : `<span class="badge neutral">${d.hasGsi ? "Not scored" : esc(inc.severity || "–")}</span>`;
      return `<button class="ev-row${xl ? " xl" : ""}" data-action="pick" data-id="${inc.id}" aria-pressed="false" style="border-left-color:${edge(score)}">
        <span class="top"><span>${shortDate(inc.date)} · ${esc(inc.type)}</span>${badge}</span>
        <span class="t">${esc(inc.title)}</span>
        ${d.level === "country" || d.level === "place" ? "" : `<span class="loc">${esc(inc.location)}</span>`}
        ${xl ? `<span class="tag">${esc(xl.monitor.toUpperCase())}</span>` : ""}
      </button>`;
    }).join("");
  }

  function render(state) {
    const d = describe(ctx, state);
    const list = events(ctx, state);

    // Header.
    byId("evTitle").textContent = `Events · ${d.name}`;
    const extra = unscoredCount(ctx, state);
    byId("evMeta").innerHTML = `
      <span>${plural(list.length, "event")} · newest first · scroll for earlier weeks</span>
      ${d.level === "country" && (extra || state.unscored) ? `<label><input type="checkbox" id="unscoredToggle" ${state.unscored ? "checked" : ""}> Also show ${extra} unscored incident${extra === 1 ? "" : "s"} located in ${esc(d.name)}</label>` : ""}`;

    // List (rebuilt only when what it lists changes).
    const key = [state.sel, state.week, state.unscored].join("|");
    const listEl = byId("evList");
    if (key !== listKey) {
      listKey = key;
      if (!list.length) {
        listEl.innerHTML = `<p class="empty">No events have been ${d.hasGsi ? "scored for" : "recorded in"} ${esc(d.name)} up to this week.</p>`;
      } else {
        const groups = [];
        for (const item of list) {
          const g = groups[groups.length - 1];
          if (g && g.week === item.inc.week) g.items.push(item);
          else groups.push({ week: item.inc.week, items: [item] });
        }
        const firstDate = list[list.length - 1].inc.date;
        listEl.innerHTML = groups.map((g) => weekGroup(g.week, g.items, d)).join("") +
          `<p class="list-end">Start of the record for ${esc(d.name)} (${longDate(firstDate)}).</p>`;
      }
      listEl.scrollTop = 0;
    }

    // Which event is open: the one in state, if listed; otherwise the newest.
    const current = list.find((x) => x.inc.id === state.ev)?.inc || list[0]?.inc || null;
    shownId = current?.id || null;
    listEl.querySelectorAll(".ev-row").forEach((b) => b.setAttribute("aria-pressed", b.dataset.id === shownId ? "true" : "false"));

    const detail = byId("evDetail");
    if (detail.dataset.id !== (shownId || "")) {
      detail.dataset.id = shownId || "";
      detail.innerHTML = current ? renderEventDetail(ctx, current)
        : `<p style="margin:0;font-size:15px;line-height:1.6;color:var(--muted)">Select an event to read the full summary.</p>`;
    }
  }

  return { render };
}
