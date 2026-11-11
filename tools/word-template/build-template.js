// Builds the GFP weekly incident template (.docx).
// Step 1 (this script): layout with docx-js; every form field is a marker run "§§key§§".
// Step 2 (sdt.py): replaces each marker with a real Word content control
//         (dropdown / date picker / text box), tagged with the field key for the importer.
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle,
  ShadingType, AlignmentType, HeadingLevel, LevelFormat, PageBreak, Footer, PageNumber, TabStopType
} = require("docx");

const REPO = path.resolve(__dirname, "../..");
const incidents = require(`${REPO}/data/incidents.json`).incidents;
const world = require(`${REPO}/data/world.json`);
const types = require(`${REPO}/data/types.json`).types.map((t) => t.name);

// ---------- dropdown lists (written to lists.json for sdt.py and the importer) ----------
const MAP_TO_SHEET = { "United States of America": "United States", "Dem. Rep. Congo": "DR Congo", Turkey: "Turkiye", Vietnam: "Viet Nam" };
const SKIP = new Set(["Antarctica", "Fr. S. Antarctic Lands", "N. Cyprus", "Somaliland", "W. Sahara"]);
const countries = new Set(world.countries.map((c) => MAP_TO_SHEET[c.name] || c.name).filter((n) => !SKIP.has(n)));
incidents.forEach((i) => countries.add(i.location));
["Caribbean", "Gaza"].forEach((x) => countries.delete(x)); // places, not countries: use Place detail
["Singapore", "Bahrain", "EU"].forEach((x) => countries.add(x));
const countryList = ["Multiple / regional (see Place detail)", ...[...countries].sort((a, b) => a.localeCompare(b))];

const entities = [
  "United States", "China", "Iran", "Venezuela", "India", "Brazil", "Canada", "DR Congo", "Ethiopia", "France", "Germany",
  "Cuba", "Indonesia", "Mexico", "Myanmar", "Sudan", "Taiwan",
  "Indo-Pacific", "Middle East & North Africa", "NATO", "US/Americas", "Global Energy", "Global Climate"
];
const scores = ["−90", "−70", "−50", "−30", "−10", "0", "+10", "+30", "+50", "+70", "+90"];
const lists = {
  country: countryList,
  type: types,
  type2: ["(none)", ...types],
  gsi: scores,
  entity: entities,
  score: scores,
  featured: ["No", "Yes"]
};
fs.writeFileSync(path.join(__dirname, "lists.json"), JSON.stringify(lists, null, 2));

// ---------- styling ----------
const INK = "1B1725", GOLD = "BFA359", MUTED = "5E5A66", LINE = "CFCCC4", WASH = "F7F6F2", LABELBG = "F1F0EC";
const FONT = "Arial", SERIF = "Georgia";
const W = 9360; // content width (US Letter, 1" margins)
const LABEL_W = 2500, VALUE_W = W - LABEL_W;
const border = { style: BorderStyle.SINGLE, size: 4, color: LINE };
const borders = { top: border, bottom: border, left: border, right: border };

const p = (text, opts = {}) => new Paragraph({ spacing: { after: 100 }, ...opts.para, children: [new TextRun({ text, font: FONT, size: 20, color: INK, ...opts.run })] });
const marker = (key) => new TextRun({ text: `§§${key}§§`, font: FONT, size: 20 });

/** One label/value row of an incident block. `value` = array of runs. */
function row(label, value, { hint = "", required = false, last = false } = {}) {
  // keepNext on every row but the last keeps the whole block on one page.
  const keep = !last;
  return new TableRow({
    cantSplit: true,
    children: [
      new TableCell({
        width: { size: LABEL_W, type: WidthType.DXA }, borders,
        shading: { fill: LABELBG, type: ShadingType.CLEAR, color: "auto" },
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [
          new Paragraph({ keepNext: keep, keepLines: true, children: [new TextRun({ text: label, bold: true, font: FONT, size: 18, color: INK }), ...(required ? [new TextRun({ text: " *", font: FONT, size: 18, color: "B8352B", bold: true })] : [])] }),
          ...(hint ? [new Paragraph({ keepNext: keep, children: [new TextRun({ text: hint, font: FONT, size: 15, color: MUTED, italics: true })] })] : [])
        ]
      }),
      new TableCell({
        width: { size: VALUE_W, type: WidthType.DXA }, borders,
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({ keepNext: keep, keepLines: true, children: value })]
      })
    ]
  });
}

