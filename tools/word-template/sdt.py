"""
sdt.py: turns the §§key§§ markers in layout.docx into real Word content controls.

Each control gets a w:tag equal to its key (e.g. "severity#3"), which is what the
import page reads, so labels and layout can change without breaking the import.

usage: python3 sdt.py layout.docx out.docx
"""
import json, re, sys, zipfile, html
from pathlib import Path

HERE = Path(__file__).parent
LISTS = json.loads((HERE / "lists.json").read_text())

# field -> (kind, list name or None, placeholder text, alias shown in Word)
FIELDS = {
    "week_ending": ("date", None, "Pick the Friday", "Week ending"),
    "title": ("text", None, "Type the title", "Title"),
    "date": ("date", None, "Pick the date", "Date"),
    "country": ("drop", "country", "Choose a country", "Country"),
    "place": ("text", None, "Optional", "Place detail"),
    "type": ("drop", "type", "Choose a type", "Type"),
    "type2": ("drop", "type2", "Optional", "Secondary type"),
    "gsi": ("drop", "gsi", "Choose a score", "Headline GSI"),
    "summary": ("multiline", None, "Write the summary", "Summary"),
    "link": ("text", None, "Paste the link", "Source link"),
    "link2": ("text", None, "Optional", "Additional source"),
    "featured": ("drop", "featured", "No", "Featured"),
    "related": ("text", None, "Optional", "Related New Lines link"),
}
for i in range(1, 6):
    FIELDS[f"entity{i}"] = ("drop", "entity", "Country, region or theme", f"Counts toward {i}")
    FIELDS[f"score{i}"] = ("drop", "score", "Score", f"Score {i}")

# The worked example (block #0): a real incident from the sheet.
EXAMPLE = {
    "title": "Indonesia reduces natural gas exports to Singapore",
    "date": "2026-10-26",
    "country": "Indonesia",
    "type": "Trade restrictions",
    "type2": "(none)",
    "gsi": "−30",
    "entity1": "Indonesia", "score1": "−30",
    "entity2": "Indo-Pacific", "score2": "−30",
    "entity3": "Global Energy", "score3": "−10",
    "summary": "Indonesia reduced pipeline natural gas exports to Singapore by 31 million standard cubic feet per day, approximately 8% of its pipeline supply to the country, citing maintenance shutdowns and increased domestic demand. Following concerns raised by Singapore’s prime minister, Indonesian Energy Minister Bahilil Lahadalia said the reduction remained within minimum contractual supply requirements.",
    "link": "https://www.reuters.com/business/energy/indonesia-meeting-gas-deal-terms-with-singapore-despite-supply-cut-minister-says-2026-10-26/",
    "featured": "No",
}

RPR = '<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="20"/></w:rPr>'
RPR_PH = '<w:rPr><w:rStyle w:val="PlaceholderText"/><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="20"/></w:rPr>'
_id = [1000]


def control(key):
    field, n = key.split("#") if "#" in key else (key, "")
    kind, lst, placeholder, alias = FIELDS[field]
    value = EXAMPLE.get(field) if n == "0" else None
    _id[0] += 1
    esc = lambda s: html.escape(s, quote=True)

    if kind == "drop":
        items = "".join(f'<w:listItem w:displayText="{esc(v)}" w:value="{esc(v)}"/>' for v in LISTS[lst])
        typ = f"<w:dropDownList>{items}</w:dropDownList>"
    elif kind == "date":
        full = f' w:fullDate="{value}T00:00:00Z"' if value else ""
        typ = f'<w:date{full}><w:dateFormat w:val="MMMM d, yyyy"/><w:lid w:val="en-US"/><w:storeMappedDataAs w:val="dateTime"/><w:calendar w:val="gregorian"/></w:date>'
    elif kind == "multiline":
        typ = '<w:text w:multiLine="1"/>'
    else:
        typ = "<w:text/>"

    if value and kind == "date":
        from datetime import date
        y, m, d = map(int, value.split("-"))
        shown = date(y, m, d).strftime("%B %-d, %Y")
    else:
        shown = value
    if shown:
        content = f'<w:r>{RPR}<w:t xml:space="preserve">{esc(shown)}</w:t></w:r>'
        plc = ""
    else:
        content = f'<w:r>{RPR_PH}<w:t xml:space="preserve">{esc(placeholder)}</w:t></w:r>'
        plc = "<w:showingPlcHdr/>"
    return (f'<w:sdt><w:sdtPr><w:alias w:val="{esc(alias)}"/><w:tag w:val="{esc(key)}"/><w:id w:val="{_id[0]}"/>'
            f'{plc}{typ}</w:sdtPr><w:sdtContent>{content}</w:sdtContent></w:sdt>')


PLACEHOLDER_STYLE = ('<w:style w:type="character" w:styleId="PlaceholderText"><w:name w:val="Placeholder Text"/>'
                     '<w:uiPriority w:val="99"/><w:semiHidden/><w:rPr><w:color w:val="8C8A91"/></w:rPr></w:style>')


def main(src, dst):
    zin = zipfile.ZipFile(src)
    files = {n: zin.read(n) for n in zin.namelist() if not n.endswith("/")}
    doc = files["word/document.xml"].decode("utf-8")
    pattern = re.compile(r'<w:r>(?:(?!</w:r>).)*?<w:t[^>]*>§§([^§<]+)§§</w:t></w:r>', re.S)
    doc, count = pattern.subn(lambda m: control(m.group(1)), doc)
    assert "§§" not in doc, "a marker was not replaced"
    files["word/document.xml"] = doc.encode("utf-8")

    styles = files["word/styles.xml"].decode("utf-8")
    if "PlaceholderText" not in styles:
        styles = styles.replace("</w:styles>", PLACEHOLDER_STYLE + "</w:styles>")
    files["word/styles.xml"] = styles.encode("utf-8")

    with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as z:
        # [Content_Types].xml first, as Word expects
        for n in sorted(files, key=lambda n: (n != "[Content_Types].xml", n)):
            z.writestr(n, files[n])
    print(f"{count} content controls written to {dst}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
