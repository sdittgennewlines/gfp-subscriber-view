/**
 * wording.js: how incidents and GSI values are described in words.
 *
 * The sheet no longer has Scope, Scenario or Severity columns. They are all
 * derived from the scores, by these rules (vocabulary in config.js):
 *
 *   LEVEL      from what the incident counts toward:
 *                Global         a global theme (Global Energy, Global Climate)
 *                International  a region, or two or more countries
 *                Country        otherwise (one country, or nothing)
 *   DIRECTION  the sign of the headline GSI: negative / 0 / positive
 *   WORDS      depend on the level:
 *                Country        destabilization / stabilization
 *                International  escalation / de-escalation
 *                Global         disruption / enhancement
 *                0              status quo
 *   SEVERITY   the size of the headline GSI:
 *                ±10 Low · ±30 Low/Medium · ±50 Medium · ±70 Medium/High · ±90 High
 *              (the same steps used for weekly GSI bands; 0 has no severity)
 *
 * Weekly GSI values get the words of their entity's level: a country
 * "destabilization", a region "escalation", a global theme "disruption".
 */
import { CONFIG } from "../../config.js";

const LEVEL_OF_ENTITY = { country: "Country", region: "International", theme: "Global" };

/** "Low" … "High" from a score's size; "" for |v| < 5 (status quo). */
export function severityOf(v) {
  if (v === null || v === undefined) return "";
  const a = Math.abs(v);
  if (a < 5) return "";
  return CONFIG.severities[a < 20 ? 0 : a < 40 ? 1 : a < 60 ? 2 : a < 80 ? 3 : 4];
}

/** An incident's level from its per-entity scores ({ entityKey: score }). */
export function levelOf(scores) {
  const levels = Object.keys(scores).map((k) => CONFIG.entities.find((e) => e.key === k)?.level);
  if (levels.includes("theme")) return "Global";
  if (levels.includes("region") || levels.filter((l) => l === "country").length >= 2) return "International";
  return "Country";
}

/** The word for a value at a level: "escalation", "stabilization", "status quo"… */
export function termOf(v, level) {
  if (v === null || v === undefined) return "";
  if (Math.abs(v) < 5) return CONFIG.vocabulary.zero;
  return CONFIG.vocabulary[level][v < 0 ? "neg" : "pos"];
}

/** Direction for filtering: "Destabilizing" | "Status quo" | "Stabilizing" (whatever the level's words). */
export function directionOf(v) {
  if (v === null || v === undefined) return "";
  return Math.abs(v) < 5 ? "Status quo" : v < 0 ? "Destabilizing" : "Stabilizing";
}

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** "Medium escalation", "Low stabilization", "Status quo": an incident's headline described. */
export function describe(v, level) {
  const t = termOf(v, level);
  const s = severityOf(v);
  return s ? `${lower2(s)} ${t}` : cap(t);
}

/** "Low/Medium" → "Low/medium" when it starts a phrase ("Low/medium escalation"). */
const lower2 = (s) => s.replace("/M", "/m").replace("/H", "/h");

/**
 * Words for a weekly GSI of an entity: "Low/medium destabilization" for a
 * country, "Medium escalation" for a region, "Low disruption" for a theme.
 * "No incidents this week" when blank.
 */
export function bandOf(v, entityLevel = "country") {
  if (v === null || v === undefined) return "No incidents this week";
  const level = LEVEL_OF_ENTITY[entityLevel] || "Country";
  const s = severityOf(v);
  return s ? `${lower2(s)} ${termOf(v, level)}` : cap(CONFIG.vocabulary.zero);
}

/** The words used at a level, for legends: "escalation / de-escalation". */
export const wordsFor = (level) => `${CONFIG.vocabulary[level].neg} / ${CONFIG.vocabulary[level].pos}`;