/** An incident block. n = number in the doc; keys are suffixed so each control's tag is unique (field + "#n"). */
function incidentBlock(n) {
  const k = (field) => `${field}#${n}`;
  const sep = () => new TextRun({ text: "     ", font: FONT, size: 20 });
  const tag = (t) => new TextRun({ text: t, font: FONT, size: 16, color: MUTED });
  const rows = [
    row("Title", [marker(k("title"))], { required: true }),
    row("Date", [marker(k("date"))], { required: true, hint: "When it happened" }),
    row("Country", [marker(k("country")), sep(), tag("Place detail "), marker(k("place"))], { required: true, hint: "Place detail is optional: a city, region or body (Gaza, EU…)" }),
    row("Type", [marker(k("type")), sep(), tag("Secondary type "), marker(k("type2"))], { required: true }),
    row("Headline GSI", [marker(k("gsi"))], { required: true, hint: "Overall score. Its sign and size set the wording and severity." })
  ];
  for (let i = 1; i <= 5; i++) {
    rows.push(row(i === 1 ? "Counts toward" : "", [marker(k(`entity${i}`)), sep(), tag("Score "), marker(k(`score${i}`))],
      i === 1 ? { hint: "Each spotlight country, region or theme it moves, with its score. Leave unused lines empty." } : {}));
  }
  rows.push(
    row("Summary", [marker(k("summary"))], { required: true, hint: "2–4 sentences" }),
    row("Source link", [marker(k("link"))], { required: true }),
    row("Additional source", [marker(k("link2"))]),
    row("Featured", [marker(k("featured"))], { hint: "Key incident of the week?" }),
    row("Related New Lines link", [marker(k("related"))], { hint: "e.g. Mass Atrocities Monitor entry", last: true })
  );
  return [
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      keepNext: true,
      children: [new TextRun({ text: n === 0 ? "Example incident" : `Incident ${n}`, font: SERIF, size: 26, bold: true, color: INK })]
    }),
    new Table({ width: { size: W, type: WidthType.DXA }, columnWidths: [LABEL_W, VALUE_W], rows }),
    new Paragraph({ spacing: { after: 200 }, children: [] })
  ];
}

/** The level → wording rules, shown in the instructions. */
function wordingTable() {
  const widths = [2600, 3380, 3380];
  const cell = (text, w, { head = false } = {}) => new TableCell({
    width: { size: w, type: WidthType.DXA }, borders,
    shading: head ? { fill: LABELBG, type: ShadingType.CLEAR, color: "auto" } : undefined,
    margins: { top: 60, bottom: 60, left: 120, right: 120 },
    children: [new Paragraph({ children: [new TextRun({ text, font: FONT, size: 18, bold: head, color: INK })] })]
  });
  const r = (cells, head) => new TableRow({ children: cells.map((t, i) => cell(t, widths[i], { head })) });
  return new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: widths,
    rows: [
      r(["If the incident counts toward…", "Negative score", "Positive score"], true),
      r(["One country only (country level)", "Destabilization", "Stabilization"]),
      r(["A region, or two or more countries (international)", "Escalation", "De-escalation"]),
      r(["A global theme: energy or climate (global)", "Disruption", "Enhancement"])
    ]
  });
}

// ---------- the document ----------
const bullet = (text) => new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 60 }, children: [new TextRun({ text, font: FONT, size: 20, color: INK })] });
const steps = (text) => new Paragraph({ numbering: { reference: "steps", level: 0 }, spacing: { after: 60 }, children: [new TextRun({ text, font: FONT, size: 20, color: INK })] });

