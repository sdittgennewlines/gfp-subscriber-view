/**
 * selection.js: what is selected on the GSI Map, described once so every
 * component agrees.
 *
 * state.sel is either an entity key ("Sudan", "MENA", "Energy") or
 * "place:<Location>" for a country with incidents but no GSI ("place:Russia").
 *
 * describe(ctx, state) → {
 *   sel        the raw state.sel
 *   kind       "entity" | "place"
 *   level      "country" | "region" | "theme" | "place"
 *   name       display name
 *   entity     the config entity (kind "entity" only)
 *   place      the sheet Location name, for countries and places ("DR Congo", "Russia")
 *   hasGsi     true for entities
 * }
 *
 * events(ctx, state) → [{ inc, score }] newest first, up to state.week:
 *   entity:   incidents scored for it (score = its score for the entity);
 *             for countries with state.unscored, also incidents located there
 *             that are not scored for it (score = null)
 *   place:    incidents whose Location is the place (score = null)
 */

export const PLACE_PREFIX = "place:";

/** The default selection for a level ("country" or "region"). */
export function defaultSel(cfg, level) {
  return level === "region" ? cfg.defaultSelection.region : cfg.defaultSelection.country;
}

/** Make sure state.sel makes sense for state.level; returns a fixed sel. */
export function validSel(ctx, level, sel) {
  const e = sel && ctx.gsi.entity(sel);
  if (level === "region") return e && e.level !== "country" ? sel : defaultSel(ctx.cfg, "region");
  if (e && e.level === "country") return sel;
  if (sel?.startsWith(PLACE_PREFIX) && ctx.places.byName(sel.slice(PLACE_PREFIX.length))) return sel;
  return defaultSel(ctx.cfg, "country");
}

export function describe(ctx, state) {
  const sel = state.sel;
  if (sel?.startsWith(PLACE_PREFIX)) {
    const name = sel.slice(PLACE_PREFIX.length);
    return { sel, kind: "place", level: "place", name, place: name, entity: null, hasGsi: false };
  }
  const e = ctx.gsi.entity(sel);
  return { sel, kind: "entity", level: e.level, name: e.name, place: e.place || null, entity: e, hasGsi: true };
}

export function events(ctx, state) {
  const d = describe(ctx, state);
  const upTo = (inc) => inc.week <= state.week;

  if (d.kind === "place") {
    return ctx.places.incidentsAt(d.place).filter(upTo).map((inc) => ({ inc, score: null }));
  }

  const scored = ctx.gsi.scoredIncidents(d.entity.key).filter(upTo).map((inc) => ({ inc, score: inc.scores[d.entity.key] }));
  if (d.level !== "country" || !state.unscored) return scored;

  // Add incidents located in the country that are not scored for it.
  const extra = ctx.places.incidentsAt(d.place)
    .filter((inc) => upTo(inc) && !(d.entity.key in inc.scores))
    .map((inc) => ({ inc, score: null }));
  return [...scored, ...extra].sort((a, b) => (a.inc.date < b.inc.date ? 1 : a.inc.date > b.inc.date ? -1 : 0));
}

/** How many located-but-unscored incidents a country has (for the toggle label). */
export function unscoredCount(ctx, state) {
  const d = describe(ctx, state);
  if (d.kind !== "entity" || d.level !== "country") return 0;
  return ctx.places.incidentsAt(d.place).filter((inc) => inc.week <= state.week && !(d.entity.key in inc.scores)).length;
}
