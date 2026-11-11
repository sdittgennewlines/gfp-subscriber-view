"""
build_master.py: builds the GFP Excel master ("GFP Incidents Master.xlsx")
from the incidents the site already reads, so the two can be checked
against each other.

The master replaces the "Incidents - Global" Google Sheet. It has:

  Read Me      what to type where, and the rules the formulas follow
  Incidents    one row per incident. Columns with a purple header are typed
               or pasted (from the import page); grey-header columns are
               formulas and are never typed over
  Weekly GSI   the GSI of every spotlight country, region and theme per
               week (Saturday to Friday, named by the Friday), as formulas
  Lists        the dropdown options: locations, types with their category,
               the 23 countries/regions/themes, scores
  Places       standard places for Place Detail, each with one set of
               coordinates and the other spellings that mean the same place
  To review    the migration's judgment calls (delete when done)

usage:
  node tools/build-data.mjs <folder with the CSV exports>      # first
  python3 tools/excel-master/build_master.py <folder with the CSV exports> <out.xlsx>

Run it again on a fresh export right before switching over: it rebuilds
the whole file.
"""
import csv
import json
import sys
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

from openpyxl import Workbook
from openpyxl.comments import Comment
from openpyxl.formatting.rule import CellIsRule, FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.workbook.defined_name import DefinedName
from openpyxl.worksheet.datavalidation import DataValidation

REPO = Path(__file__).resolve().parents[2]
CSV_DIR = Path(sys.argv[1]) if len(sys.argv) > 1 else REPO.parent / "work"
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("GFP Incidents Master.xlsx")

LAST_ROW = 6000          # rows prepared with formulas and dropdowns (~3 years of incidents)
FIRST_WEEK = date(2026, 1, 2)
LAST_WEEK = date(2027, 12, 31)

# ---------------------------------------------------------------- inputs
incidents = json.loads((REPO / "data/incidents.json").read_text())["incidents"]
types = json.loads((REPO / "data/types.json").read_text())["types"]
lists = json.loads((REPO / "tools/word-template/lists.json").read_text())

# Entity key (site) -> name (Word template and master), with its kind.
ENTITIES = [
    ("US", "United States", "Country"), ("China", "China", "Country"), ("Iran", "Iran", "Country"),
    ("Venezuela", "Venezuela", "Country"), ("India", "India", "Country"), ("Brazil", "Brazil", "Country"),
    ("Canada", "Canada", "Country"), ("DRC", "DR Congo", "Country"), ("Ethiopia", "Ethiopia", "Country"),
    ("France", "France", "Country"), ("Germany", "Germany", "Country"), ("Cuba", "Cuba", "Country"),
    ("Indonesia", "Indonesia", "Country"), ("Mexico", "Mexico", "Country"), ("Myanmar", "Myanmar", "Country"),
    ("Sudan", "Sudan", "Country"), ("Taiwan", "Taiwan", "Country"),
    ("Indopacific", "Indo-Pacific", "Region"), ("MENA", "Middle East & North Africa", "Region"),
    ("NATO", "NATO", "Region"), ("Americas", "US/Americas", "Region"),
    ("Energy", "Global Energy", "Theme"), ("Climate", "Global Climate", "Theme"),
]
NAME = {k: n for k, n, _ in ENTITIES}
SPOTLIGHT = {n for _, n, kind in ENTITIES if kind == "Country"}
NONE = "None"  # master-only "Counts toward" value: counts toward nothing (see Read Me)

# Columns of the old sheet that the site doesn't read: second link and review comments.
extra = defaultdict(list)
with open(CSV_DIR / "Incidents_Global.csv", newline="", encoding="utf-8") as f:
    for r in csv.DictReader(f):
        key = (" ".join((r.get("Title") or "").split()), " ".join((r.get("Link") or "").split()))
        extra[key].append({"link2": (r.get("Link2") or "").strip(),
                           "note": (r.get("GSI Review Comments (Week of 4/10)") or "").strip()})

