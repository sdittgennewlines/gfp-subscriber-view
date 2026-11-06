/**
 * main.js: entry point. Loads the data, builds the shared context, creates
 * every component and re-renders them whenever the state changes.
 *
 * HOW THE CODE IS ORGANISED
 *
 *   config.js                 the one file to edit (sheet, entities, colours, placeholders)
 *   js/main.js                this file: wiring only
 *   js/state.js               the store (what's selected) + share links
 *   js/data/                  loading and cleaning the data
 *   js/model/                 the GSI arithmetic, weeks, places, selection: no DOM
 *   js/ui/                    formatting and DOM helpers
 *   js/actions/               cite, share, download, toast, tooltip
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
 * write it in that shape and add it to the `components` list below.
 */
import { CONFIG } from "../config.js";
import { loadAll } from "./data/load.js";
import { createStore } from "./state.js";
import { createGsi } from "./model/gsi.js";
import { createPlaces } from "./model/places.js";
import { validSel } from "./model/selection.js";
import { byId } from "./ui/dom.js";
import { longDate } from "./model/weeks.js";

import { createTitleBar } from "./components/titleBar.js";
import { createTabs } from "./components/tabs.js";
import { createMapToolbar } from "./components/map/toolbar.js";
import { createWorldMap } from "./components/map/worldMap.js";
import { createEventsPanel } from "./components/map/eventsPanel.js";
import { createProfilePanel } from "./components/map/profilePanel.js";
import { createRankTable } from "./components/map/rankTable.js";
import { createReportsStrip } from "./components/map/reportsStrip.js";
import { createOverview } from "./screens/overview.js";
import { createFeed } from "./screens/feed.js";
import { createReports } from "./screens/reports.js";
import { createAlerts } from "./screens/alerts.js";
import { createCiteDialog } from "./actions/cite.js";
import { initExportDialog } from "./actions/exportDialog.js";

const app = byId("app");

// Embedded mode (?embed=1): hide our header and footer inside the New Lines
// site, and tell the host page how tall we are so the iframe can fit.
const embedded = /(^|[?&])embed=1/.test(location.search);
if (embedded) app.classList.add("is-embed");
const postHeight = () => {
  if (!embedded || window.parent === window) return;
  try { window.parent.postMessage({ type: "gfp:height", height: document.documentElement.scrollHeight }, "*"); } catch { /* ignore */ }
};

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

  // 5. Components. Order doesn't matter: each owns its own part of the page.
  byId("subscriberName").textContent = CONFIG.subscriberName;
  initExportDialog(); // the shared Download pop-up (CSV / Excel / PNG)
  //    `tab` = only render while that tab is showing (saves work on hidden screens).
  const components = [
    { make: createTitleBar },
    { make: createTabs },
    { make: createMapToolbar, tab: "map" },
    { make: createWorldMap, tab: "map" },
    { make: createEventsPanel, tab: "map" },
    { make: createProfilePanel, tab: "map" },
    { make: createRankTable, tab: "map" },
    { make: createReportsStrip, tab: "map" },
    { make: createOverview, tab: "overview" },
    { make: createFeed, tab: "feed" },
    { make: createReports, tab: "reports" },
    { make: createAlerts, tab: "alerts" },
    { make: createCiteDialog }
  ].map((c) => ({ ...c, instance: c.make(ctx) }));

  const renderAll = (state) => {
    for (const c of components) if (!c.tab || c.tab === state.tab) c.instance.render(state);
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
