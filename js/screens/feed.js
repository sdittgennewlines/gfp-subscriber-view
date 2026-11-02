/**
 * feed.js: the EVENT FEED tab, the complete searchable incident feed.
 *
 *   ┌ Filters ──────────┐ ┌ 2,265 incidents ───── [sort] [Download CSV] ─────┐
 *   │ Search            │ │ active filter chips (× to remove)                 │
 *   │ Dates from / to   │ ├────────────────────┬──────────────────────────────┤
 *   │ Place             │ │ results (50 at a   │ event detail                 │
 *   │ Severity          │ │ time, "show more") │ (components/eventDetail.js)  │
 *   │ Category → Type   │ │                    │                              │
 *   │ Scope, Scenario   │ │                    │                              │
 *   │ GSI direction     │ │                    │                              │
 *   └───────────────────┘ └────────────────────┴──────────────────────────────┘
 *
 * Filters follow "checked = included": everything starts checked, and an
 * incident shows if it passes every group. Types are grouped under the four
 * categories from the sheet's "Incidents - Category Mapping" tab; ticking a
 * category ticks all its types.
 *
 * The filter values live here (not in the shared store) because no other
 * screen needs them; only the open incident (state.ev) is shared, so a
 * shared link opens the same incident.
 *
 * Reads:  state.ev
 * Writes: ev (+ the detail's actions)
 * DOM:    #screen-feed
 */
import { byId, esc, onAction } from "../ui/dom.js";
import { fmtInt, badgeStyle, plural } from "../ui/format.js";
import { shortDate, weekLabel, longDate } from "../model/weeks.js";
import { renderEventDetail, eventDetailActions } from "../components/eventDetail.js";
import { downloadText } from "../actions/download.js";

const PAGE = 50; // results shown per "Show more"