# ---------------------------------------------------------------- styles
FONT = "Arial"
INPUT_HEAD = PatternFill("solid", fgColor="E6E0F4")   # purple: type or paste here
FORMULA_HEAD = PatternFill("solid", fgColor="E3E1DC")  # grey: formula, don't type
FORMULA_TEXT = Font(name=FONT, size=10, color="5E5A66")
BODY = Font(name=FONT, size=10)
HEAD = Font(name=FONT, size=10, bold=True, color="1B1725")
TITLE = Font(name=FONT, size=16, bold=True, color="1B1725")
THIN = Side(style="thin", color="CFCCC4")
WRAP_TOP = Alignment(wrap_text=True, vertical="top")
TOP = Alignment(vertical="top")

# GSI colours, the same bands as the site's map (config.js -> scale).
BANDS = [(-1000, -60, "8E1B17", "FFFFFF"), (-60, -40, "B8352B", "FFFFFF"), (-40, -20, "D9705F", "1B1725"),
         (-20, -5, "F0B3A5", "1B1725"), (-5, 5, "E6E0F4", "1B1725"), (5, 20, "B7CDEA", "1B1725"),
         (20, 40, "7FA6D8", "1B1725"), (40, 60, "4277BE", "FFFFFF"), (60, 1000, "1F4E8C", "FFFFFF")]


def gsi_colours(ws, ref):
    """Colour a range by GSI band, like the map. Blank cells stay white."""
    first = ref.split(":")[0].replace("$", "")
    for lo, hi, fill, text in BANDS:
        # Same cut-offs as the site: a value belongs to the first band whose top is above it.
        ws.conditional_formatting.add(ref, FormulaRule(
            formula=[f'AND(ISNUMBER({first}),{first}>{lo},{first}<={hi})' if lo > -1000 else f'AND(ISNUMBER({first}),{first}<={hi})'],
            fill=PatternFill("solid", fgColor=fill, bgColor=fill), font=Font(color=text)))


wb = Workbook()

# ================================================================ Lists
ls = wb.active
ls.title = "Lists"
locations = sorted(lists["country"], key=str.lower)
type_rows = [(t["name"], t["category"]) for t in types]
scores = [-90, -70, -50, -30, -10, 0, 10, 30, 50, 70, 90]
heads = ["Location", "", "Type", "Category", "", "Counts toward", "Kind", "", "Score"]
for c, h in enumerate(heads, 1):
    if h:
        ls.cell(1, c, h).font = HEAD
        ls.cell(1, c).fill = INPUT_HEAD
for i, v in enumerate(locations, 2):
    ls.cell(i, 1, v)
for i, (n, cat) in enumerate(type_rows, 2):
    ls.cell(i, 3, n); ls.cell(i, 4, cat)
for i, (_, n, kind) in enumerate(ENTITIES, 2):
    ls.cell(i, 6, n); ls.cell(i, 7, kind)
ls.cell(len(ENTITIES) + 2, 6, NONE); ls.cell(len(ENTITIES) + 2, 7, "Counts toward nothing (old rows only)")
for i, v in enumerate(scores, 2):
    ls.cell(i, 9, v)
for col, w in {"A": 34, "C": 34, "D": 28, "F": 28, "G": 34, "I": 8}.items():
    ls.column_dimensions[col].width = w
for row in ls.iter_rows():
    for cell in row:
        if cell.row > 1:
            cell.font = BODY
ls.freeze_panes = "A2"

n_loc, n_type, n_ent = len(locations) + 1, len(type_rows) + 1, len(ENTITIES) + 1
NAMES = {
    "LocationList": f"Lists!$A$2:$A${n_loc}",
    "TypeList": f"Lists!$C$2:$C${n_type}",
    "TypeCategory": f"Lists!$D$2:$D${n_type}",
    "EntityList": f"Lists!$F$2:$F${n_ent + 1}",   # includes None
    "RegionList": "Lists!$F$19:$F$22",
    "ThemeList": "Lists!$F$23:$F$24",
    "ScoreList": "Lists!$I$2:$I$12",
}
assert ls["F19"].value == "Indo-Pacific" and ls["F22"].value == "US/Americas" and ls["F24"].value == "Global Climate"
for name, ref in NAMES.items():
    wb.defined_names[name] = DefinedName(name, attr_text=ref)

