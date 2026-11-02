# Geopolitical Forecasting Platform: subscriber view

The subscriber part of the New Lines Institute's Geopolitical Forecasting Platform (GFP): the Geopolitical Stability Index (GSI) map plus the Overview, Event Feed, Reports and Alerts screens. It is built from board 3 of the *Geopolitical Forecasts Tab Mockup*.

It is a static site: plain HTML, CSS and JavaScript modules, with no framework, no build step and no runtime dependencies. Any web server can host it.

The paywall, logins and subscriber accounts are **not** part of this code. IT adds them around it (see [For IT](#for-it-integrating-behind-the-paywall)).

## What's on each screen

| Tab | What it shows |
|---|---|
| **Overview** | The week at a glance: key figures, an analyst summary (placeholder), key incidents, biggest movers, regions and themes, incidents by category, and an 8-week heat table |
| **GSI Map** | A world map shaded by GSI, with a switch between *Country level* and *Regions & themes*. Below it: the selection's events week by week, the full event detail, a profile with a weekly trend, a ranking table and that week's reports. Countries outside the 17 are grey and clickable: they show their incidents and profile, but no GSI. |
| **Event Feed** | Every incident, searchable. Filters cover dates, place, severity, category → type, scope, scenario and GSI direction. The filtered list downloads as CSV. |
| **Reports** | Weekly Forecast Monitors (one per week), quarterly forecasts and the podcast. All links are placeholders except the Q4 2026 quarterly. |
| **Alerts** | A **preview**: subscribers can build alerts and see how often each would have fired this year. Nothing is saved or sent. |

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
  incidents.json             built from the sheet every Friday (don't edit by hand)
  types.json                 the 34 incident types and their categories (also built)
  build-report.txt           sheet problems found by the last update, for the analysts
  profiles.json              country fact sheets, shown exactly as written (edit by hand)
  reports.json               report links (placeholders; edit by hand)
  world.json                 map outlines (Natural Earth; built once by tools/build_map.py)
js/
  main.js                    wiring: loads data, creates components, re-renders on change
  state.js                   what's selected; mirrors it in the address bar for share links
  data/load.js, normalize.js loading and cleaning the sheet's rows
  model/                     no DOM: gsi.js (all GSI maths), weeks.js, places.js, selection.js
  ui/                        format.js (numbers, colours), dom.js (helpers)
  actions/                   cite, share, download, toast, tooltip
  components/                titleBar, tabs, eventDetail (shared), trendChart (shared)
  components/map/            the GSI Map: toolbar, worldMap, eventsPanel, profilePanel, rankTable, reportsStrip
  screens/                   overview, feed, reports, alerts
  lib/csv.js                 CSV parser
tools/
  build-data.mjs             the Friday update (Node 18+, no packages needed)
  build_map.py               one-off: Natural Earth GeoJSON → data/world.json
.github/workflows/update-data.yml   runs build-data.mjs every Friday at 5pm ET
```

Every component has the same shape and starts with a comment that says what it shows, which state it reads and writes, and which element it fills:

```js
export function createThing(ctx) {
  // set up once
  return { render(state) { /* draw for this state */ } };
}
```

Components never call each other. They change what's shown only through `ctx.store.set({...})`.

## Common changes

| To… | Edit |
|---|---|
| Add or rename a spotlight country | `config.js` → `entities` (add the sheet's checkbox and score column names) |
| Change which countries are shaded for a region | `config.js` → the region's `members` (map names are listed in `data/world.json`) |
| Move a crowded map chip | `config.js` → the country's `chipAt: [longitude, latitude]` |
| Fix a location that doesn't appear on the map | `config.js` → `placeAliases` (spelling) or `placePins` (small places) |
| Change colours | `config.js` → `scale`, `otherPlaceFill`, `emptyPlaceFill`, plus `css/styles.css` |
| Update a country profile | `data/profiles.json` |
| Replace placeholder report links | `data/reports.json` |
| Set the real address for citations and share links | `config.js` → `publicUrl` |
| Replace the Mass Atrocities placeholder | `config.js` → `crossLinks` |

## The Friday update

`.github/workflows/update-data.yml` runs every Friday at 5pm ET (two UTC triggers cover daylight saving). It:

1. reads three tabs of the sheet: *Incidents - Global*, *Incidents - Type* and *Incidents - Category Mapping*;
2. cleans the rows (`js/data/normalize.js`): standardizes the five severity levels, matches types to the type list, and computes each incident's week;
3. publishes incidents dated up to that Friday into `data/incidents.json` and `data/types.json`, and lists anything the analysts should check in `data/build-report.txt` (e.g. a ticked checkbox with no score, an unknown type, a possible duplicate);
4. commits the files, which republishes the site.

**Safety checks.** If the new data has fewer than half as many incidents as last week (a broken export), the run stops and the site keeps last week's data. If nothing changed, nothing is committed.

To run the update by hand, open the **Actions** tab → **Friday data update** → **Run workflow**. Or run it locally with `node tools/build-data.mjs`.

### Connecting the sheet

Pick one of two options.

**Option A (recommended): a Google service account.** The sheet stays private.

1. In Google Cloud Console, create a project (or use an existing one), enable the **Google Sheets API**, and create a **service account**. Create a JSON key for it.
2. Share the Google Sheet with the service account's email address, as **Viewer**.
3. In this GitHub repository, go to Settings → Secrets and variables → Actions → **New repository secret**. Name it `GOOGLE_SERVICE_ACCOUNT_JSON` and paste the whole JSON key file as the value.

**Option B: link sharing.** In the sheet, set Share → *Anyone with the link* → **Viewer**. No secret is needed, but anyone with the sheet's URL can read it.

### Running locally

```
python3 -m http.server 8000      # then open http://localhost:8000
node tools/build-data.mjs --local ./exports    # rebuild from CSVs saved from the sheet
```

The page must be served over http(s), not opened as a file, because browsers block module scripts and data files from `file://` pages.

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
