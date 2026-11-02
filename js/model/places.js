/**
 * places.js: connects three ways of naming a place.
 *
 *   sheet location   the Location column ("United States", "DR Congo", "EU")
 *   map name         the country's name on the map (Natural Earth:
 *                    "United States of America", "Dem. Rep. Congo")
 *   entity           a spotlight country with a GSI (config.entities, level "country")
 *
 * And it answers "which incidents happened in X?" (by Location), which is
 * what non-spotlight countries show instead of a GSI.
 *
 * createPlaces(incidents, config, world) returns:
 *   list                    every sheet location with incidents: [{ name, count, mapName, pin, entity }]
 *   byName(location)        one of those, or undefined
 *   atMapName(mapName)      the sheet location drawn as that map country, or undefined
 *   incidentsAt(location)   incidents whose Location is exactly that, newest first
 *   entityForPlace(location) the spotlight entity for a location, or undefined
 */

export function createPlaces(incidents, config, world) {
  const mapNames = new Set((world?.countries || []).map((c) => c.name));
  const countryEntities = config.entities.filter((e) => e.level === "country");

  // Group incidents by their Location (incidents are newest first already).
  const groups = new Map();
  for (const inc of incidents) {
    if (!inc.location) continue;
    if (!groups.has(inc.location)) groups.set(inc.location, []);
    groups.get(inc.location).push(inc);
  }

  const list = [...groups.entries()].map(([name, incs]) => {
    const alias = config.placeAliases[name] || name;
    return {
      name,
      count: incs.length,
      mapName: mapNames.has(alias) ? alias : null, // drawn as a country outline
      pin: config.placePins[name] || null, // or as a pin
      entity: countryEntities.find((e) => e.place === name) || null
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  const byName = new Map(list.map((p) => [p.name, p]));
  const byMapName = new Map(list.filter((p) => p.mapName).map((p) => [p.mapName, p]));

  // Spotlight countries are on the map even in a week with no incidents.
  for (const e of countryEntities) {
    const alias = config.placeAliases[e.place] || e.place;
    if (!byMapName.has(alias) && mapNames.has(alias)) byMapName.set(alias, { name: e.place, count: 0, mapName: alias, pin: null, entity: e });
  }

  return {
    list,
    byName: (name) => byName.get(name),
    atMapName: (mapName) => byMapName.get(mapName),
    incidentsAt: (name) => groups.get(name) || [],
    entityForPlace: (name) => countryEntities.find((e) => e.place === name),
    mapNameOf: (name) => { const a = config.placeAliases[name] || name; return mapNames.has(a) ? a : null; }
  };
}
