/**
 * Geopolitical Forecasting Platform (subscriber view): site configuration.
 *
 * This is the one file to edit when the sheet, the spotlight countries, the
 * regions, the colours or the placeholder links change. Every other file
 * reads from here.
 *
 * It is plain JavaScript (not JSON) so that it can carry comments, and it is
 * read both by the browser and by tools/build-data.mjs (the data refresh).
 */
export const CONFIG = {
  /* ================================================================ DATA */

  // The spreadsheet the analysts work in. The site is static: the data is
  // refreshed by hand from CSV exports of these three tabs (see
  // tools/build-data.mjs). Only "Incidents - Global" feeds the GSI; the other
  // two only feed the Type/Category filters. If the tabs are renamed (e.g.
  // when the sheet moves to Excel), change the names here.
  sheet: {
    tabs: {
      incidents: { name: "Incidents - Global" },
      types: { name: "Incidents - Type" },
      categories: { name: "Incidents - Category Mapping" }
    }
  },

  // Files the page loads. incidents.json and types.json are written by
  // tools/build-data.mjs; the rest are edited by hand.
  files: {
    incidents: "data/incidents.json", // built from the spreadsheet
    types: "data/types.json", // the 34 incident types and their categories
    profiles: "data/profiles.json", // country fact sheets (edited by hand)
    reports: "data/reports.json", // report links (placeholders for now)
    world: "data/world.json" // map outlines (built once by tools/build_map.py)
  },

  // Publishing rhythm. A refresh publishes incidents through the most recent
  // Friday at 5pm ET, so every published week is complete; that week is the
  // "latest" one on the site. `label` appears in the footer note.
  publish: { weekday: 5 /* Friday */, hour: 17, timeZone: "America/New_York", label: "weekly" },

  /* =============================================================== WEEKS */

  // A GSI week runs Saturday to Friday and is named by its Friday.
  // 6 = Saturday (JavaScript's getUTCDay numbering: 0 = Sunday).
  weekStartsOn: 6,

  /* ============================================================ ENTITIES */

  // Everything that gets a GSI. For each one:
  //   key      short internal id (also used in share links)
  //   name     what readers see
  //   level    "country" | "region" | "theme"
  //   check    the sheet's checkbox column ("Yes" = the incident counts)
  //   score    the sheet's score column for that entity
  //   place    (countries) the value the sheet's Location column uses for it
  //   chipAt   (optional) [longitude, latitude] for the map chip, when the
  //            country's centre would crowd a neighbour's chip
  //
  // Weekly GSI = the average of the entity's scores over that week's
  // incidents whose checkbox is ticked. A week with no ticked incidents is
  // blank (not zero).
  //
  // Taiwan has no checkbox/score columns in the sheet yet. Until it does,
  // `fallback: "location"` scores it from incidents whose Location is Taiwan,
  // using each incident's headline GSI. Add "Taiwan" + "GSI Taiwan" columns
  // to the sheet and they are used automatically instead.
  entities: [
    { key: "US", name: "United States", level: "country", check: "US", score: "GSI US", place: "United States" },
    { key: "China", name: "China", level: "country", check: "China", score: "GSI China", place: "China" },
    { key: "Iran", name: "Iran", level: "country", check: "Iran", score: "GSI Iran", place: "Iran" },
    { key: "Venezuela", name: "Venezuela", level: "country", check: "Venezuela", score: "GSI Venezuela", place: "Venezuela" },
    { key: "India", name: "India", level: "country", check: "India", score: "GSI India", place: "India", chipAt: [77, 17] }, // chip nudged south, clear of Myanmar
    { key: "Brazil", name: "Brazil", level: "country", check: "Brazil", score: "GSI Brazil", place: "Brazil" },
    { key: "Canada", name: "Canada", level: "country", check: "Canada", score: "GSI Canada", place: "Canada" },
    { key: "DRC", name: "DR Congo", level: "country", check: "DRC", score: "GSI DRC", place: "DR Congo" },
    { key: "Ethiopia", name: "Ethiopia", level: "country", check: "Ethiopia", score: "GSI Ethiopia", place: "Ethiopia" },
    { key: "France", name: "France", level: "country", check: "France", score: "GSI France", place: "France" },
    { key: "Germany", name: "Germany", level: "country", check: "Germany", score: "GSI Germany", place: "Germany" },
    { key: "Cuba", name: "Cuba", level: "country", check: "Cuba", score: "GSI Cuba", place: "Cuba" },
    { key: "Indonesia", name: "Indonesia", level: "country", check: "Indonesia", score: "GSI Indonesia", place: "Indonesia" },
    { key: "Mexico", name: "Mexico", level: "country", check: "Mexico", score: "GSI Mexico", place: "Mexico" },
    { key: "Myanmar", name: "Myanmar", level: "country", check: "Myanmar", score: "GSI Myanmar", place: "Myanmar" },
    { key: "Sudan", name: "Sudan", level: "country", check: "Sudan", score: "GSI Sudan", place: "Sudan" },
    { key: "Taiwan", name: "Taiwan", level: "country", check: "Taiwan", score: "GSI Taiwan", place: "Taiwan", fallback: "location" },

    // Regions. `members` are the map countries shaded in the region's colour
    // (Natural Earth names, see data/world.json); `label` is where the chip
    // sits, as [longitude, latitude]. NATO covers all of Europe plus Ukraine,
    // Belarus and Russia. The US and Canada are drawn under US/Americas,
    // because a country can only be shaded one colour.
    {
      key: "Indopacific", name: "Indo-Pacific", level: "region", check: "Indopacific", score: "GSI Indopac", label: [118, 18],
      note: "East, South and Southeast Asia, Australia and the Pacific",
      members: ["China", "Taiwan", "Japan", "South Korea", "North Korea", "Mongolia", "India", "Pakistan", "Bangladesh", "Sri Lanka", "Nepal", "Bhutan", "Myanmar", "Thailand", "Laos", "Cambodia", "Vietnam", "Malaysia", "Indonesia", "Philippines", "Brunei", "Timor-Leste", "Papua New Guinea", "Australia", "New Zealand", "Fiji", "Solomon Is.", "Vanuatu", "New Caledonia"]
    },
    {
      key: "MENA", name: "Middle East & North Africa", level: "region", check: "MENA", score: "GSI MENA", label: [42, 24],
      note: "The Middle East, the Gulf and North Africa",
      members: ["Morocco", "W. Sahara", "Algeria", "Tunisia", "Libya", "Egypt", "Israel", "Palestine", "Lebanon", "Syria", "Jordan", "Iraq", "Iran", "Saudi Arabia", "Yemen", "Oman", "United Arab Emirates", "Qatar", "Kuwait"]
    },
    {
      key: "NATO", name: "NATO", level: "region", check: "NATO", score: "GSI NATO", label: [32, 57],
      note: "NATO's members plus the rest of Europe, Ukraine, Belarus and Russia; drawn without the US and Canada, which are drawn under US/Americas",
      members: ["Albania", "Austria", "Belarus", "Belgium", "Bosnia and Herz.", "Bulgaria", "Croatia", "Cyprus", "N. Cyprus", "Czechia", "Denmark", "Estonia", "Finland", "France", "Germany", "Greece", "Greenland", "Hungary", "Iceland", "Ireland", "Italy", "Kosovo", "Latvia", "Lithuania", "Luxembourg", "Moldova", "Montenegro", "Netherlands", "North Macedonia", "Norway", "Poland", "Portugal", "Romania", "Russia", "Serbia", "Slovakia", "Slovenia", "Spain", "Sweden", "Switzerland", "Turkey", "Ukraine", "United Kingdom"]
    },
    {
      key: "Americas", name: "US/Americas", level: "region", check: "US/Americas", score: "GSI US/Americas", label: [-98, 28],
      note: "The United States, Canada, Latin America and the Caribbean",
      members: ["United States of America", "Canada", "Mexico", "Guatemala", "Belize", "Honduras", "El Salvador", "Nicaragua", "Costa Rica", "Panama", "Cuba", "Jamaica", "Haiti", "Dominican Rep.", "Puerto Rico", "Bahamas", "Trinidad and Tobago", "Colombia", "Venezuela", "Guyana", "Suriname", "Ecuador", "Peru", "Brazil", "Bolivia", "Paraguay", "Chile", "Argentina", "Uruguay", "Falkland Is."]
    },

    // Global themes: not places, so they are shown as cards above the map
    // (in "Regions & themes" mode) rather than shaded on it.
    { key: "Energy", name: "Global Energy", level: "theme", check: "Global Energy", score: "GSI Energy", note: "Energy security worldwide" },
    { key: "Climate", name: "Global Climate", level: "theme", check: "Global Climate", score: "GSI Climate", note: "Climate-related stability worldwide" }
  ],

  // Country selected when the page first loads.
  defaultSelection: { country: "Sudan", region: "MENA" },

  /* ============================================================== PLACES */

  // The sheet's Location values that are spelled differently on the map
  // (Natural Earth names). Anything not listed is matched by exact name.
  placeAliases: {
    "United States": "United States of America",
    "DR Congo": "Dem. Rep. Congo",
    Turkiye: "Turkey",
    "Viet Nam": "Vietnam",
    Gaza: "Palestine"
  },

  // Locations with no country outline on the map (too small at this scale,
  // or not a country). They are drawn as small labelled pins.
  // [longitude, latitude]
  placePins: {
    EU: { at: [4.35, 50.85], label: "EU (Brussels)" },
    Caribbean: { at: [-66, 15.5], label: "Caribbean" },
    Singapore: { at: [103.82, 1.35], label: "Singapore" }
  },

  /* ======================================================== GSI COLOURS */

  // The diverging scale: red = destabilizing, light purple =
  // status quo, blue = stabilizing. `max` is the upper edge of each step
  // (exclusive for positive steps, inclusive for negative ones, as drawn).
  scale: [
    { max: -60, fill: "#8E1B17", label: "−60 or lower" },
    { max: -40, fill: "#B8352B", label: "−40 to −60" },
    { max: -20, fill: "#D9705F", label: "−20 to −40" },
    { max: -5, fill: "#F0B3A5", label: "−5 to −20" },
    { max: 5, fill: "#E6E0F4", label: "Status quo (−5 to +5)" },
    { max: 20, fill: "#B7CDEA", label: "+5 to +20" },
    { max: 40, fill: "#7FA6D8", label: "+20 to +40" },
    { max: 60, fill: "#4277BE", label: "+40 to +60" },
    { max: Infinity, fill: "#1F4E8C", label: "+60 or higher" }
  ],
  // Trend chart: incidents scored at least this far from zero (either
  // direction) for the selected country/region/theme are marked on the chart
  // as vertical lines (red = destabilizing, blue = stabilizing).
  trendMarkerThreshold: 70,

  // Map zoom. `max` = how far you can zoom in (8 = 8×). From `detailFrom`×
  // the bubbles also show each place's name and GSI.
  mapZoom: { max: 8, detailFrom: 2 },

  // Map fill for places that have incidents but no GSI (non-spotlight
  // countries), and for places with nothing at all.
  otherPlaceFill: "#DAD6CC",
  emptyPlaceFill: "#EFEEE9",

  /* ============================================================ SEVERITY */

  // The five standard severity levels, lowest first. The sheet's spellings
  // ("low", "Low / Medium", "medium/high" ...) are folded into these.
  severities: ["Low", "Low/Medium", "Medium", "Medium/High", "High"],

  /* ======================================================== PLACEHOLDERS */

  // Everything below is a placeholder until the real links exist.
  subscriberName: "[SUBSCRIBER NAME]",
  monitorsHubUrl: "#monitors",

  // Where citations and share links point. "" = the address of the page
  // the reader is on (right for the demo; set the real URL once it's live).
  publicUrl: "",

  citation: {
    author: "Geopolitical Forecasting and Analysis Unit",
    publisher: "New Lines Institute for Strategy and Policy",
    platform: "Geopolitical Forecasting Platform"
  },

  // Cross-links to other New Lines monitors, shown on matching events.
  // Placeholder: tags incidents in `places` whose title contains one of
  // `titleIncludes` (the mockup's example: the drone strike in Abyei).
  // Once the sheet has a column for this, match on that instead
  // (see crossLinkFor in js/components/eventDetail.js).
  crossLinks: [
    {
      monitor: "Mass Atrocities Monitor",
      places: ["Sudan"],
      titleIncludes: ["Abyei"],
      text: "This event is documented on the Mass Atrocities Monitor.",
      cta: "See incident on the Mass Atrocities Monitor ↗",
      url: "#mass-atrocities-monitor"
    }
  ],

  // "Related New Lines work" placeholder shown for every place.
  relatedPlaceholder: [{ title: "[Related report or portfolio work]", meta: "Linked by the analyst team", url: "#" }]
};
