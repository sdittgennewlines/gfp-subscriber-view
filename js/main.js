/**
 * main.js: entry point. Loads the data, builds the shared context, loads
 * every component and re-renders them whenever the state changes.
 *
 * HOW THE CODE IS ORGANISED
 *
 *   config.js                 the one file to edit (sheet, entities, colours, placeholders)
 *   js/main.js                this file: wiring only
 *   js/state.js               the store (what's selected) + share links
 *   js/data/                  loading and cleaning the data
 *   js/model/                 the GSI arithmetic, weeks, places, selection: no DOM
 *   js/ui/                    formatting, DOM helpers, problem notices
 *   js/actions/               cite, share, download, export dialog, toast, tooltip
 *   js/export/                the PNG versions of charts
 *   js/components/            pieces of the page (title bar, tabs, event detail, trend chart)
 *   js/components/map/        the GSI Map screen, one file per box
 *   js/screens/               the other screens: overview, feed, reports, alerts
 *
 * EVERY COMPONENT FOLLOWS THE SAME PATTERN
 *
 *   export function createThing(ctx) {
 *     ...set up once (static markup, event handlers)...
 *     return { render(state) { ...draw for this state... } };
 *   }
 *
 * Components read from `ctx` (data + helpers, below) and `state`, and change
 * what's shown only by calling ctx.store.set({...}). To add a component,
 * write it in that shape and add a line to COMPONENTS below.
 *
 * ONE BROKEN PART NEVER BLANKS THE PAGE
 *
 *   - main.js itself only imports the small, stable core (data, state, GSI
 *     maths). Every component is loaded separately (dynamic import), so if
 *     one fails to load (a bug, or a browser holding an old copy of a file
 *     right after an update) only its box shows a "reload" notice
 *     (ui/problems.js) and the rest of the page works.
 *   - Each component's set-up and each render run inside try/catch, so an
 *     error while drawing one box doesn't stop the others.
 *   - If even the core can't start, index.html shows a message explaining
 *     how to reload, instead of an empty page.
 */
import { CONFIG } from "../config.js";
import { loadAll } from "./data/load.js";
import { createStore } from "./state.js";
import { createGsi } from "./model/gsi.js";
import { createPlaces } from "./model/places.js";
import { validSel } from "./model/selection.js";
import { byId } from "./ui/dom.js";
import { longDate } from "./model/weeks.js";
import { reportProblem } from "./ui/problems.js";

// Tell index.html's safety net that the core loaded (see the script there),
// and clear its message if a slow connection made it appear early.
window.gfpStarted = true;
byId("loadError").hidden = true;

/**
 * Every component, in no particular order (each owns its own part of the page).
 *   file  module to load (relative to this file)
 *   make  the function it exports
 *   el    the element it fills: where its "couldn't load" notice goes
 *   tab   only render while that tab is showing (saves work on hidden screens)
 *   init  true = a set-up function with no render (the Download pop-up)
 *   quiet true = has no box of its own (dialogs): if it fails, only the top
 *         banner appears
 */
const COMPONENTS = [
  { file: "./components/titleBar.js", make: "createTitleBar", el: "titleBar", name: "Title bar" },
  { file: "./components/tabs.js", make: "createTabs", el: "tabs", name: "Tabs" },
  { file: "./components/map/toolbar.js", make: "createMapToolbar", el: "mapToolbar", tab: "map", name: "Map toolbar" },
  { file: "./components/map/worldMap.js", make: "createWorldMap", el: "mapPanel", tab: "map", name: "Map" },
  { file: "./components/map/eventsPanel.js", make: "createEventsPanel", el: "eventsPanel", tab: "map", name: "Events" },
  { file: "./components/map/profilePanel.js", make: "createProfilePanel", el: "profilePanel", tab: "map", name: "Profile" },
  { file: "./components/map/rankTable.js", make: "createRankTable", el: "rankTable", tab: "map", name: "Ranking table" },
  { file: "./components/map/reportsStrip.js", make: "createReportsStrip", el: "reportsStrip", tab: "map", name: "Reports strip" },
  { file: "./screens/overview.js", make: "createOverview", el: "screen-overview", tab: "overview", name: "Overview" },
  { file: "./screens/feed.js", make: "createFeed", el: "screen-feed", tab: "feed", name: "Event Feed" },
  { file: "./screens/reports.js", make: "createReports", el: "screen-reports", tab: "reports", name: "Reports" },
  { file: "./screens/alerts.js", make: "createAlerts", el: "screen-alerts", tab: "alerts", name: "Alerts" },
  { file: "./actions/cite.js", make: "createCiteDialog", el: "dialogRoot", name: "Citations", quiet: true },
  { file: "./actions/exportDialog.js", make: "initExportDialog", el: "exportRoot", name: "Downloads", init: true, quiet: true }
];