# ================================================================ Incidents
ws = wb.create_sheet("Incidents", 0)

# (header, width, kind) kind: "in" typed/pasted, "f" formula
# Typed/pasted columns come first and side by side, so one paste from the import page fills a
# row without touching the formula columns, which all sit at the right.
COLS = [("ID", 18, "in"), ("Date", 12, "in"), ("Title", 48, "in"),
        ("Location", 16, "in"), ("Place Detail", 16, "in"), ("Type", 24, "in"), ("Secondary type", 20, "in"),
        ("Headline GSI", 9, "in")]
for i in range(1, 6):
    COLS += [(f"Counts toward {i}", 20, "in"), (f"Score {i}", 7, "in")]
COLS += [("Summary", 60, "in"), ("Source link", 30, "in"), ("Additional source", 24, "in"),
         ("Key incident", 9, "in"), ("Related New Lines link", 24, "in"),
         ("Added on", 12, "in"), ("Notes", 30, "in"),
         ("Week ending", 12, "f"), ("Category", 22, "f"), ("Level", 12, "f"), ("Assessment", 24, "f"),
         ("Severity", 12, "f"), ("Problems", 40, "f")]
COL = {h: get_column_letter(i) for i, (h, _, _) in enumerate(COLS, 1)}
ENT_COLS = [COL[f"Counts toward {i}"] for i in range(1, 6)]
SCO_COLS = [COL[f"Score {i}"] for i in range(1, 6)]

HEAD_NOTES = {
    "ID": "Pasted from the import page (date + short code). Never change it: the site uses it for links.",
    "Week ending": "Formula: the Friday that ends the incident's week (weeks run Saturday to Friday).",
    "Category": "Formula: from the Type, using the Lists sheet.",
    "Headline GSI": "Overall GSI score. Its sign and size set the Assessment and Severity.",
    "Counts toward 1": "Each country, region or theme whose GSI is affected, with its score. "
                       "If every line is blank, the headline GSI counts toward the Location (when it is a spotlight country). "
                       "\"None\" (old rows only) means it counts toward nothing.",
    "Key incident": "Yes, or blank (= No).",
    "Level": "Formula: Global if it counts toward a theme; International if a region or 2+ countries; otherwise Country.",
    "Assessment": "Formula: severity + the level's word (destabilization, escalation, disruption…).",
    "Severity": "Formula: from the size of the headline GSI. ±10 Low … ±90 High; 0 has none.",
    "Added on": "The date the row was imported.",
    "Problems": "Formula: anything missing or off-list. Empty means the row is fine.",
}

for c, (h, w, kind) in enumerate(COLS, 1):
    cell = ws.cell(1, c, h)
    cell.font = HEAD
    cell.fill = INPUT_HEAD if kind == "in" else FORMULA_HEAD
    cell.alignment = Alignment(wrap_text=True, vertical="center")
    cell.border = Border(bottom=THIN)
    if h in HEAD_NOTES:
        cell.comment = Comment(HEAD_NOTES[h], "GFP")
    ws.column_dimensions[get_column_letter(c)].width = w
ws.row_dimensions[1].height = 30
ws.freeze_panes = "E2"


