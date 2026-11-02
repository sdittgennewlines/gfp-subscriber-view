/**
 * normalize.js: turns raw sheet rows into clean incident objects.
 *
 * Used by tools/build-data.mjs (the data refresh, in Node). It has no
 * browser or Node dependencies, so it could also run in the page if the site
 * ever reads the sheet directly.
 *
 * Input:  rows from the "Incidents - Global" tab, as { columnName: text }
 *         objects (see lib/csv.js), plus the incident type list.
 * Output: { incidents, warnings }
 *
 * One incident looks like:
 *   {
 *     id:        "2026-10-22-k3x9f1",   stable across rebuilds (date + title/link hash)
 *     date:      "2026-10-22",
 *     week:      "2026-10-23",          the Friday that ends its GSI week
 *     scope:     "Country" | "International"
 *     scenario:  "Escalation" | "De-escalation" | "Status quo"
 *     type:      "Diplomatic agreements"
 *     category:  "Diplomatic/Political action"
 *     severity:  "Low" | "Low/Medium" | "Medium" | "Medium/High" | "High" | ""
 *     location:  "Venezuela"            as written in the sheet
 *     title, description, url
 *     gsi:       10                     headline score for the incident (or null)
 *     scores:    { Venezuela: 10, Americas: 10 }   per-entity scores that count
 *                                       toward each entity's weekly GSI
 *   }
 *
 * Columns are looked up by NAME, so reordering columns in the sheet is safe.
 */
import { weekOf } from "../model/weeks.js";

/* ----------------------------------------------------------- helpers */

const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

/** A ticked checkbox: "Yes", "TRUE", "x", "✓" or "1" (any case). */
const isTicked = (s) => /^(yes|true|x|✓|✔|1)$/i.test(clean(s));

/** "−10", "-10", "10.0" → number; anything else → null. */
function toNumber(s) {
  const t = clean(s).replace(/−/g, "-");
  if (t === "" || !/^[-+]?\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}

/** "10/22/2026" or "10/22/26" → "2026-10-22"; anything else → null. */
function toIsoDate(s) {
  const m = clean(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!m) return null;
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const d = new Date(Date.UTC(year, Number(m[1]) - 1, Number(m[2])));
  if (d.getUTCMonth() !== Number(m[1]) - 1) return null; // e.g. 2/31
  return d.toISOString().slice(0, 10);
}

/** Short, stable hash (FNV-1a, base 36) used to build incident ids. */
function hash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}

/**
 * Fold the sheet's many spellings of severity into the five standard levels.
 * "low", "Low / Medium", "low/medium", "Medium/High" ... → "Low/Medium" etc.
 */
export function normalizeSeverity(s, levels) {
  const key = clean(s).toLowerCase().replace(/\s*\/\s*/g, "/");
  return levels.find((l) => l.toLowerCase() === key) || "";
}

/** "Status quo " / "status quo" → "Status quo"; "de-escalation" → "De-escalation". */
function normalizeScenario(s) {
  const t = clean(s).toLowerCase();
  if (!t) return "";
  if (t.startsWith("status")) return "Status quo";
  if (t.startsWith("de-esc") || t.startsWith("deesc")) return "De-escalation";
  if (t.startsWith("esc")) return "Escalation";
  return clean(s);
}

/* -------------------------------------------------------------- main */

/**
 * @param rows    sheet rows as objects (column name → text)
 * @param config  CONFIG from config.js
 * @param types   [{ name, category }] from the Type + Category Mapping tabs
 */
export function normalizeIncidents(rows, config, types) {
  const warnings = [];
  const warn = (row, msg) => warnings.push(`Row ${row}: ${msg}`);

  // Type lookup is case/space-insensitive so "military  exercises" still matches.
  const typeIndex = new Map(types.map((t) => [t.name.toLowerCase(), t]));
  const columns = new Set(Object.keys(rows[0] || {}));

  const incidents = [];
  rows.forEach((r, i) => {
    const rowNo = i + 2; // +1 for the header row, +1 because sheets count from 1
    const title = clean(r["Title"]);
    const date = toIsoDate(r["Date & Time"]);
    if (!title && !date) return; // blank row
    if (!date) { warn(rowNo, `unreadable date "${clean(r["Date & Time"])}" (skipped)`); return; }

    // Type and its category.
    const rawType = clean(r["Type"]);
    const t = typeIndex.get(rawType.toLowerCase());
    if (rawType && !t) warn(rowNo, `type "${rawType}" is not in the Incidents - Type list (filed under "Uncategorized")`);

    // Severity.
    const severity = normalizeSeverity(r["Severity"], config.severities);
    if (clean(r["Severity"]) && !severity) warn(rowNo, `unrecognized severity "${clean(r["Severity"])}"`);

    const location = clean(r["Location"]);
    const gsi = toNumber(r["GSI"]);

    // Per-entity scores. An entity's score counts only if its checkbox is
    // ticked AND a number is present.
    const scores = {};
    for (const e of config.entities) {
      const hasColumns = columns.has(e.check) && columns.has(e.score);
      if (hasColumns) {
        const ticked = isTicked(r[e.check]);
        const score = toNumber(r[e.score]);
        if (ticked && score !== null) scores[e.key] = score;
        else if (ticked) warn(rowNo, `"${e.check}" is ticked but "${e.score}" has no number (not counted)`);
      } else if (e.fallback === "location" && location === e.place && gsi !== null) {
        // No columns for this entity yet: score it from incidents located there.
        scores[e.key] = gsi;
      }
    }

    incidents.push({
      id: `${date}-${hash(title + "|" + clean(r["Link"]))}`,
      date,
      week: weekOf(date, config.weekStartsOn),
      scope: clean(r["Scope"]),
      scenario: normalizeScenario(r["Scenario"]),
      type: t ? t.name : rawType,
      category: t ? t.category : rawType ? "Uncategorized" : "",
      severity,
      location,
      title,
      description: clean(r["Description"]),
      url: clean(r["Link"]),
      gsi,
      scores
    });
  });

  // Flag likely double entries (same date and title) for the analysts to check.
  const titles = new Map();
  for (const inc of incidents) {
    const k = `${inc.date}|${inc.title.toLowerCase()}`;
    if (titles.has(k)) warnings.push(`Possible duplicate: "${inc.title}" (${inc.date}) appears more than once (types: ${titles.get(k)}, ${inc.type})`);
    else titles.set(k, inc.type);
  }

  // Ids must be unique (two rows with identical date, title and link).
  const seen = new Map();
  for (const inc of incidents) {
    const n = seen.get(inc.id) || 0;
    seen.set(inc.id, n + 1);
    if (n) inc.id += `-${n + 1}`;
  }

  // Newest first, which is how every list on the site shows them.
  incidents.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return { incidents, warnings };
}

/**
 * Build the type list from the two small tabs:
 *   "Incidents - Type"             one column, IncidentTypeName (the order to show them in)
 *   "Incidents - Category Mapping" IncidentTypeName → IncidentTypeCategory
 */
export function normalizeTypes(typeRows, mappingRows) {
  const categoryOf = new Map(mappingRows.map((r) => [clean(r.IncidentTypeName).toLowerCase(), clean(r.IncidentTypeCategory)]));
  const names = typeRows.map((r) => clean(r.IncidentTypeName)).filter(Boolean);
  return names.map((name) => ({ name, category: categoryOf.get(name.toLowerCase()) || "Uncategorized" }));
}
