// Writes "GFP Import.html" from import.src.html, filling in the built-in lists:
// locations (the Word template's Location dropdown), types with their category,
// and the starter standard places (the same as the master's Places sheet).
// The page prefers the lists in the Excel master when it is loaded.
//
// usage: node tools/import/build-import.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");
const lists = JSON.parse(fs.readFileSync(path.join(repo, "tools/word-template/lists.json"), "utf8"));
const types = JSON.parse(fs.readFileSync(path.join(repo, "data/types.json"), "utf8")).types;

// Keep in step with PLACES in tools/excel-master/build_master.py.
const places = [
  ["New York City", "United States", 40.7128, -74.006, "New York; NYC; Manhattan; UN headquarters; United Nations headquarters; UN HQ; UN General Assembly; UN Security Council"],
  ["Washington, D.C.", "United States", 38.9072, -77.0369, "Washington; Washington DC; DC; White House; Pentagon; Capitol Hill; State Department"],
  ["Brussels", "EU", 50.8503, 4.3517, "EU; European Union; European Commission; European Council; NATO headquarters"],
  ["Geneva", "Switzerland", 46.2044, 6.1432, "UN Geneva; UN Human Rights Council; WTO; WHO"],
  ["The Hague", "Netherlands", 52.0705, 4.3007, "ICC; ICJ; International Criminal Court; International Court of Justice"],
  ["Vienna", "Austria", 48.2082, 16.3738, "IAEA; OPEC; OSCE"],
  ["Gaza City", "Gaza", 31.5017, 34.4668, "Gaza Strip; Gaza"],
].map(([name, location, lat, lon, aliases]) => ({ name, location, lat, lon, aliases }));

const data = {
  locations: lists.country,
  types: Object.fromEntries(types.map((t) => [t.name, t.category])),
  places,
};
const src = fs.readFileSync(path.join(here, "import.src.html"), "utf8");
const out = src.replace("/*LISTS*/", JSON.stringify(data).replace(/</g, "\\u003c"));
fs.writeFileSync(path.join(here, "GFP Import.html"), out);
console.log(`GFP Import.html: ${data.locations.length} locations, ${types.length} types, ${places.length} places`);
