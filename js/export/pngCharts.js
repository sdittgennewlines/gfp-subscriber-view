/**
 * pngCharts.js: draws the downloadable image (PNG) version of each chart.
 *
 * The on-page charts are HTML styled with CSS and web fonts, which a browser
 * can't turn into an image directly. So each chart also has a plain SVG
 * drawing here, built from the same numbers. Every image has the same frame:
 *
 *   Title                                   (Georgia, bold)
 *   Week of Oct 24–30, 2026 · subtitle
 *   ─────────────────────────────────────
 *   the chart
 *   ─────────────────────────────────────
 *   © 2026 The New Lines Institute          Geopolitical Forecasting and Analysis Unit
 *
 * Each builder returns { svg, width, height }, ready for
 * actions/download.js → downloadSvgAsPng. Fonts are ones every computer
 * has (Georgia, Helvetica/Arial), because a downloaded image can't load web fonts.
 *
 * Builders:
 *   tableImage   rows of text, with optional GSI badges and change arrows
 *   barsImage    horizontal bars (incidents by category)
 *   stackedImage stacked columns (escalation balance)
 *   heatImage    coloured grid (the last 8 weeks at a glance)
 *   embedImage   any existing SVG (the trend chart) placed in the frame
 */
import { CONFIG } from "../../config.js";
import { xml } from "../actions/download.js";
import { fmt, fmtInt, fmtChange, fill, ink, tint } from "../ui/format.js";

const M = 32; // outer margin
const HEAD = 84; // space for title + subtitle
const FOOT = 52; // space for the footer
const SANS = "Helvetica, Arial, sans-serif";
const SERIF = "Georgia, 'Times New Roman', serif";

/** Shorten text to roughly fit `px` pixels at `size` (no text measuring in SVG strings). */
function fit(text, px, size = 13) {
  const max = Math.max(4, Math.floor(px / (size * 0.52)));
  const s = String(text ?? "");
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}