const doc = new Document({
  creator: "New Lines Institute",
  title: "GFP weekly incident report",
  styles: {
    default: { document: { run: { font: FONT, size: 20 } } },
    paragraphStyles: [
      { id: "Title", name: "Title", basedOn: "Normal", run: { font: SERIF, size: 40, bold: true, color: INK }, paragraph: { spacing: { before: 0, after: 80 }, keepNext: true } },
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: SERIF, size: 30, bold: true, color: INK }, paragraph: { spacing: { before: 280, after: 120 }, keepNext: true, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: SERIF, size: 26, bold: true, color: INK }, paragraph: { spacing: { before: 240, after: 100 }, keepNext: true, outlineLevel: 1 } }
    ]
  },
  numbering: {
    config: [
      { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] },
      { reference: "steps", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 300 } } } }] }
    ]
  },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    footers: {
      default: new Footer({ children: [new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: W }], children: [
        new TextRun({ text: "New Lines Institute · Geopolitical Forecasting and Analysis Unit · Weekly incident report", font: FONT, size: 15, color: MUTED }),
        new TextRun({ text: "\tPage ", font: FONT, size: 15, color: MUTED }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 15, color: MUTED })
      ] })] })
    },
    children: [
      new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: "NEW LINES INSTITUTE · GEOPOLITICAL FORECASTING AND ANALYSIS UNIT", font: FONT, size: 16, bold: true, color: "7A6528", characterSpacing: 20 })] }),
      new Paragraph({ style: "Title", children: [new TextRun("Weekly incident report")] }),
      new Paragraph({
        spacing: { after: 240 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: INK, space: 6 } },
        children: [new TextRun({ text: "Week ending (Friday): ", font: FONT, size: 22, bold: true, color: INK }), marker("week_ending")]
      }),

      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("How to fill this in")] }),
      steps("Add each incident as its own block. To add a block, copy a whole empty block (heading and table) and paste it at the end. Don't type incidents outside the blocks."),
      steps("Fill the grey boxes. Most are dropdowns: click and choose. Fields marked * are required."),
      steps("Choose the headline GSI and the Counts toward lines carefully: the incident's wording (escalation, destabilization…) and severity are worked out from them, so there is nothing else to classify."),
      steps("Under Counts toward, list each spotlight country, region or theme the incident moves, with its score. Most incidents count toward one or two. Leave the other lines empty."),
      steps("Editorial edits this document as usual. When it is final, accept all tracked changes. The import page refuses a document that still has open changes."),
      steps("The import page reads the blocks, shows them for review, and adds them to the Excel master. Nothing is retyped."),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Scores")] }),
      bullet("Scores run from −90 (sharp destabilization) to +90 (sharp stabilization), in steps of 20; 0 means no change."),
      bullet("Headline GSI is the incident's overall score. Each Counts toward line is its score for that country, region or theme, which can differ."),
      bullet("Spotlight countries: United States, China, Iran, Venezuela, India, Brazil, Canada, DR Congo, Ethiopia, France, Germany, Cuba, Indonesia, Mexico, Myanmar, Sudan, Taiwan."),
      bullet("Regions: Indo-Pacific, Middle East & North Africa, NATO (all of Europe plus Ukraine, Belarus and Russia), US/Americas. Global themes: Global Energy, Global Climate."),
      new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("Worked out for you")] }),
      p("There are no Scope, Scenario or Severity fields. They follow from the scores:"),
      wordingTable(),
      new Paragraph({ spacing: { before: 120 }, children: [new TextRun({ text: "Severity comes from the size of the headline GSI: ±10 Low, ±30 Low/Medium, ±50 Medium, ±70 Medium/High, ±90 High. A score of 0 is the status quo.", font: FONT, size: 20, color: INK })] }),

      new Paragraph({ children: [new PageBreak()] }),
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Example (filled in)")] }),
      p("A real incident, entered the way the import page expects. Delete this block before sending the document to Editorial.", { run: { italics: true, color: MUTED } }),
      p("It counts toward a global theme (Global Energy), so it is global level and, with a headline GSI of −30, the platform will call it a low/medium disruption.", { run: { color: MUTED } }),
      ...incidentBlock(0),

      new Paragraph({ children: [new PageBreak()] }),
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("This week's incidents")] }),
      ...incidentBlock(1),
      ...incidentBlock(2),
      ...incidentBlock(3)
    ]
  }]
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(path.join(__dirname, "layout.docx"), buf);
  console.log("layout.docx written;", countryList.length, "countries,", types.length, "types");
});
