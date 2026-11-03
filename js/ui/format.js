/**
 * format.js: how GSI numbers look (text, colour, band name).
 * The colour steps come from config.scale, which mirrors the mockup.
 */
import { CONFIG } from "../../config.js";

const MINUS = "−"; // a real minus sign, not a hyphen

/** −12.5 → "−12.5", 7 → "+7.0", 0 → "0.0", null → "–" */
export function fmt(v) {
  if (v === null || v === undefined) return "–";
  const a = Math.abs(v).toFixed(1);
  if (a === "0.0") return "0.0";
  return v > 0 ? "+" + a : MINUS + a;
}

/** Whole-number version for chips and incident scores: −10, +30, 0 */
export function fmtInt(v) {
  if (v === null || v === undefined) return "–";
  const r = Math.round(v);
  return r > 0 ? "+" + r : r < 0 ? MINUS + Math.abs(r) : "0";
}

/** Signed change: "+4.2", "−1.0", "0.0", or "–" */
export const fmtChange = (v) => (v === null || v === undefined ? "–" : fmt(v));

/** Map/bar fill for a GSI value. Blank weeks are white (drawn with a dashed outline). */
export function fill(v) {
  if (v === null || v === undefined) return "#FFFFFF";
  const step = CONFIG.scale.find((s, i) => (s.max <= -5 ? v <= s.max : v < s.max) || i === CONFIG.scale.length - 1);
  return step.fill;
}

/** Text colour that reads on white: red for destabilizing, blue for stabilizing, dark gold for status quo. */
export const ink = (v) => (v === null || v === undefined ? "#5E5A66" : v <= -5 ? "#9E2F20" : v >= 5 ? "#1F4E8C" : "#7A6528");

/** Light background tint for score badges. */
export const tint = (v) => (v === null || v === undefined ? "#F1F0EC" : v <= -5 ? "#F7E1DD" : v >= 5 ? "#DEE8F5" : "#F6EED6");

/** Left-edge colour of an incident row, by its score (grey = no score). */
export const edge = (v) => (v === null || v === undefined ? "#CFCCC4" : v <= -5 ? "#C4483B" : v >= 5 ? "#3D6FB0" : "#C9A94E");

/** Inline style for a score badge (used all over). */
export const badgeStyle = (v) => `background:${tint(v)};color:${ink(v)}`;

/** "Low/medium destabilization", "Status quo", "No events this week" */
export function band(v) {
  if (v === null || v === undefined) return "No events this week";
  const a = Math.abs(v);
  if (a < 5) return "Status quo";
  const level = a < 20 ? "Low" : a < 40 ? "Low/medium" : a < 60 ? "Medium" : a < 80 ? "Medium/high" : "High";
  return `${level} ${v > 0 ? "stabilization" : "destabilization"}`;
}

/** "3 events" / "1 event" */
export const plural = (n, word) => `${n.toLocaleString("en-US")} ${word}${n === 1 ? "" : "s"}`;

/** "apnews.com" from a full link */
export const domain = (url) => (url || "").replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "");
