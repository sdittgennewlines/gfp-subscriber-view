/**
 * xlsx.js: writes a one-sheet Excel workbook (.xlsx), with no dependencies.
 *
 *   makeXlsx({ sheetName, title, subtitle, columns, rows, footer }) → Uint8Array
 *
 *   columns  [{ label, width? }]   header row (bold); width in characters
 *   rows     [[value, ...], ...]   numbers stay numbers (so Excel can sum
 *                                  and chart them); everything else is text;
 *                                  null/undefined/"" = empty cell
 *   title, subtitle, footer        optional lines above / below the table
 *
 * Layout:  1 title (bold) · 2 subtitle · 3 blank · 4 headers · data … · blank · footer
 *
 * An .xlsx is a zip of a few XML files; this writes the smallest set Excel,
 * Numbers, LibreOffice and Google Sheets all open without complaint.
 */
import { makeZip } from "./zip.js";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]))
  // Characters XML forbids (control codes) would make Excel refuse the file.
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

/** 0 → "A", 25 → "Z", 26 → "AA" */
function colName(i) {
  let s = "";
  for (i += 1; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
}

// Cell styles (indexes into cellXfs below): 0 normal, 1 bold, 2 title, 3 small grey.
const STYLE = { normal: 0, bold: 1, title: 2, note: 3 };

function cell(ref, value, style = 0) {
  const s = style ? ` s="${style}"` : "";
  if (value === null || value === undefined || value === "") return style ? `<c r="${ref}"${s}/>` : "";
  if (typeof value === "number" && Number.isFinite(value)) return `<c r="${ref}"${s}><v>${value}</v></c>`;
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
}

export function makeXlsx({ sheetName = "Data", title = "", subtitle = "", columns, rows, footer = "" }) {
  const lines = []; // [{ cells: [[value, style]] }]
  if (title) lines.push([[title, STYLE.title]]);
  if (subtitle) lines.push([[subtitle, STYLE.note]]);
  if (title || subtitle) lines.push([]);
  lines.push(columns.map((c) => [c.label, STYLE.bold]));
  for (const r of rows) lines.push(r.map((v) => [v, STYLE.normal]));
  if (footer) { lines.push([]); lines.push([[footer, STYLE.note]]); }

  const headerRow = (title || subtitle ? 4 : 1); // for freezing the header
  const sheetRows = lines.map((cells, i) => {
    const r = i + 1;
    return `<row r="${r}">${cells.map(([v, st], c) => cell(`${colName(c)}${r}`, v, st)).join("")}</row>`;
  }).join("");

  const cols = columns.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width || 14}" customWidth="1"/>`).join("");

  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="${headerRow}" topLeftCell="A${headerRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${cols}</cols>
<sheetData>${sheetRows}</sheetData>
</worksheet>`;

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="4">
  <font><sz val="11"/><name val="Calibri"/></font>
  <font><b/><sz val="11"/><name val="Calibri"/></font>
  <font><b/><sz val="14"/><name val="Calibri"/></font>
  <font><sz val="9"/><color rgb="FF5E5A66"/><name val="Calibri"/></font>
</fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="4">
  <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
  <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
  <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
  <xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

  // Excel sheet names: max 31 characters, none of : \ / ? * [ ]
  const safeName = sheetName.replace(/[:\\/?*[\]]/g, "").replace(/\s+/g, " ").trim().slice(0, 31) || "Data";

  return makeZip([
    { name: "[Content_Types].xml", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>` },
    { name: "_rels/.rels", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>` },
    { name: "xl/workbook.xml", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${esc(safeName)}" sheetId="1" r:id="rId1"/></sheets>
</workbook>` },
    { name: "xl/_rels/workbook.xml.rels", text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>` },
    { name: "xl/worksheets/sheet1.xml", text: sheet },
    { name: "xl/styles.xml", text: styles }
  ]);
}
