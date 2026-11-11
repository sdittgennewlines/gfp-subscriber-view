# Import page

**GFP Import.html** turns the final Weekly Incidents Word document into rows to paste into the Excel master and the Mantis Google Sheet. It's one self-contained file: keep it on your computer and double-click to open it in Chrome or Edge. It works offline, and your files never leave your computer.

## Each week (Friday, after Editorial's 11am final)

1. In Word, accept all tracked changes (Review → Accept → Accept All Changes) and save.
2. Open GFP Import.html.
3. Drop the Word document on box 1. Drop the latest GFP Incidents Master.xlsx on box 2. The master is optional but catches incidents already in it and uses your Places and Lists.
4. Fix anything in red, in Word, then load the document again. You can also untick an incident to leave it out. Amber items are worth a look but can be copied as they are.
5. Unmatched places: match each to a standard place, or add it as a new one with coordinates if you have them.
6. Click **Copy rows for Excel** and paste into the first empty cell of column A in the master's Incidents sheet.
7. Click **Copy rows for Mantis** and paste into the first empty cell of column A in the Google Sheet's "Incidents - Global" tab (until the end of 2026).
8. If there are new places, click **Copy new places** and paste into the first empty row of the master's Places sheet.

## What it fills in

- **ID:** date + a short code from the title and link. It's the same scheme as the site, so the same incident always gets the same ID.
- **Mantis:**
  - Scope from the level: Country, International, or Global / Thematic.
  - Scenario from the headline GSI's sign: Escalation, De-escalation, or Status quo.
  - Severity from its size: Low … High, with a score of 0 marked Low.
  - Each country's checkbox and score from Counts toward. When Counts toward is blank, the Location gets the headline score.
  - Taiwan, Place Detail, Key incident and Related link have no Mantis column and are left out.
- **Excel:** Secondary type is left blank. "Added on" is today's date.

## Rebuilding

After changing `import.src.html` or the lists, run:

```
node tools/import/build-import.mjs
```

That writes GFP Import.html with the template's locations, the types and the starter places built in.

## Tested

Tested on a mock document of the 57 incidents from the week ending Nov 6. The test cases were copied tables with duplicate tags, the untouched example page, a summary pasted next to its box, "UN headquarters" (matched to New York City), a new place, "EU (Brussels)" and one open tracked change.

Results:

- **Excel rows:** they match the master's rows for the same incidents, field for field.
- **Mantis rows:** they match the Google Sheet's. The only differences are Scope and Scenario where the new rules differ from analysts' old entries.
- **Tracked change:** a document with an open tracked change is refused.
