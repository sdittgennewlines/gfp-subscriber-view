/**
 * csv.js: a small, dependency-free CSV parser (RFC 4180).
 *
 * Handles quoted fields, doubled quotes ("") inside quotes, commas and line
 * breaks inside quotes, and both \n and \r\n line endings. That is all the
 * Google Sheets CSV export ever produces.
 *
 * parseCsv(text)        → array of rows, each an array of strings
 * parseCsvObjects(text) → array of { header: value } objects, using the
 *                         first row as headers (blank rows are dropped)
 */

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } // escaped quote
        else inQuotes = false; // closing quote
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++; // \r\n counts once
      row.push(field); rows.push(row);
      row = []; field = "";
    } else field += ch;
  }

  // Last field / row (files may or may not end with a newline).
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export function parseCsvObjects(text) {
  const [header = [], ...body] = parseCsv(text.replace(/^﻿/, "")); // strip BOM
  const keys = header.map((h) => h.trim());
  return body
    .filter((r) => r.some((c) => c.trim() !== ""))
    .map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i] ?? ""])));
}
