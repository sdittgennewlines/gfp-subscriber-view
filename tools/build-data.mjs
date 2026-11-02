#!/usr/bin/env node
/**
 * build-data.mjs: refreshes the platform's data from CSV exports of the
 * incident spreadsheet. Rewrites data/incidents.json, data/types.json and
 * data/build-report.txt.
 *
 * The site is static: nothing reads the spreadsheet automatically. To update:
 *
 *   1. Export three tabs of the spreadsheet as CSV into one folder:
 *        "Incidents - Global"            (the incidents; feeds the GSI)
 *        "Incidents - Type"              (the list of incident types)
 *        "Incidents - Category Mapping"  (type → category, for the filters)
 *      Google Sheets: File → Download → Comma-separated values, once per tab.
 *      Excel:         File → Save As → "CSV UTF-8", once per tab.
 *      Any file name works as long as it ENDS with the tab's name, e.g.
 *      "Global Incident Feed - 2026 - Incidents - Global.csv" or
 *      "Incidents_Global.csv".
 *
 *   2. Run, from the project folder:
 *        node tools/build-data.mjs path/to/that/folder
 *
 *   3. Read data/build-report.txt (problems found in the sheet), check the
 *      site locally, then commit and push the data/ folder.
 *
 * Options:
 *   --as-of 2026-10-30   publish incidents through this date instead of the
 *                        most recent Friday (see below)
 *   --force              publish even if the safety check objects
 *
 * What gets published: incidents dated up to and including the most recent
 * Friday (or --as-of). Anything dated later waits for the next update, so
 * every published week is complete.
 *
 * Safety: if the new data has fewer than half the incidents of the current
 * data/incidents.json (wrong file, a tab exported empty), nothing is written.
 */
import { readFile, writeFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { CONFIG } from "../config.js";
import { parseCsvObjects } from "../js/lib/csv.js";
import { normalizeIncidents, normalizeTypes } from "../js/data/normalize.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* ----------------------------------------------------- finding the files */

/** "Incidents - Global" / "Incidents_Global.csv" → "incidents global" (for matching file names). */
const simplify = (s) => s.toLowerCase().replace(/\.csv$/, "").replace(/[^a-z0-9]+/g, " ").trim();

/** The CSV in `dir` whose name ends with the tab's name. Errors clearly if there isn't exactly one. */
async function findTabFile(dir, tabName, files) {
  const want = simplify(tabName);
  const matches = files.filter((f) => f.toLowerCase().endsWith(".csv") && (simplify(f) === want || simplify(f).endsWith(" " + want)));
  if (matches.length === 1) return path.join(dir, matches[0]);
  if (!matches.length) throw new Error(`No CSV for the "${tabName}" tab in ${dir}. Export that tab as CSV into the folder (its file name must end with "${tabName}").`);
  throw new Error(`More than one CSV in ${dir} looks like the "${tabName}" tab: ${matches.join(", ")}. Keep only one.`);
}

async function readTabs(dir) {
  const files = await readdir(dir);
  const read = async (tab) => parseCsvObjects(await readFile(await findTabFile(dir, tab.name, files), "utf8"));
  const tabs = CONFIG.sheet.tabs;
  return { incidents: await read(tabs.incidents), types: await read(tabs.types), categories: await read(tabs.categories) };
}

/* ------------------------------------------------------ "as of" Friday */

/**
 * The most recent Friday 5pm New York time at or before `now`, as the
 * Friday's date. Run on a Monday, it publishes through the previous Friday.
 */
function latestPublishFriday(now = new Date()) {
  const { weekday, hour, timeZone } = CONFIG.publish;
  // Today's date and hour in New York, whatever time zone this computer uses.
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23"
  }).formatToParts(now).map((p) => [p.type, p.value]));
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  const dow = new Date(today + "T00:00:00Z").getUTCDay();
  let back = (dow - weekday + 7) % 7; // days since the last Friday (0 if today is Friday)
  if (back === 0 && Number(parts.hour) < hour) back = 7; // Friday, but before 5pm
  return new Date(new Date(today + "T00:00:00Z").getTime() - back * 864e5).toISOString().slice(0, 10);
}

/* ---------------------------------------------------------------- main */

async function main(args) {
  const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
  const dir = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--as-of");
  if (!dir) throw new Error("Usage: node tools/build-data.mjs path/to/folder-with-csv-exports [--as-of YYYY-MM-DD] [--force]");

  const raw = await readTabs(dir);
  const types = normalizeTypes(raw.types, raw.categories);
  const { incidents: all, warnings } = normalizeIncidents(raw.incidents, CONFIG, types);

  const asOf = flag("--as-of") || latestPublishFriday();
  const incidents = all.filter((i) => i.date <= asOf);
  const held = all.length - incidents.length;
  if (held) warnings.push(`${held} incident(s) dated after ${asOf} held back until the next update.`);

  // Safety check against the data already on the site.
  const outFile = path.join(ROOT, CONFIG.files.incidents);
  let previous = null;
  try { previous = JSON.parse(await readFile(outFile, "utf8")); } catch { /* first run */ }
  const before = previous?.incidents?.length || 0;
  if (before && incidents.length < before * 0.5 && !args.includes("--force")) {
    throw new Error(`Stopped: ${incidents.length} incidents vs ${before} now on the site. Check the exports (right tabs? complete?), or rerun with --force.`);
  }

  const generated = new Date().toISOString();
  const source = `CSV exports in ${path.basename(path.resolve(dir))}`;
  await writeFile(outFile, JSON.stringify({ generated, asOf, source, count: incidents.length, incidents }));
  await writeFile(path.join(ROOT, CONFIG.files.types), JSON.stringify({ generated, types }, null, 2));
  await writeFile(path.join(ROOT, "data/build-report.txt"),
    `Built ${generated} from ${source}\nPublished ${incidents.length} incidents through ${asOf}.\n\n` +
    (warnings.length ? `Things to check in the sheet (${warnings.length}):\n- ${warnings.join("\n- ")}\n` : "No problems found.\n"));

  console.log(`Published ${incidents.length} incidents through ${asOf} (was ${before}). ${warnings.length} thing(s) to check: see data/build-report.txt`);
}

// Run when called as a script (not when imported, e.g. by tests).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((err) => { console.error(err.message); process.exit(1); });
}

export { latestPublishFriday };
