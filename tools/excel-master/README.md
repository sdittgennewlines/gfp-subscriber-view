# Excel master

`build_master.py` builds **GFP Incidents Master.xlsx**, the workbook that replaces the "Incidents - Global" Google Sheet. It migrates every incident the site publishes today.

```
node tools/build-data.mjs <folder with the CSV exports>
python3 tools/excel-master/build_master.py <folder with the CSV exports> "GFP Incidents Master.xlsx"
```

Run both again on a fresh export right before switching over. The script rebuilds the whole file.

## Sheets

- **Incidents:** one row per incident. Purple-header columns are typed or pasted from the import page. Grey-header columns sit at the right, so one paste from the import page never overwrites them. They are formulas:
  - Week ending;
  - Category;
  - Level, Assessment, Severity;
  - Problems.
  
  Rows up to 6,000 already have formulas and dropdowns.
- **Weekly GSI:** every spotlight country, region and theme per week, as formulas, coloured like the map.
- **Lists:** dropdown options (locations, types with categories, Counts toward, scores).
- **Places:** standard places for Place Detail, each with coordinates and "also written as" names.
- **To review:** the migration's judgment calls. Every row is kept as published, so no GSI changes until a call is made.

## Rules the master follows

The same rules as the site (`js/model/wording.js`):

- **Blank Counts toward:** if every Counts toward line is blank, the headline GSI counts toward the Location, when the Location is a spotlight country.
- **`None` in Counts toward (old rows only):** the incident counts toward nothing. This keeps the 72 old incidents located in a spotlight country but scored for nothing exactly as published.
- **Taiwan:** Taiwan scores the site derived from the location are written out in Counts toward when the incident also counts toward something else.

## Checked

After a LibreOffice recalculation:

- 0 formula errors;
- every incident's week, category, level, assessment and severity match the site;
- all 650 entity-weeks in Weekly GSI match the site's GSI exactly.