def formulas(r):
    """The grey (formula) columns for row r. Every one is blank on an empty row."""
    C = {h: f"{col}{r}" for h, col in COL.items()}
    date_, gsi, typ, loc = C["Date"], C["Headline GSI"], C["Type"], C["Location"]
    ents = [f"{c}{r}" for c in ENT_COLS]
    scs = [f"{c}{r}" for c in SCO_COLS]
    empty = f'AND({date_}="",{C["Title"]}="")'

    count_in = lambda rng: "+".join(f"COUNTIF({e},{rng})" for e in ents)
    themes = f"SUMPRODUCT({count_in('ThemeList').replace('+', ')+SUMPRODUCT(')})"
    regions = f"SUMPRODUCT({count_in('RegionList').replace('+', ')+SUMPRODUCT(')})"
    filled = "+".join(f'({e}<>"")' for e in ents)
    nones = "+".join(f'({e}="{NONE}")' for e in ents)
    countries = f"(({filled})-({nones})-{themes}-{regions})"
    level = f'IF({empty},"",IF({themes}>0,"Global",IF(OR({regions}>0,{countries}>=2),"International","Country")))'

    sev = (f'IF(OR({empty},{gsi}=""),"",IF(ABS({gsi})<5,"",IF(ABS({gsi})<20,"Low",IF(ABS({gsi})<40,"Low/Medium",'
           f'IF(ABS({gsi})<60,"Medium",IF(ABS({gsi})<80,"Medium/High","High"))))))')
    lv, sv = C["Level"], C["Severity"]
    word = (f'IF({lv}="Global",IF({gsi}<0,"disruption","enhancement"),'
            f'IF({lv}="International",IF({gsi}<0,"escalation","de-escalation"),'
            f'IF({gsi}<0,"destabilization","stabilization")))')
    assess = (f'IF(OR({empty},{gsi}=""),"",IF(ABS({gsi})<5,"Status quo",'
              f'SUBSTITUTE(SUBSTITUTE({sv},"/M","/m"),"/H","/h")&" "&{word}))')

    pair_bad = "+".join(f'ABS(({e}<>"")*({e}<>"{NONE}")-({s}<>"")*1)' for e, s in zip(ents, scs))
    twice = "+".join(f'({ents[i]}<>"")*({ents[i]}={ents[j]})' for i in range(5) for j in range(i + 1, 5))
    T, D = COL["Title"], COL["Date"]
    problems = (
        f'IF({empty},"",'
        f'IF({date_}="","No date. ","")&IF({C["Title"]}="","No title. ","")'
        f'&IF({loc}="","No location. ",IF(COUNTIF(LocationList,{loc})=0,"Location not on list. ",""))'
        f'&IF({typ}="","No type. ",IF(COUNTIF(TypeList,{typ})=0,"Type not on list. ",""))'
        f'&IF(AND({C["Secondary type"]}<>"",COUNTIF(TypeList,{C["Secondary type"]})=0),"Secondary type not on list. ","")'
        f'&IF({gsi}="","No headline GSI. ","")'
        f'&IF(({pair_bad})>0,"A Counts toward line is missing its entity or score. ","")'
        f'&IF(({twice})>0,"The same entity is listed twice. ","")'
        f'&IF({C["Summary"]}="","No summary. ","")&IF({C["Source link"]}="","No source link. ","")'
        f'&IFERROR(IF(COUNTIFS(${T}$2:${T}${LAST_ROW},{C["Title"]},${D}$2:${D}${LAST_ROW},{date_})>1,"Possible duplicate. ",""),""))'
    )
    return {
        "Week ending": f'=IF({date_}="","",{date_}+MOD(6-WEEKDAY({date_}),7))',
        "Category": f'=IF({typ}="","",IFERROR(INDEX(TypeCategory,MATCH({typ},TypeList,0)),"Uncategorized"))',
        "Level": "=" + level,
        "Severity": "=" + sev,
        "Assessment": "=" + assess,
        "Problems": "=" + problems,
    }


