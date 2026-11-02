#!/usr/bin/env node
/**
 * build-data.mjs: the Friday update. Reads the Google Sheet and rewrites
 * data/incidents.json and data/types.json.
 *
 * Run by .github/workflows/update-data.yml every Friday at 5pm ET, and by
 * hand whenever you want:
 *
 *   node tools/build-data.mjs                     read the live sheet
 *   node tools/build-data.mjs --local ./exports   read CSV files instead
 *                                                 (Incidents_Global.csv,
 *                                                  Incidents_Type.csv,
 *                                                  Incidents_Category_Mapping.csv)
 *   node tools/build-data.mjs --as-of 2026-10-30  publish through a given Friday
 *
 * How it reads the sheet (first that applies):
 *   1. GOOGLE_SERVICE_ACCOUNT_JSON is set (a GitHub secret): the Sheets API,
 *      as that service account. Share the sheet with the account's email
 *      (Viewer). The sheet itself can stay private. Recommended.
 *   2. Otherwise: the sheet's CSV export link. This only works if the sheet
 *      is shared as "Anyone with the link can view".
 *
 * What gets published: incidents dated up to and including the most recent
 * Friday (the "as of" date). Anything dated later waits for next Friday.
 *
 * Safety: if the new file would have far fewer incidents than the current
 * one (a broken export, a deleted tab), the script stops without writing,
 * so the site keeps last week's data and the Action run shows as failed.
 */
import { readFile, writeFile } from "node:fs/promises";
import { createSign } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { CONFIG } from "../config.js";
import { parseCsvObjects } from "../js/lib/csv.js";
import { normalizeIncidents, normalizeTypes } from "../js/data/normalize.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const argValue = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };

/* --------------------------------------------------- reading the sheet */

/** Tab name → the file name used with --local ("Incidents - Global" → Incidents_Global.csv). */
const localFileName = (tab) => tab.name.replace(/[^A-Za-z0-9]+/g, "_") + ".csv";

/** Turn a 2-D array (first row = headers) into row objects, like parseCsvObjects. */
function gridToObjects(grid) {
  const [header = [], ...body] = grid;
  const keys = header.map((h) => String(h).trim());
  return body
    .filter((r) => r.some((c) => String(c ?? "").trim() !== ""))
    .map((r) => Object.fromEntries(keys.map((k, i) => [k, String(r[i] ?? "")])));
}

/** Option 1: Sheets API with a service account (no extra packages needed). */
async function serviceAccountToken(json) {
  const sa = JSON.parse(json);
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(sa.private_key, "base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` })
  });
  if (!res.ok) throw new Error(`Google sign-in failed (${res.status}): ${await res.text()}`);
  return (await res.json()).access_token;
}

async function readTabWithApi(tab, token) {
  const range = encodeURIComponent(`'${tab.name}'`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.sheet.id}/values/${range}?valueRenderOption=FORMATTED_VALUE`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Could not read tab "${tab.name}" (${res.status}): ${await res.text()}`);
  return gridToObjects((await res.json()).values || []);
}

/** Option 2: the public CSV export link. */
async function readTabAsCsv(tab) {
  const url = `https://docs.google.com/spreadsheets/d/${CONFIG.sheet.id}/export?format=csv&gid=${tab.gid}`;
  const res = await fetch(url, { redirect: "follow" });
  const text = await res.text();
  if (!res.ok || /^\s*<!doctype html/i.test(text)) {
    throw new Error(`Could not download tab "${tab.name}" as CSV (${res.status}). Either share the sheet as "Anyone with the link can view", or set GOOGLE_SERVICE_ACCOUNT_JSON.`);
  }
  return parseCsvObjects(text);
}

