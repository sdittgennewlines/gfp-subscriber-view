# Weekly incident report: Word template

`GFP weekly incident report - template.docx` is the form analysts fill in each week. Editorial edits it, and the import page reads it.

Every field is a Word content control (a dropdown, date picker or text box) with a hidden **tag**, e.g. `gsi#3`, `entity2#3`. The import reads fields by tag, so labels, wording and layout can change freely. Keep the tags.

## Rebuilding the template

After changing the layout, wording or dropdown lists:

```
node tools/word-template/build-template.js            # layout (docx npm package)
python3 tools/word-template/sdt.py tools/word-template/layout.docx "tools/word-template/GFP weekly incident report - template.docx"
```

`lists.json` (written by `build-template.js`) holds every dropdown's options: countries, the 34 types, the scores, and the 23 countries, regions and themes.

There are no Scope, Scenario, Severity or Analyst fields. The platform works out level, wording and severity from the scores (`js/model/wording.js`).