# ---- migrate the incidents (oldest first, so new weeks go at the bottom)
review = []   # (issue, id, date, title, what was done, call to make)
rows = sorted(incidents, key=lambda i: (i["date"], i["title"]))
seen_extra = defaultdict(int)
counts_none = 0
for r, inc in enumerate(rows, 2):
    loc = inc["location"]
    lines = [(NAME[k], v) for k, v in inc["scores"].items()]
    if not lines and loc in SPOTLIGHT:
        # Old rule: no ticked boxes = counts toward nothing. New rule would count it toward its
        # Location, so keep the old result with "None" and list it for review.
        lines = [(NONE, None)]
        counts_none += 1
        review.append(("Counted toward nothing", inc, f'Counts toward 1 = "None" (as published)',
                       f"Keep, or clear \"None\" so it counts toward {loc} with {inc['gsi']:+d}".replace("+0", "0")))
    # Taiwan has no columns in the old sheet: the site scores Taiwan-located incidents with their
    # headline GSI. Alone, that is exactly the new blank-lines rule, so leave the lines blank.
    # Next to other entities it must be written out, so list it for a check.
    if loc == "Taiwan" and lines == [("Taiwan", inc["gsi"])]:
        lines = []
    elif loc == "Taiwan" and any(e == "Taiwan" for e, _ in lines):
        review.append(("Taiwan score added", inc, f"Added Taiwan {inc['gsi']:+d} (its headline GSI) to Counts toward".replace("+0 ", "0 "),
                       "Check the Taiwan score"))
    ex_key = (inc["title"], inc["url"])
    ex = extra.get(ex_key, [{}])
    ex = ex[min(seen_extra[ex_key], len(ex) - 1)]
    seen_extra[ex_key] += 1

    values = {
        "ID": inc["id"], "Date": date.fromisoformat(inc["date"]), "Title": inc["title"], "Location": loc,
        "Type": inc["type"], "Headline GSI": inc["gsi"], "Summary": inc["description"],
        "Source link": inc["url"], "Additional source": ex.get("link2") or None,
        "Notes": ("Old review comment: " + ex["note"]) if ex.get("note") else None,
    }
    for i, (e, s) in enumerate(lines, 1):
        values[f"Counts toward {i}"] = e
        values[f"Score {i}"] = s
    for h, v in values.items():
        if v is not None and v != "":
            ws[f"{COL[h]}{r}"] = v
    if loc == "Caribbean":
        review.append(("Location needs a country", inc, "Kept \"Caribbean\" (flagged in Problems)", "Choose the country"))
    missing = [n for n, v in (("summary", inc["description"]), ("source link", inc["url"])) if not v]
    if missing:
        review.append(("Missing field", inc, "Left blank (flagged in Problems)", "Add the " + " and ".join(missing)))
    if inc["category"] == "Uncategorized":
        review.append(("Type not on the list", inc, f"Kept \"{inc['type']}\" (flagged in Problems)",
                       "Use \"Political Appointment\" or add the type to Lists"))

last_data = len(rows) + 1

# The build report's other items: ticked-without-score and duplicates.
report = (REPO / "data/build-report.txt").read_text()
by_title = defaultdict(list)
for inc in rows:
    by_title[(inc["title"], inc["date"])].append(inc)
for (t, d), group in by_title.items():
    if len(group) > 1:
        for inc in group:
            review.append(("Possible duplicate", inc, "Kept both", "Delete one, or keep both if they differ"))
csv_rows = list(csv.DictReader(open(CSV_DIR / "Incidents_Global.csv", newline="", encoding="utf-8")))
for line in report.splitlines():
    if "is ticked but" in line:
        n = int(line.split("Row ")[1].split(":")[0])
        src = csv_rows[n - 2]
        title = " ".join(src["Title"].split())
        inc = next((i for i in rows if i["title"] == title), None)
        if inc:
            col = line.split('"')[1]
            review.append(("Ticked without a score", inc, f"{col} not counted (as published)",
                           f"Add a score for {col}, or leave it out"))

# Formulas, dropdowns and formats on every prepared row.
for r in range(2, LAST_ROW + 1):
    for h, f in formulas(r).items():
        c = ws[f"{COL[h]}{r}"]
        c.value = f
        c.font = FORMULA_TEXT
    for h in ("Date", "Week ending", "Added on"):
        ws[f"{COL[h]}{r}"].number_format = "yyyy-mm-dd"
    if r <= last_data:
        for h, (_, _, kind) in zip(COL, COLS):
            c = ws[f"{COL[h]}{r}"]
            if kind == "in":
                c.font = BODY
            c.alignment = TOP