/** Wrap a chart body in the standard frame. */
function frame({ title, subtitle, width, bodyHeight, body }) {
  const height = HEAD + bodyHeight + FOOT;
  const footY = HEAD + bodyHeight + 20;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${SANS}">
    <rect width="100%" height="100%" fill="#FFFFFF"/>
    <text x="${M}" y="${M + 10}" font-family="${SERIF}" font-size="22" font-weight="700" fill="#1B1725">${xml(title)}</text>
    <text x="${M}" y="${M + 34}" font-size="13" fill="#3E3A46">${xml(subtitle)}</text>
    <line x1="${M}" y1="${HEAD - 8}" x2="${width - M}" y2="${HEAD - 8}" stroke="#1B1725"/>
    <g transform="translate(0,${HEAD})">${body}</g>
    <line x1="${M}" y1="${footY}" x2="${width - M}" y2="${footY}" stroke="#DCDAD3"/>
    <text x="${M}" y="${footY + 20}" font-size="12" fill="#3E3A46">${xml(CONFIG.copyright)}</text>
    <text x="${width - M}" y="${footY + 20}" font-size="12" fill="#5E5A66" text-anchor="end">${xml(CONFIG.citation.author)}</text>
  </svg>`;
  return { svg, width, height };
}

/** A GSI value as a coloured badge, centred on x. */
function badge(x, y, v, { int = false } = {}) {
  const t = int ? fmtInt(v) : fmt(v);
  const w = t.length * 7.4 + 14;
  return `<rect x="${x - w / 2}" y="${y - 13}" width="${w}" height="20" rx="2" fill="${tint(v)}"/>
    <text x="${x}" y="${y + 1}" text-anchor="middle" font-size="12" font-weight="700" fill="${ink(v)}">${t}</text>`;
}

/**
 * A table. columns: [{ label, width, align?: "left"|"right"|"center", kind?: "text"|"gsi"|"gsiInt"|"change"|"num", sub?: column index shown small under this one }]
 * rows: arrays of values in column order (an extra value can sit after the last column for `sub`).
 */
export function tableImage({ title, subtitle, columns, rows }) {
  const width = M * 2 + columns.reduce((s, c) => s + c.width, 0);
  const rowH = columns.some((c) => c.sub !== undefined) ? 42 : 30;
  const bodyHeight = 28 + rows.length * rowH;
  let x = M;
  const xs = columns.map((c) => { const at = x; x += c.width; return at; });
  const anchor = (c) => (c.align === "right" ? "end" : c.align === "center" ? "middle" : "start");
  const ax = (c, i) => (c.align === "right" ? xs[i] + c.width - 8 : c.align === "center" ? xs[i] + c.width / 2 : xs[i]);

  const header = columns.map((c, i) => `<text x="${ax(c, i)}" y="14" text-anchor="${anchor(c)}" font-size="11" font-weight="700" letter-spacing="0.6" fill="#3E3A46">${xml(c.label.toUpperCase())}</text>`).join("") +
    `<line x1="${M}" y1="24" x2="${width - M}" y2="24" stroke="#DCDAD3"/>`;

  const body = rows.map((r, ri) => {
    const y = 28 + ri * rowH + (rowH === 42 ? 18 : 19);
    const cells = columns.map((c, i) => {
      const v = r[i];
      if (c.kind === "gsi" || c.kind === "gsiInt") return badge(ax(c, i) - (c.align === "right" ? 24 : 0), y, v, { int: c.kind === "gsiInt" });
      if (c.kind === "change") {
        if (v === null || v === undefined) return `<text x="${ax(c, i)}" y="${y}" text-anchor="${anchor(c)}" font-size="13" fill="#8C8A91">–</text>`;
        return `<text x="${ax(c, i)}" y="${y}" text-anchor="${anchor(c)}" font-size="13" font-weight="700" fill="${ink(v)}">${v > 0 ? "▲" : v < 0 ? "▼" : ""} ${fmtChange(v)}</text>`;
      }
      const text = c.kind === "num" ? String(v ?? "") : fit(v, c.width - 12, 13);
      const main = `<text x="${ax(c, i)}" y="${y}" text-anchor="${anchor(c)}" font-size="13" fill="#1B1725">${xml(text)}</text>`;
      const sub = c.sub !== undefined && r[c.sub] ? `<text x="${ax(c, i)}" y="${y + 16}" text-anchor="${anchor(c)}" font-size="11" fill="#5E5A66">${xml(fit(r[c.sub], c.width - 12, 11))}</text>` : "";
      return main + sub;
    }).join("");
    return cells + `<line x1="${M}" y1="${28 + (ri + 1) * rowH}" x2="${width - M}" y2="${28 + (ri + 1) * rowH}" stroke="#ECEAE4"/>`;
  }).join("");

  return frame({ title, subtitle, width, bodyHeight, body: header + body });
}

/** Horizontal bars. rows: [{ label, value, colour }] */
export function barsImage({ title, subtitle, rows, width = 720 }) {
  const labelW = 230;
  const barW = width - M * 2 - labelW - 50;
  const max = Math.max(1, ...rows.map((r) => r.value));
  const rowH = 34;
  const body = rows.map((r, i) => {
    const y = i * rowH + 8;
    const w = (r.value / max) * barW;
    return `<text x="${M}" y="${y + 15}" font-size="13" fill="#1B1725">${xml(fit(r.label, labelW - 10))}</text>
      <rect x="${M + labelW}" y="${y + 3}" width="${Math.max(1, w)}" height="16" fill="${r.colour}"/>
      <text x="${M + labelW + w + 8}" y="${y + 16}" font-size="13" font-weight="700" fill="#1B1725">${r.value}</text>`;
  }).join("");
  return frame({ title, subtitle, width, bodyHeight: rows.length * rowH + 12, body });
}

/**
 * Stacked columns. columns: [{ label, parts: [{ value, colour }], highlight? }]
 * legend: [{ label, colour }], note: one line under the title strip.
 */
export function stackedImage({ title, subtitle, columns, legend, note = "", width = 820 }) {
  const top = note ? 48 : 20; // room for the note and the column totals
  const chartH = 220;
  const left = M + 30;
  const colW = (width - left - M) / columns.length;
  const max = Math.max(1, ...columns.map((c) => c.parts.reduce((s, p) => s + p.value, 0)));
  const step = max > 20 ? 20 : max > 10 ? 5 : 2;
  const y = (v) => top + chartH - (v / max) * chartH;

  const grid = [];
  for (let v = 0; v <= max; v += step) grid.push(`<line x1="${left}" y1="${y(v)}" x2="${width - M}" y2="${y(v)}" stroke="#ECEAE4"/><text x="${left - 6}" y="${y(v) + 4}" text-anchor="end" font-size="10" fill="#5E5A66">${v}</text>`);

  const cols = columns.map((c, i) => {
    let base = 0;
    const x = left + i * colW + 4;
    const w = colW - 8;
    const rects = c.parts.map((p) => {
      const r = `<rect x="${x}" y="${y(base + p.value)}" width="${w}" height="${(p.value / max) * chartH}" fill="${p.colour}"/>`;
      base += p.value;
      return r;
    }).join("");
    const total = c.parts.reduce((s, p) => s + p.value, 0);
    const hi = c.highlight ? `<rect x="${x - 2}" y="${y(total) - 2}" width="${w + 4}" height="${(total / max) * chartH + 2}" fill="none" stroke="#1B1725" stroke-width="2"/>` : "";
    return rects + hi +
      `<text x="${x + w / 2}" y="${y(total) - 5}" text-anchor="middle" font-size="10" fill="#3E3A46">${total}</text>` +
      `<text x="${x + w / 2}" y="${top + chartH + 16}" text-anchor="middle" font-size="10" fill="#5E5A66">${xml(c.label)}</text>`;
  }).join("");

  const legendY = top + chartH + 40;
  let lx = M;
  const leg = legend.map((l) => {
    const s = `<rect x="${lx}" y="${legendY - 9}" width="10" height="10" fill="${l.colour}"/><text x="${lx + 15}" y="${legendY}" font-size="12" fill="#3E3A46">${xml(l.label)}</text>`;
    lx += 30 + l.label.length * 7;
    return s;
  }).join("");

  const noteText = note ? `<text x="${M}" y="12" font-size="12.5" fill="#3E3A46">${xml(note)}</text>` : "";
  return frame({ title, subtitle, width, bodyHeight: legendY + 10, body: noteText + grid.join("") + `<line x1="${left}" y1="${y(0)}" x2="${width - M}" y2="${y(0)}" stroke="#1B1725"/>` + cols + leg });
}

/** Coloured grid. weeks: column labels; groups: [{ label, rows: [{ name, values: [number|null] }] }] */
export function heatImage({ title, subtitle, weeks, groups }) {
  const nameW = 210;
  const cellW = 78;
  const cellH = 24;
  const width = M * 2 + nameW + weeks.length * cellW;
  let y = 24;
  const header = weeks.map((w, i) => `<text x="${M + nameW + i * cellW + cellW / 2}" y="12" text-anchor="middle" font-size="10.5" font-weight="700" fill="#3E3A46">${xml(w)}</text>`).join("");
  const parts = [];
  for (const g of groups) {
    y += 8;
    parts.push(`<text x="${M}" y="${y + 12}" font-size="10.5" font-weight="700" letter-spacing="0.6" fill="#7A6528">${xml(g.label)}</text>`);
    y += 18;
    for (const r of g.rows) {
      parts.push(`<text x="${M}" y="${y + 16}" font-size="12.5" fill="#1B1725">${xml(fit(r.name, nameW - 10, 12.5))}</text>`);
      r.values.forEach((v, i) => {
        const x = M + nameW + i * cellW;
        parts.push(v === null
          ? `<rect x="${x + 2}" y="${y + 2}" width="${cellW - 4}" height="${cellH - 4}" fill="#FFFFFF" stroke="#CFCCC4" stroke-dasharray="3 2"/><text x="${x + cellW / 2}" y="${y + 16}" text-anchor="middle" font-size="11" fill="#8C8A91">–</text>`
          : `<rect x="${x + 1}" y="${y + 1}" width="${cellW - 2}" height="${cellH - 2}" fill="${fill(v)}"/><text x="${x + cellW / 2}" y="${y + 16}" text-anchor="middle" font-size="11" font-weight="700" fill="${Math.abs(v) >= 40 ? "#FFFFFF" : "#1B1725"}">${fmtInt(v)}</text>`);
      });
      y += cellH;
    }
  }
  return frame({ title, subtitle, width, bodyHeight: y + 8, body: header + parts.join("") });
}

/** Place an existing SVG chart (e.g. the trend chart) in the frame, scaled up. */
export function embedImage({ title, subtitle, svg, w, h, scale = 2, note = "" }) {
  const width = Math.max(560, w * scale + M * 2);
  // Drop the chart's own width/height (an attribute may only appear once), then size it for the frame.
  const inner = svg.trim().replace(/^<svg([^>]*?)\swidth="[^"]*"\sheight="[^"]*"/, "<svg$1")
    .replace(/^<svg /, `<svg x="${M}" y="${note ? 26 : 4}" width="${w * scale}" height="${h * scale}" `);
  const noteText = note ? `<text x="${M}" y="12" font-size="12" fill="#3E3A46">${xml(note)}</text>` : "";
  return frame({ title, subtitle, width, bodyHeight: h * scale + (note ? 30 : 8), body: noteText + inner });
}
