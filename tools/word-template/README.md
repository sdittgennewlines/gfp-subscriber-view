# Weekly incident report: Word template

`GFP weekly incident report - template.docx` is the form analysts fill in each week. Editorial edits it, and the import page reads it.

Every field is a Word content control (a dropdown, date picker or text box) with a hidden **tag**, e.g. `gsi#3`, `entity2#3`. The import reads fields by tag, so labels, wording and layout can change freely. Keep the tags.

## Rebuilding the template

After changing the layout, wording or dropdown lists:

```
node tools/word-template/build-template.cjs            # layout (docx npm package)
python3 tools/word-template/sdt.py tools/word-template/layout.docx "tools/word-template/GFP weekly incident report - template.docx"
```

`lists.json` (written by `build-template.cjs`) holds every dropdown's options: countries, the 34 types, the scores, and the 23 countries, regions and themes.

There are no Scope, Scenario, Severity or Analyst fields. The platform works out level, wording and severity from the scores (`js/model/wording.js`).

## Fields that differ from the sheet

- **Location** (tag `country`) is always required: a country, or "EU (Brussels)" (stored as EU). There is no regional or Caribbean option. **Place Detail** (tag `place`) is optional free text, such as a city.
- **Key Incident?** (tag `featured`) is left blank by Student Fellows. Blank counts as No.

## Place Detail and the map (planned for the Excel master)

Place Detail will be matched against a list of standard places, each with one set of coordinates, so the map can place incidents more precisely than by country. Different spellings of the same place resolve to one standard place: "New York", "UN headquarters" and "Manhattan" all become New York City. The import page shows unmatched places so the reviewer can match them to a standard place or add a new one.