dv = lambda formula, prompt=None: DataValidation(type="list", formula1=formula, allow_blank=True,
                                                  showErrorMessage=True, errorStyle="warning",
                                                  error="Not on the list. Choose from the dropdown, or add it to the Lists sheet.",
                                                  prompt=prompt, showInputMessage=bool(prompt))
rng = lambda h: f"{COL[h]}2:{COL[h]}{LAST_ROW}"
validations = [
    (dv("=LocationList"), [rng("Location")]),
    (dv("=TypeList"), [rng("Type"), rng("Secondary type")]),
    (dv("=EntityList"), [rng(f"Counts toward {i}") for i in range(1, 6)]),
    (dv("=ScoreList"), [rng("Headline GSI")] + [rng(f"Score {i}") for i in range(1, 6)]),
    (dv('"Yes"'), [rng("Key incident")]),
]
for v, refs in validations:
    v.sqref = " ".join(refs)  # one rule covering several columns
    ws.add_data_validation(v)
date_dv = DataValidation(type="date", operator="greaterThan", formula1="DATE(2025,1,1)", allow_blank=True,
                         showErrorMessage=True, error="Enter a date.")
date_dv.sqref = f"{rng('Date')} {rng('Added on')}"
ws.add_data_validation(date_dv)

gsi_colours(ws, rng("Headline GSI"))
ws.conditional_formatting.add(rng("Problems"), FormulaRule(formula=[f'{COL["Problems"]}2<>""'],
                              fill=PatternFill("solid", fgColor="FBE3DE", bgColor="FBE3DE"), font=Font(color="8E1B17")))
ws.auto_filter.ref = f"A1:{get_column_letter(len(COLS))}{LAST_ROW}"

# ================================================================ Weekly GSI
wk = wb.create_sheet("Weekly GSI", 1)
wk["A1"] = "Weekly GSI"
wk["A1"].font = TITLE
wk["A2"] = ("Average of every score an incident gives the country, region or theme that week (Saturday to Friday, "
            "named by the Friday). Blank = no scored incidents. All formulas: nothing to type here.")
wk["A2"].font = Font(name=FONT, size=10, color="5E5A66")
wk.merge_cells(start_row=2, start_column=1, end_row=2, end_column=14)
HR = 4
wk.cell(HR, 1, "Week ending").font = HEAD
wk.cell(HR, 2, "Incidents").font = HEAD
for c, (_, n, kind) in enumerate(ENTITIES, 3):
    cell = wk.cell(HR, c, n)
    cell.font = HEAD
    cell.alignment = Alignment(wrap_text=True, horizontal="center", vertical="bottom")
    cell.fill = FORMULA_HEAD
wk.cell(HR, 1).fill = FORMULA_HEAD
wk.cell(HR, 2).fill = FORMULA_HEAD
wk.row_dimensions[HR].height = 44
wk.column_dimensions["A"].width = 12
wk.column_dimensions["B"].width = 10
for c in range(3, 3 + len(ENTITIES)):
    wk.column_dimensions[get_column_letter(c)].width = 10
wk.freeze_panes = wk.cell(HR + 1, 3)

R = lambda col: f"Incidents!${col}$2:${col}${LAST_ROW}"
W, LOC, G = R(COL["Week ending"]), R(COL["Location"]), R(COL["Headline GSI"])
weeks = []
d = FIRST_WEEK
while d <= LAST_WEEK:
    weeks.append(d)
    d += timedelta(days=7)