/** Read the three tabs, from wherever the arguments/environment say. */
async function readTabs() {
  const tabs = CONFIG.sheet.tabs;
  const localDir = argValue("--local");
  if (localDir) {
    const read = async (tab) => parseCsvObjects(await readFile(path.join(localDir, localFileName(tab)), "utf8"));
    return { source: `local CSV files in ${localDir}`, incidents: await read(tabs.incidents), types: await read(tabs.types), categories: await read(tabs.categories) };
  }
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    const token = await serviceAccountToken(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const read = (tab) => readTabWithApi(tab, token);
    return { source: "Google Sheets API (service account)", incidents: await read(tabs.incidents), types: await read(tabs.types), categories: await read(tabs.categories) };
  }
  return { source: "Google Sheets CSV export", incidents: await readTabAsCsv(tabs.incidents), types: await readTabAsCsv(tabs.types), categories: await readTabAsCsv(tabs.categories) };
}

/* ------------------------------------------------------ "as of" Friday */

/**
 * The most recent publish moment (Friday 5pm New York time) at or before now,
 * as the Friday's date. Mid-week runs therefore publish through last Friday.
 */
function latestPublishFriday(now = new Date()) {
  const { weekday, hour, timeZone } = CONFIG.publish;
  // Today's date and hour in New York, whatever time zone the runner uses.
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", weekday: "short"
  }).formatToParts(now).map((p) => [p.type, p.value]));
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  const dow = new Date(today + "T00:00:00Z").getUTCDay();
  let back = (dow - weekday + 7) % 7; // days since the last Friday (0 if today is Friday)
  if (back === 0 && Number(parts.hour) < hour) back = 7; // Friday, but before 5pm
  const d = new Date(new Date(today + "T00:00:00Z").getTime() - back * 864e5);
  return d.toISOString().slice(0, 10);
}

/* ---------------------------------------------------------------- main */

async function main() {
  const raw = await readTabs();
  const types = normalizeTypes(raw.types, raw.categories);
  const { incidents: all, warnings } = normalizeIncidents(raw.incidents, CONFIG, types);

  const asOf = argValue("--as-of") || latestPublishFriday();
  const incidents = all.filter((i) => i.date <= asOf);
  const held = all.length - incidents.length;
  if (held) warnings.push(`${held} incident(s) dated after ${asOf} held back until they fall in a published week.`);

  // Compare with the file already on the site.
  const outFile = path.join(ROOT, CONFIG.files.incidents);
  let previous = null;
  try { previous = JSON.parse(await readFile(outFile, "utf8")); } catch { /* first run: no previous file */ }
  if (previous) {
    // Safety: a sudden drop means a broken export, not a real change.
    const before = previous.incidents?.length || 0;
    if (before && incidents.length < before * 0.5 && !args.includes("--force")) {
      throw new Error(`Refusing to publish: ${incidents.length} incidents vs ${before} last time. Check the sheet, or rerun with --force.`);
    }
    // Nothing new: leave the files alone (the Action then has nothing to commit).
    if (previous.asOf === asOf && JSON.stringify(previous.incidents) === JSON.stringify(incidents) && !args.includes("--force")) {
      console.log(`No changes since the last update (${incidents.length} incidents through ${asOf}).`);
      return;
    }
  }

  const generated = new Date().toISOString();
  await writeFile(outFile, JSON.stringify({ generated, asOf, source: raw.source, count: incidents.length, incidents }));
  await writeFile(path.join(ROOT, CONFIG.files.types), JSON.stringify({ generated, types }, null, 2));
  await writeFile(path.join(ROOT, "data/build-report.txt"),
    `Built ${generated} from ${raw.source}\nPublished ${incidents.length} incidents through ${asOf}.\n\n` +
    (warnings.length ? `Things to check in the sheet (${warnings.length}):\n- ${warnings.join("\n- ")}\n` : "No problems found.\n"));

  console.log(`Published ${incidents.length} incidents through ${asOf} (${types.length} types). ${warnings.length} warning(s): see data/build-report.txt`);
}

// Run when called as a script (not when imported, e.g. by tests).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error(err.message); process.exit(1); });
}

export { latestPublishFriday };
