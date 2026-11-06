# Geopolitical Forecasting Platform: subscriber view

The subscriber part of the New Lines Institute's Geopolitical Forecasting Platform (GFP): the Geopolitical Stability Index (GSI) map plus the Overview, Event Feed, Reports and Alerts screens. It is built from board 3 of the *Geopolitical Forecasts Tab Mockup*.

It is a static site: plain HTML, CSS and JavaScript modules, with no framework, no build step and no runtime dependencies. Any web server can host it.

The paywall, logins and subscriber accounts are **not** part of this code. IT adds them around it (see [For IT](#for-it-integrating-behind-the-paywall)).

## What's on each screen

| Tab | What it shows |
|---|---|
| **Overview** | The analyst summary (placeholder) beside the week's three reports: Weekly Forecast Monitor, podcast, quarterly. Below: incidents this week, most destabilized and most stabilized, key incidents, biggest movers, regions and themes, incidents by category, escalation balance over 12 weeks, and an 8-week heat table |
| **GSI Map** | A world map coloured by GSI, with bubbles counting each country's incidents that week. It zooms (+/−, double-click, pinch, Ctrl/⌘ + scroll), and zoomed in, bubbles add names and GSI. A switch moves between *Country level* and *Regions & themes*; NATO covers all of Europe plus Ukraine, Belarus and Russia. Below the map: the selection's events week by week, the full event detail, and a profile with a weekly trend that marks incidents scored ±70 or more. Then a ranking table and that week's reports. Countries outside the 17 are grey and clickable: they show their incidents and profile, but no GSI. On narrower screens the profile sits between the map and the events. |
| **Event Feed** | Every incident, searchable. Filters cover dates, place, severity, category → type, scope, scenario and GSI direction. The filtered list downloads as CSV. |
| **Reports** | Weekly Forecast Monitors (one per week), quarterly forecasts and the podcast. All links are placeholders except the Q4 2026 quarterly. |
| **Alerts** | A **preview**: subscribers can build alerts and see how often each would have fired this year. Nothing is saved or sent. |

**Downloads.** Every Overview chart, and the trend chart on the GSI Map, has a **Download** button. It opens a pop-up offering three formats:
- **CSV**: the data only.
- **Excel**: an .xlsx with the title above the table and the copyright below it.
- **PNG**: the drawn chart, footed with "© 2026 The New Lines Institute".

The map downloads as a PNG directly, also with the copyright. The Event Feed downloads its filtered list as CSV or Excel.

Throughout the site:

- **Cite** gives the citation in Chicago, APA and MLA.
- **Share** copies a link to the exact view.
- **Download map** and **Download chart** save PNGs.

## How the GSI is calculated

All the arithmetic is in `js/model/gsi.js`.

- **An incident's score for one country, region or theme** counts toward that place's GSI only if its checkbox column is ticked ("Yes") and the matching `GSI …` column has a number. One incident can count toward several places, each with its own score.
- **Weekly GSI** = the average of those scores over the week's incidents. A week runs Saturday to Friday and is named by its Friday.
- **A week with no incidents is blank**, never 0. Blank weeks show white with a dashed outline, break the trend line, and show "–" in tables.
- **Taiwan** has no columns in the sheet yet. Until it does, Taiwan is scored from incidents whose Location is Taiwan, using each incident's headline GSI. Add `Taiwan` and `GSI Taiwan` columns and they are used automatically.
- **The headline GSI** (column J) is shown with each incident and used for sorting and filtering. It is not averaged into any country's GSI.

## Project layout

```
config.js                    THE file to edit: sheet, countries, regions, colours, placeholders
index.html                   page skeleton; each id is filled by one component
css/styles.css               all styles (New Lines branding from the mockup)
data/
  incidents.json             built from the spreadsheet by tools/build-data.mjs (don't edit by hand)
  types.json                 the 34 incident types and their categories (also built)
  build-report.txt           sheet problems found by the last refresh, for the analysts
  profiles.json              country fact sheets, shown exactly as written (edit by hand)
  reports.json               report links (placeholders; edit by hand)
  world.json                 map outlines (Natural Earth; built once by tools/build_map.py)
js/
  main.js                    wiring: loads data, creates components, re-renders on change
  state.js                   what's selected; mirrors it in the address bar for share links
  data/load.js, normalize.js loading and cleaning the sheet's rows
  model/                     no DOM: gsi.js (all GSI maths), weeks.js, places.js, selection.js
  ui/                        format.js (numbers, colours), dom.js (helpers), problems.js ("couldn't load" notices)
  actions/                   cite, share, download, exportDialog (CSV/Excel/PNG pop-up), toast, tooltip
  export/pngCharts.js        draws the PNG version of each chart (same frame + copyright on all)
  components/                titleBar, tabs, eventDetail, trendChart, reportCards (shared pieces)
  components/map/            the GSI Map: toolbar, worldMap, eventsPanel, profilePanel, rankTable, reportsStrip
  screens/                   overview, feed, reports, alerts
  lib/csv.js                 CSV parser
  lib/xlsx.js, lib/zip.js    writes Excel files (no libraries needed)
tools/
  stamp.mjs                  fingerprints file addresses in index.html (run before pushing code changes)
  build-data.mjs             refreshes data/ from CSV exports (Node 18+, no packages needed)
  build_map.py               one-off: Natural Earth GeoJSON → data/world.json
```

Every component has the same shape and starts with a comment that says what it shows, which state it reads and writes, and which element it fills:

```js
export function createThing(ctx) {
  // set up once
  return { render(state) { /* draw for this state */ } };
}
```

Components never call each other. They change what's shown only through `ctx.store.set({...})`.

## Updates can't blank the page

Two safeguards keep one bad or outdated file from taking the whole site down:

1. **Fingerprinted file addresses.** `node tools/stamp.mjs` (also `npm run stamp`) gives every script and the stylesheet an address that includes a fingerprint of its contents, e.g. `js/ui/dom.js?v=3f9a1c2e`. When a file changes, its address changes, so browsers fetch the new copy instead of mixing it with old ones from their cache.

   **Run it before pushing any change to `js/`, `config.js` or `css/`.** Data refreshes don't need it.

2. **Isolation.** `js/main.js` loads each part of the page (map, events, Overview, Event Feed…) separately, and draws each one inside its own error guard. If one part fails, its box shows a short "reload" notice and a banner appears at the top. Everything else keeps working, and the details go to the browser console. If the core itself can't start, `index.html` shows a "couldn't start" message instead of an empty page.

When IT hosts the site, they can also serve `index.html` with `Cache-Control: no-cache`. The fingerprinted files can then be cached for as long as they like.

## Common changes

| To… | Edit |
|---|---|
| Add or rename a spotlight country | `config.js` → `entities` (add the sheet's checkbox and score column names) |
| Change which countries are shaded for a region | `config.js` → the region's `members` (map names are listed in `data/world.json`) |
| Move a crowded map bubble | `config.js` → the country's `chipAt: [longitude, latitude]` |
| Change which incidents are marked on the trend chart | `config.js` → `trendMarkerThreshold` (default 70) |
| Change how far the map zooms, or when bubbles show names | `config.js` → `mapZoom` |
| Fix a location that doesn't appear on the map | `config.js` → `placeAliases` (spelling) or `placePins` (small places) |
| Change colours | `config.js` → `scale`, `otherPlaceFill`, `emptyPlaceFill`, plus `css/styles.css` |
| Update a country profile | `data/profiles.json` |
| Replace placeholder report links | `data/reports.json` |
| Set the real address for citations and share links | `config.js` → `publicUrl` |
| Change the copyright line on downloads | `config.js` → `copyright` |
| Add a Download button to a new chart | Give it a spec (title, columns, rows, optional `image`) and call `openExport(spec)`. See `js/actions/exportDialog.js`. |
| Replace the Mass Atrocities placeholder | `config.js` → `crossLinks` |

## Updating the data

The site is **static**: nothing reads the spreadsheet automatically. When you want to publish new incidents (e.g. each Friday):

1. **Export three tabs as CSV into one folder** (e.g. a folder called `exports` on your desktop):
   - **Incidents - Global**
   - **Incidents - Type**
   - **Incidents - Category Mapping**

   In Google Sheets, open each tab and use *File → Download → Comma-separated values (.csv)*. In Excel, open each tab and use *File → Save As → CSV UTF-8*.

   Any file name works, as long as it **ends with the tab's name**. Google's default names, like `Global Incident Feed … - Incidents - Global.csv`, work as they are.
2. **Rebuild the data.** From this project folder, run:
   ```
   node tools/build-data.mjs ~/Desktop/exports
   ```
   This needs [Node.js](https://nodejs.org) 18 or newer, and no other installs. It:
   - cleans the rows (`js/data/normalize.js`): standardizes the five severity levels, matches types to the type list, and assigns each incident its week;
   - publishes incidents dated through the most recent Friday into `data/incidents.json` and `data/types.json`;
   - lists anything the analysts should check in `data/build-report.txt`, e.g. a ticked checkbox with no score, an unknown type, or a possible duplicate.

   **Safety check:** if the new data has fewer than half as many incidents as the current data (a wrong or empty export), nothing is written.
3. **Check it locally** (see below), then **commit and push** the `data/` folder. In GitHub Desktop, write a summary like "Data through Nov 6", then *Commit to main* → *Push origin*.

### Moving the spreadsheet to Excel

Nothing in the site depends on Google. As long as the Excel workbook keeps the same three tabs and column headings, the steps above work unchanged with CSVs saved from Excel. If tabs are renamed, update the names in `config.js` → `sheet.tabs`.

Later, the refresh could be automated by reading the workbook from SharePoint or OneDrive through Microsoft Graph and running this same script on a schedule. Only the "read the file" step would change.

### Running locally

```
python3 -m http.server 8000      # then open http://localhost:8000
```

The page must be served over http(s), not opened as a file, because browsers block module scripts and data files on `file://` pages.

## For IT: integrating behind the paywall

- **Static files.** Everything the page needs is in this folder. Fonts come from Google Fonts.
- **Embedding.** There are two ways to put it on the site:
  1. **Iframe.** Load `index.html?embed=1`. Embed mode hides this page's own header and footer, and the page sends `{ type: "gfp:height", height }` with `postMessage` so the host page can size the iframe.
  2. **Copy the folder** into the site and link `css/styles.css` and `js/main.js` from a page that contains the same element ids as `index.html`. Everything is scoped under `.gfp`.
- **Login and paywall.** Protect this folder (or the page that embeds it) with the site's existing subscriber login. Put `[SUBSCRIBER NAME]` (`config.js` → `subscriberName`, shown in the header) behind the real account name.
- **Alerts** need a backend to save and send them. `js/screens/alerts.js` defines the three alert kinds and the logic that checks whether each would fire.
- **The data is the paid product.** If the site is hosted in a public place (e.g. GitHub Pages on a public repo), `data/incidents.json` is publicly readable. Host it behind the login.
- **"Motion."** The code doesn't depend on any framework or animation library, so it can sit inside whatever the site uses. Each screen could also be wrapped as a component.

## Credits

- Map outlines: [Natural Earth](https://www.naturalearthdata.com), public domain.
- Country profiles: the Geopolitical Forecasting and Analysis Unit's strategic-profiles outline. Population from Worldometer, GDP from the World Bank, military spending from SIPRI Milex.