for i, w in enumerate(weeks):
    r = HR + 1 + i
    wk.cell(r, 1, w).number_format = "yyyy-mm-dd"
    wk.cell(r, 1).font = BODY
    wk.cell(r, 2, f'=IF(COUNTIF({W},$A{r})=0,"",COUNTIF({W},$A{r}))').font = FORMULA_TEXT
    for c in range(3, 3 + len(ENTITIES)):
        e = f"{get_column_letter(c)}${HR}"
        blanks = ",".join(f'{R(x)},""' for x in ENT_COLS)
        num = "+".join(f"SUMIFS({R(s)},{R(x)},{e},{W},$A{r})" for x, s in zip(ENT_COLS, SCO_COLS))
        num += f"+SUMIFS({G},{LOC},{e},{W},$A{r},{blanks})"
        den = "+".join(f'COUNTIFS({R(x)},{e},{W},$A{r},{R(s)},"<>")' for x, s in zip(ENT_COLS, SCO_COLS))
        den += f'+COUNTIFS({LOC},{e},{W},$A{r},{G},"<>",{blanks})'
        cell = wk.cell(r, c, f'=IFERROR(({num})/({den}),"")')
        cell.number_format = "0;-0;0"
        cell.alignment = Alignment(horizontal="center")
        cell.font = BODY
last_wk = HR + len(weeks)
gsi_colours(wk, f"C{HR + 1}:{get_column_letter(2 + len(ENTITIES))}{last_wk}")

# ================================================================ Places
pl = wb.create_sheet("Places", 2)
pl_heads = [("Standard place", 22), ("Location", 18), ("Latitude", 10), ("Longitude", 10),
            ("Also written as (separate with ;)", 60)]
for c, (h, w) in enumerate(pl_heads, 1):
    pl.cell(1, c, h).font = HEAD
    pl.cell(1, c).fill = INPUT_HEAD
    pl.column_dimensions[get_column_letter(c)].width = w
PLACES = [  # starter list; the import page adds to it as new places come in
    ("New York City", "United States", 40.7128, -74.0060, "New York; NYC; Manhattan; UN headquarters; United Nations headquarters; UN HQ; UN General Assembly; UN Security Council"),
    ("Washington, D.C.", "United States", 38.9072, -77.0369, "Washington; Washington DC; DC; White House; Pentagon; Capitol Hill; State Department"),
    ("Brussels", "EU", 50.8503, 4.3517, "EU; European Union; European Commission; European Council; NATO headquarters"),
    ("Geneva", "Switzerland", 46.2044, 6.1432, "UN Geneva; UN Human Rights Council; WTO; WHO"),
    ("The Hague", "Netherlands", 52.0705, 4.3007, "ICC; ICJ; International Criminal Court; International Court of Justice"),
    ("Vienna", "Austria", 48.2082, 16.3738, "IAEA; OPEC; OSCE"),
    ("Gaza City", "Gaza", 31.5017, 34.4668, "Gaza Strip; Gaza"),
]
for i, row in enumerate(PLACES, 2):
    for c, v in enumerate(row, 1):
        pl.cell(i, c, v).font = BODY
pl.freeze_panes = "A2"
pl_dv = dv("=LocationList")
pl_dv.sqref = "B2:B2000"
pl.add_data_validation(pl_dv)

# ================================================================ To review
rv = wb.create_sheet("To review", 3)
rv["A1"] = "To review: judgment calls from the migration"
rv["A1"].font = TITLE
rv["A2"] = ("Nothing here changes a published GSI: each row was kept the way the site shows it today. "
            "Make each call in the Incidents sheet (find the row by ID), then delete this sheet.")
rv["A2"].font = Font(name=FONT, size=10, color="5E5A66")
rv.merge_cells("A2:G2")
rv_heads = [("Issue", 24), ("ID", 18), ("Date", 11), ("Title", 54), ("Location", 14), ("What I did", 40), ("Your call", 44)]
for c, (h, w) in enumerate(rv_heads, 1):
    rv.cell(4, c, h).font = HEAD
    rv.cell(4, c).fill = INPUT_HEAD
    rv.column_dimensions[get_column_letter(c)].width = w
order = ["Possible duplicate", "Ticked without a score", "Type not on the list", "Location needs a country", "Missing field",
         "Taiwan score added", "Counted toward nothing"]
