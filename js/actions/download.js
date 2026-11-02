/**
 * download.js: saving things to the reader's computer.
 *
 *   downloadSvgAsPng(svgText, width, height, filename)
 *       Draws an SVG (map or chart) onto a canvas at 2x and saves a PNG.
 *   downloadText(text, filename, type)
 *       Saves a text file (the Event Feed's CSV export).
 *
 * The SVGs passed in are self-contained (no external fonts or CSS), because
 * a browser drawing an SVG into a canvas can't load anything external.
 */

export async function downloadSvgAsPng(svgText, width, height, filename) {
  const scale = 2;
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml;charset=utf-8" }));
  try {
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = url; });
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const g = canvas.getContext("2d");
    g.fillStyle = "#FFFFFF";
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    save(blob, filename);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function downloadText(text, filename, type = "text/csv;charset=utf-8") {
  save(new Blob(["﻿" + text], { type }), filename); // BOM so Excel reads accents correctly
}

/**
 * Hand a file to the reader. On a normal website this is an ordinary
 * browser download. Inside the claude.ai demo viewer, where pages can't
 * start downloads themselves, it goes through the viewer's "downloads"
 * capability, which asks the reader to confirm.
 */
async function save(blob, filename) {
  const viewer = window.claude?.use ? await window.claude.use("downloads").catch(() => null) : null;
  if (viewer) {
    try { await viewer.save({ filename, data: blob }); } catch (err) { if (err?.code !== "declined") console.warn("Download failed:", err); }
    return;
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** "Sudan GSI, week of Oct 24–30" → "sudan-gsi-week-of-oct-24-30" */
export const slug = (s) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Escape text for use inside SVG/XML. */
export const xml = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