const app = byId("app");

// Embedded mode (?embed=1): hide our header and footer inside the New Lines
// site, and tell the host page how tall we are so the iframe can fit.
const embedded = /(^|[?&])embed=1/.test(location.search);
if (embedded) app.classList.add("is-embed");
const postHeight = () => {
  if (!embedded || window.parent === window) return;
  try { window.parent.postMessage({ type: "gfp:height", height: document.documentElement.scrollHeight }, "*"); } catch { /* ignore */ }
};

/** Load one component's module and set it up. Returns null (and shows a notice) if that fails. */
async function loadComponent(spec, ctx) {
  try {
    const mod = await import(spec.file);
    const made = mod[spec.make](ctx);
    return spec.init ? { render() {} } : made;
  } catch (err) {
    reportProblem(spec, err);
    return null;
  }
}

async function start() {
  // 1. Data.
  const data = await loadAll(CONFIG);

  // 2. Models built from the data (pure calculations, no DOM).
  const gsi = createGsi(data.incidents, CONFIG, data.asOf);
  const places = createPlaces(data.incidents, CONFIG, data.world);

  // 3. State, starting from the latest week; a shared link can override any of it.
  const store = createStore({
    tab: "overview", // the page opens on the Overview
    level: "country",
    sel: CONFIG.defaultSelection.country,
    week: gsi.latestWeek,
    ev: null,
    unscored: false,
    range: "3M",
    cite: null,
    alertDraft: null
  });
  // Repair anything a stale or hand-edited link got wrong.
  const s = store.get();
  const week = s.week >= gsi.weeks[0] && s.week <= gsi.latestWeek && gsi.weeks.includes(s.week) ? s.week : gsi.latestWeek;
  const level = s.level === "region" ? "region" : "country";
  store.set({ level, week, sel: validSel({ gsi, places, cfg: CONFIG }, level, s.sel), tab: ["overview", "map", "feed", "reports", "alerts"].includes(s.tab) ? s.tab : "overview" });

  // 4. The shared context every component receives.
  const ctx = {
    cfg: CONFIG,
    store,
    gsi,
    places,
    incidents: data.incidents,
    byId: new Map(data.incidents.map((i) => [i.id, i])),
    world: data.world,
    profiles: data.profiles,
    reports: data.reports,
    types: data.types,
    asOf: data.asOf
  };
  byId("subscriberName").textContent = CONFIG.subscriberName;

  // 5. Components, all loaded in parallel; any that fail are left out.
  const loaded = await Promise.all(COMPONENTS.map(async (spec) => ({ spec, instance: await loadComponent(spec, ctx) })));
  const components = loaded.filter((c) => c.instance);

  const tabsMissing = !components.some((c) => c.spec.make === "createTabs");
  const renderAll = (state) => {
    // Without the tab bar, still show the right screen.
    if (tabsMissing) for (const id of ["overview", "map", "feed", "reports", "alerts"]) byId(`screen-${id}`).hidden = id !== state.tab;
    for (const c of components) {
      if (c.spec.tab && c.spec.tab !== state.tab) continue;
      try {
        c.instance.render(state);
      } catch (err) {
        reportProblem(c.spec, err); // this box shows a notice; the others carry on
      }
    }
    postHeight();
  };
  store.subscribe(renderAll);

  // 6. Footer note about the data.
  byId("dataNote").textContent =
    `Data: ${data.incidents.length.toLocaleString("en-US")} incidents recorded by the Geopolitical Forecasting and Analysis Unit, ` +
    `published through ${longDate(data.asOf)}. Updated ${CONFIG.publish.label}.`;

  renderAll(store.get());
  if (window.ResizeObserver) new ResizeObserver(postHeight).observe(document.body);
}

start().catch((err) => {
  console.error(err);
  byId("loadError").hidden = false;
});