review.sort(key=lambda x: (order.index(x[0]), x[1]["date"], x[1]["title"]))
for i, (issue, inc, did, call) in enumerate(review, 5):
    for c, v in enumerate([issue, inc["id"], date.fromisoformat(inc["date"]), inc["title"], inc["location"], did, call], 1):
        cell = rv.cell(i, c, v)
        cell.font = BODY
        cell.alignment = WRAP_TOP
    rv.cell(i, 3).number_format = "yyyy-mm-dd"
rv.freeze_panes = "A5"
rv.auto_filter.ref = f"A4:G{4 + len(review)}"

# ================================================================ Read Me
rm = wb.create_sheet("Read Me", 0)
rm.column_dimensions["A"].width = 3
rm.column_dimensions["B"].width = 110
lines = [
    ("GFP incidents master", TITLE),
    ("The single source of the Global Incident Feed and the GSI. The subscriber site reads the Incidents sheet.", None),
    ("", None),
    ("Each week", HEAD),
    ("1. Open the import page and load the final Weekly Incidents Word document (tracked changes accepted).", None),
    ("2. Review the rows it shows, then click \"Copy rows for Excel\".", None),
    ("3. In Incidents, click the first empty cell in column A and paste. The grey columns at the right fill in by themselves.", None),
    ("4. Check the Problems column for the new rows. Empty means fine.", None),
    ("5. Save. The site shows the new week from Friday 4:00pm ET.", None),
    ("", None),
    ("Columns", HEAD),
    ("Purple headers: typed or pasted. Grey headers: formulas. Never type in a grey column.", None),
    ("Hover a header with a red corner for what it means.", None),
    ("Don't rename, reorder or delete columns or sheets: the site and the import page find them by name.", None),
    ("Edits are fine: fix a score or a typo in any purple cell and the site picks it up on its next read.", None),
    ("", None),
    ("Rules the formulas follow", HEAD),
    ("Week ending: weeks run Saturday to Friday and are named by the Friday.", None),
    ("Weekly GSI: the average of every score an incident gives that country, region or theme that week.", None),
    ("Counts toward: if every line is blank, the headline GSI counts toward the Location (when it is a spotlight country).", None),
    ("\"None\" in Counts toward (old rows only) means the incident counts toward nothing, as in the old sheet.", None),
    ("Level: Global if it counts toward a theme; International if a region or two or more countries; otherwise Country.", None),
    ("Assessment: Country → destabilization / stabilization; International → escalation / de-escalation; "
     "Global → disruption / enhancement; 0 → status quo.", None),
    ("Severity: from the headline GSI. ±10 Low, ±30 Low/Medium, ±50 Medium, ±70 Medium/High, ±90 High.", None),
    ("", None),
    ("Other sheets", HEAD),
    ("Weekly GSI: every country, region and theme per week, coloured like the map. Formulas only.", None),
    ("Lists: the dropdown options. To add a location or type, add it at the bottom of its column.", None),
    ("Places: standard places for Place Detail. Each has one set of coordinates; \"Also written as\" lists the "
     "other names that mean the same place (UN headquarters → New York City).", None),
    ("To review: the migration's judgment calls. Delete it once they are done.", None),
    ("", None),
    (f"Migrated {len(rows):,} incidents from the Incidents - Global Google Sheet, through week ending "
     f"{max(i['week'] for i in rows)}. Rows {last_data + 1}–{LAST_ROW} are ready for new incidents.", Font(name=FONT, size=9, color="5E5A66")),
]
for i, (text, font) in enumerate(lines, 2):
    c = rm.cell(i, 2, text)
    c.font = font or BODY
    c.alignment = Alignment(wrap_text=True, vertical="top")
rm.sheet_view.showGridLines = False

for s in (ws, wk, pl, rv, ls):
    s.sheet_view.zoomScale = 100
wb.calculation.fullCalcOnLoad = True
wb.save(OUT)
print(f"{OUT}: {len(rows)} incidents, {len(review)} review items, {counts_none} counted-toward-nothing, "
      f"{len(weeks)} weeks")