export function createFeed(ctx) {
  const { cfg, store, incidents, types, places } = ctx;
  const el = byId("screen-feed");

  /* ------------------------------------------------- filter definitions */
  const categories = [...new Set(types.map((t) => t.category))];
  // Types that appear in the data but not in the sheet's type list (shown under "Uncategorized").
  const unlisted = [...new Set(incidents.filter((i) => i.category === "Uncategorized" && i.type).map((i) => i.type))];
  if (unlisted.length) categories.push("Uncategorized");
  const typesIn = (cat) => (cat === "Uncategorized" ? unlisted : types.filter((t) => t.category === cat).map((t) => t.name));
  const allTypes = categories.flatMap(typesIn);

  const GROUPS = {
    severity: cfg.severities,
    scope: ["International", "Country"],
    scenario: ["Escalation", "Status quo", "De-escalation"],
    dir: ["Destabilizing (below 0)", "Neutral (0)", "Stabilizing (above 0)"]
  };
  const dirOf = (i) => (i.gsi === null ? null : i.gsi < 0 ? GROUPS.dir[0] : i.gsi > 0 ? GROUPS.dir[2] : GROUPS.dir[1]);

  const dates = incidents.map((i) => i.date).sort();
  const minDate = dates[0];
  const maxDate = dates[dates.length - 1];

  /** Fresh filter values: everything included. */
  const fresh = () => ({
    q: "", from: "", to: "", place: "",
    severity: new Set(GROUPS.severity), scope: new Set(GROUPS.scope), scenario: new Set(GROUPS.scenario), dir: new Set(GROUPS.dir),
    types: new Set(allTypes),
    sort: "new", limit: PAGE
  });
  let f = fresh();
  let shownId = null;

  // Counts shown next to each option (whole record).
  const count = (fn) => { const m = new Map(); incidents.forEach((i) => { const k = fn(i); m.set(k, (m.get(k) || 0) + 1); }); return m; };
  const nType = count((i) => i.type);
  const nSev = count((i) => i.severity);

  /* --------------------------------------------------------- matching */
  /** Place filter values: "e:<entityKey>" (scored for it, or located in it) or "l:<Location>". */
  function placeTest(value) {
    if (!value) return () => true;
    const [kind, key] = [value.slice(0, 1), value.slice(2)];
    if (kind === "l") return (i) => i.location === key;
    const e = ctx.gsi.entity(key);
    return (i) => key in i.scores || (e.place && i.location === e.place);
  }

  /** An incident passes a checkbox group if the group is all-checked, or its value is checked. */
  const passes = (set, all, value) => set.size === all.length || set.has(value);

  function results() {
    const q = f.q.trim().toLowerCase();
    const inPlace = placeTest(f.place);
    const list = incidents.filter((i) =>
      (!q || `${i.title} ${i.description} ${i.location} ${i.type}`.toLowerCase().includes(q)) &&
      (!f.from || i.date >= f.from) && (!f.to || i.date <= f.to) &&
      inPlace(i) &&
      passes(f.severity, GROUPS.severity, i.severity) &&
      passes(f.scope, GROUPS.scope, i.scope) &&
      passes(f.scenario, GROUPS.scenario, i.scenario) &&
      passes(f.dir, GROUPS.dir, dirOf(i)) &&
      passes(f.types, allTypes, i.type)
    );
    const by = {
      new: (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0),
      old: (a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0),
      neg: (a, b) => (a.gsi ?? 0) - (b.gsi ?? 0) || (a.date < b.date ? 1 : -1),
      pos: (a, b) => (b.gsi ?? 0) - (a.gsi ?? 0) || (a.date < b.date ? 1 : -1),
      sev: (a, b) => cfg.severities.indexOf(b.severity) - cfg.severities.indexOf(a.severity) || (a.date < b.date ? 1 : -1)
    }[f.sort];
    return list.sort(by);
  }

  /* --------------------------------------------------- filters (static) */
  const cb = (group, value, label, n) => `<label class="cb"><input type="checkbox" data-group="${group}" value="${esc(value)}" checked> ${esc(label)}${n !== undefined ? `<span class="n">${n}</span>` : ""}</label>`;
  const byName = (a, b) => a.name.localeCompare(b.name);

  el.innerHTML = `
    <div class="feed-layout">
      <form class="filters" id="feedFilters" aria-label="Filter incidents" onsubmit="return false">
        <fieldset><span class="flabel">SEARCH</span>
          <input type="search" id="fq" placeholder="Words in title or summary" aria-label="Search incidents"></fieldset>
        <fieldset><span class="flabel">DATES</span>
          <label class="small" for="ffrom">From</label><input type="date" id="ffrom" min="${minDate}" max="${maxDate}">
          <label class="small" for="fto">To</label><input type="date" id="fto" min="${minDate}" max="${maxDate}">
          <span class="small">${longDate(minDate)} to ${longDate(maxDate)}</span></fieldset>
        <fieldset><span class="flabel">PLACE</span>
          <select id="fplace" aria-label="Place">
            <option value="">All places</option>
            <optgroup label="Spotlight countries">${cfg.entities.filter((e) => e.level === "country").sort(byName).map((e) => `<option value="e:${e.key}">${esc(e.name)}</option>`).join("")}</optgroup>
            <optgroup label="Regions">${cfg.entities.filter((e) => e.level === "region").sort(byName).map((e) => `<option value="e:${e.key}">${esc(e.name)}</option>`).join("")}</optgroup>
            <optgroup label="Global themes">${cfg.entities.filter((e) => e.level === "theme").sort(byName).map((e) => `<option value="e:${e.key}">${esc(e.name)}</option>`).join("")}</optgroup>
            <optgroup label="Other locations">${places.list.filter((p) => !p.entity).map((p) => `<option value="l:${esc(p.name)}">${esc(p.name)} (${p.count})</option>`).join("")}</optgroup>
          </select>
          <span class="small">Spotlight countries include incidents scored for them or located there.</span></fieldset>
        <fieldset><span class="flabel">SEVERITY</span>${GROUPS.severity.map((s) => cb("severity", s, s, nSev.get(s) || 0)).join("")}</fieldset>
        <fieldset><span class="flabel">TYPE</span>
          <span style="display:flex;gap:12px;font-size:12px"><button type="button" class="cat-toggle" style="padding:0" data-action="types-all">Select all</button><button type="button" class="cat-toggle" style="padding:0" data-action="types-none">Clear</button></span>
          ${categories.map((cat) => `
            <div class="cat">
              <label class="cb"><input type="checkbox" data-cat="${esc(cat)}" checked> ${esc(cat)}</label>
              <div class="types">${typesIn(cat).map((t) => cb("types", t, t, nType.get(t) || 0)).join("")}</div>
            </div>`).join("")}</fieldset>
        <fieldset><span class="flabel">SCOPE</span>${GROUPS.scope.map((s) => cb("scope", s, s)).join("")}</fieldset>
        <fieldset><span class="flabel">SCENARIO</span>${GROUPS.scenario.map((s) => cb("scenario", s, s)).join("")}</fieldset>
        <fieldset><span class="flabel">HEADLINE GSI</span>${GROUPS.dir.map((s) => cb("dir", s, s)).join("")}</fieldset>
        <button type="button" class="btn" data-action="reset">Reset all filters</button>
      </form>
      <div class="feed-main">
        <div class="feed-bar">
          <span class="count" id="feedCount" aria-live="polite"></span>
          <span class="right">
            <label>Sort <select id="fsort">
              <option value="new">Newest first</option><option value="old">Oldest first</option>
              <option value="sev">Most severe first</option><option value="neg">Most destabilizing first</option><option value="pos">Most stabilizing first</option>
            </select></label>
            <button class="btn" data-action="csv">Download CSV</button>
          </span>
        </div>
        <div class="active-filters" id="feedActive" hidden></div>
        <div class="ev-body">
          <div class="ev-list" id="feedList" style="max-height:1100px" aria-label="Incidents"></div>
          <article class="ev-detail" id="feedDetail" aria-live="polite"></article>
        </div>
      </div>
    </div>`;

  const form = byId("feedFilters");

  /* ------------------------------------------------------- interaction */
  /** Read every control into `f`, then redraw the results. */
  function readForm() {
    f.q = byId("fq").value;
    f.from = byId("ffrom").value;
    f.to = byId("fto").value;
    f.place = byId("fplace").value;
    for (const g of ["severity", "scope", "scenario", "dir", "types"]) {
      f[g] = new Set([...form.querySelectorAll(`input[data-group="${g}"]:checked`)].map((i) => i.value));
    }
    f.limit = PAGE;
    syncCategoryBoxes();
    drawResults(store.get(), true);
  }

  /** Category checkbox = all its types ticked; half-ticked when some are. */
  function syncCategoryBoxes() {
    form.querySelectorAll("input[data-cat]").forEach((box) => {
      const t = [...box.closest(".cat").querySelectorAll('input[data-group="types"]')];
      const on = t.filter((x) => x.checked).length;
      box.checked = on === t.length;
      box.indeterminate = on > 0 && on < t.length;
    });
  }

  form.addEventListener("input", (ev) => { if (ev.target.id === "fq") readForm(); });
  form.addEventListener("change", (ev) => {
    if (ev.target.dataset.cat !== undefined) {
      ev.target.closest(".cat").querySelectorAll('input[data-group="types"]').forEach((x) => { x.checked = ev.target.checked; });
    }
    readForm();
  });
  byId("fsort").addEventListener("change", (ev) => { f.sort = ev.target.value; f.limit = PAGE; drawResults(store.get(), true); });

  const setAll = (selector, on) => form.querySelectorAll(selector).forEach((x) => { x.checked = on; });
  onAction(el, {
    pick: (b) => store.set({ ev: b.dataset.id }),
    more: () => { f.limit += PAGE; drawResults(store.get(), false); },
    reset: () => { form.reset(); setAll("input[type=checkbox]", true); f = fresh(); byId("fsort").value = "new"; readForm(); },
    "types-all": () => { setAll('input[data-group="types"]', true); readForm(); },
    "types-none": () => { setAll('input[data-group="types"]', false); readForm(); },
    // Remove one active-filter chip.
    clear: (b) => {
      const k = b.dataset.k;
      if (k === "q") byId("fq").value = "";
      else if (k === "dates") { byId("ffrom").value = ""; byId("fto").value = ""; }
      else if (k === "place") byId("fplace").value = "";
      else setAll(`input[data-group="${k}"]`, true); // a checkbox group: tick everything again
      readForm();
    },
    csv: () => downloadCsv(results()),
    ...eventDetailActions(ctx, () => shownId)
  });

  /* ------------------------------------------------------------- output */
  function activeChips() {
    const chips = [];
    if (f.q.trim()) chips.push(["q", `Search: "${f.q.trim()}"`]);
    if (f.from || f.to) chips.push(["dates", `${f.from ? shortDate(f.from) : "Start"} to ${f.to ? shortDate(f.to) : "latest"}`]);
    if (f.place) chips.push(["place", byId("fplace").selectedOptions[0]?.textContent || f.place]);
    for (const [g, all] of [["severity", GROUPS.severity], ["types", allTypes], ["scope", GROUPS.scope], ["scenario", GROUPS.scenario], ["dir", GROUPS.dir]]) {
      if (f[g].size !== all.length) chips.push([g, `${{ severity: "Severity", types: "Type", scope: "Scope", scenario: "Scenario", dir: "Headline GSI" }[g]}: ${f[g].size} of ${all.length}`]);
    }
    return chips;
  }

  function row(i) {
    return `<button class="ev-row" data-action="pick" data-id="${i.id}" aria-pressed="false" style="border-left-color:${i.gsi === null ? "#CFCCC4" : i.gsi <= -5 ? "#C4483B" : i.gsi >= 5 ? "#3D6FB0" : "#9C8EC2"}">
      <span class="top"><span>${shortDate(i.date)} · ${esc(i.type)}</span><span class="badge" style="${badgeStyle(i.gsi)}">${fmtInt(i.gsi)}</span></span>
      <span class="t">${esc(i.title)}</span>
      <span class="loc">${esc(i.location)}${i.severity ? ` · Severity: ${esc(i.severity)}` : ""}</span>
    </button>`;
  }

  /** Redraw the list (and keep the open incident in sync). `reset` scrolls back to the top. */
  function drawResults(state, reset) {
    const list = results();
    byId("feedCount").textContent = `${plural(list.length, "incident")}`;

    const chips = activeChips();
    const act = byId("feedActive");
    act.hidden = !chips.length;
    act.innerHTML = chips.map(([k, label]) => `<button data-action="clear" data-k="${k}" aria-label="Remove filter ${esc(label)}">${esc(label)} ×</button>`).join("");

    const listEl = byId("feedList");
    const shown = list.slice(0, f.limit);
    let html = "";
    let lastWeek = null;
    for (const i of shown) {
      // Week headers only make sense in date order.
      if ((f.sort === "new" || f.sort === "old") && i.week !== lastWeek) { html += `<div class="wk-head"><span>${weekLabel(i.week)}</span></div>`; lastWeek = i.week; }
      html += row(i);
    }
    listEl.innerHTML = list.length
      ? html + (list.length > f.limit ? `<button class="more" data-action="more">Show ${Math.min(PAGE, list.length - f.limit)} more (${list.length - f.limit} left)</button>` : `<p class="list-end">End of results.</p>`)
      : `<p class="empty">No incidents match these filters. <button class="btn" data-action="reset" style="margin-top:10px">Reset all filters</button></p>`;
    if (reset) listEl.scrollTop = 0;
    drawDetail(state, list);
  }

  function drawDetail(state, list) {
    // The incident in the shared state if there is one (even if filtered out), else the first result.
    const current = ctx.byId.get(state.ev) || list[0] || null;
    shownId = current?.id || null;
    byId("feedList").querySelectorAll(".ev-row").forEach((b) => b.setAttribute("aria-pressed", b.dataset.id === shownId ? "true" : "false"));
    const d = byId("feedDetail");
    if (d.dataset.id !== (shownId || "")) {
      d.dataset.id = shownId || "";
      d.innerHTML = current ? renderEventDetail(ctx, current) : `<p class="muted">Select an incident to read it.</p>`;
    }
  }

  /** The filtered incidents as a spreadsheet-friendly CSV, one score column per entity. */
  function downloadCsv(list) {
    const cell = (v) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const head = ["Date", "Week ending", "Location", "Title", "Type", "Category", "Severity", "Scope", "Scenario", "Headline GSI",
      ...cfg.entities.map((e) => `GSI ${e.name}`), "Description", "Link"];
    const rows = list.map((i) => [i.date, i.week, i.location, i.title, i.type, i.category, i.severity, i.scope, i.scenario, i.gsi,
      ...cfg.entities.map((e) => i.scores[e.key] ?? ""), i.description, i.url]);
    downloadText([head, ...rows].map((r) => r.map(cell).join(",")).join("\n"), `gfp-incidents-${ctx.asOf}.csv`);
  }

  /* ------------------------------------------------------------- render */
  let drawn = false;
  function render(state) {
    if (!drawn) { drawn = true; drawResults(state, true); return; }
    drawDetail(state, results());
  }

  return { render };
}
