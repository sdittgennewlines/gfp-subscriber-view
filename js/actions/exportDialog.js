/**
 * exportDialog.js: the "Download" pop-up shared by every chart.
 *
 *   ┌ DOWNLOAD ─────────────────────────────── × ┐
 *   │ Biggest movers                              │
 *   │ Week of Oct 24–30, 2026                     │
 *   │ [ CSV ]   [ Excel ]   [ PNG image ]         │
 *   └─────────────────────────────────────────────┘
 *
 * openExport(spec) opens it. A spec describes one chart's data once, and the
 * dialog turns it into whichever format the reader picks:
 *
 *   {
 *     title:    "Biggest movers",
 *     subtitle: "Week of Oct 24–30, 2026 · change in GSI vs last week",
 *     filename: "biggest-movers-2026-10-30"        (no extension)
 *     columns:  [{ label: "Name", width: 28 }, ...] (width in Excel characters)
 *     rows:     [["Indonesia", -10, 33.3], ...]     (numbers stay numbers)
 *     image:    () => ({ svg, width, height })     optional: PNG version,
 *                                                   from export/pngCharts.js
 *   }
 *
 * CSV  = the data only (opens anywhere).
 * Excel = the same table with the title above and the copyright below.
 * PNG  = the drawn chart, with the copyright line (config.copyright).
 *
 * The dialog lives in #exportRoot (separate from the citation dialog).
 */
import { CONFIG } from "../../config.js";
import { byId, esc, onAction } from "../ui/dom.js";
import { downloadText, downloadBytes, downloadSvgAsPng, slug } from "./download.js";
import { makeXlsx } from "../lib/xlsx.js";

let current = null; // the open spec
let lastFocus = null;

/** CSV text from a spec (RFC 4180: quote fields containing , " or line breaks). */
export function toCsv(columns, rows) {
  const cell = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.map((c) => c.label), ...rows].map((r) => r.map(cell).join(",")).join("\n");
}

function close() {
  byId("exportRoot").innerHTML = "";
  current = null;
  lastFocus?.focus();
}

/** Do the download in the chosen format, then close. */
function run(format) {
  const s = current;
  if (!s) return;
  const base = slug(s.filename || s.title);
  close();
  if (format === "csv") downloadText(toCsv(s.columns, s.rows), `${base}.csv`);
  if (format === "xlsx") {
    const bytes = makeXlsx({ sheetName: s.title, title: s.title, subtitle: s.subtitle, columns: s.columns, rows: s.rows, footer: CONFIG.copyright });
    downloadBytes(bytes, `${base}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  }
  if (format === "png" && s.image) {
    const img = s.image();
    downloadSvgAsPng(img.svg, img.width, img.height, `${base}.png`);
  }
}

/** Set up the dialog's event handling once (called from main.js). */
export function initExportDialog() {
  const root = byId("exportRoot");
  onAction(root, {
    "export-close": close,
    "export-backdrop": (el, ev) => { if (ev.target === el) close(); },
    "export-format": (b) => run(b.dataset.format)
  });
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && current) close(); });
}

/** Open the dialog for one chart's spec. */
export function openExport(spec) {
  current = spec;
  lastFocus = document.activeElement;
  const option = (format, label, hint) => `
    <button class="export-opt" data-action="export-format" data-format="${format}">
      <span class="f">${label}</span><span class="h">${hint}</span>
    </button>`;
  byId("exportRoot").innerHTML = `
    <div class="overlay" data-action="export-backdrop">
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="export-title" style="max-width:600px">
        <button class="x" data-action="export-close" aria-label="Close">×</button>
        <div style="display:flex;flex-direction:column;gap:6px;padding-right:40px">
          <span class="eyebrow gold" style="letter-spacing:1px">DOWNLOAD</span>
          <h2 id="export-title">${esc(spec.title)}</h2>
          ${spec.subtitle ? `<span style="font-size:14px;color:var(--ink-2)">${esc(spec.subtitle)}</span>` : ""}
        </div>
        <div class="export-opts">
          ${option("csv", "CSV", "The data, for any spreadsheet or data tool")}
          ${option("xlsx", "Excel", "The data as an .xlsx workbook")}
          ${spec.image ? option("png", "PNG image", `The chart as a picture, with ${esc(CONFIG.copyright)}`) : ""}
        </div>
      </div>
    </div>`;
  byId("exportRoot").querySelector(".export-opt").focus();
}

/** The small "Download" button placed in each chart's header. */
export const downloadButton = (id) =>
  `<button class="btn dl-btn" data-action="download" data-chart="${id}" aria-label="Download this chart">
     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>Download</button>`;
