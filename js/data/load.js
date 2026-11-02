/**
 * load.js: fetches every data file the page needs, in parallel.
 *
 * Returns {
 *   incidents  cleaned incidents, newest first (see data/normalize.js)
 *   asOf       the Friday the data is published through ("2026-10-30")
 *   generated  when the data was last refreshed (ISO timestamp)
 *   types      [{ name, category }] for the filters
 *   profiles   country fact sheets
 *   reports    report links (placeholders)
 *   world      map outlines
 * }
 *
 * The incidents file is required; the rest fail soft (the page still works
 * without profiles or reports).
 */

async function loadJSON(url) {
  const res = await fetch(url, { cache: "no-cache" }); // always pick up the latest refresh
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

export async function loadAll(cfg) {
  const f = cfg.files;
  const soft = (p, fallback) => p.catch((err) => { console.warn(err); return fallback; });
  const [inc, types, profiles, reports, world] = await Promise.all([
    loadJSON(f.incidents),
    soft(loadJSON(f.types), { types: [] }),
    soft(loadJSON(f.profiles), { fields: [], countries: {} }),
    soft(loadJSON(f.reports), { weeklyMonitor: { urlTemplate: "#" }, quarterly: [], podcast: [] }),
    loadJSON(f.world)
  ]);
  return { incidents: inc.incidents, asOf: inc.asOf, generated: inc.generated, types: types.types, profiles, reports, world };
}
