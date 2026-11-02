/**
 * gsi.js: every Geopolitical Stability Index number on the site comes from
 * here. Nothing else does arithmetic on scores.
 *
 * THE RULE
 *   An entity's GSI for a week = the average of its scores over that week's
 *   incidents in which its checkbox is ticked (normalize.js has already kept
 *   only those scores, in incident.scores[entityKey]).
 *   A week with no such incidents is blank (null), never zero.
 *
 * An incident can count toward several entities at once, each with its own
 * score (e.g. -30 for Iran, -10 for MENA). Its headline GSI (incident.gsi)
 * is shown with the incident but is not used in any entity's average, except
 * for entities scored by location (Taiwan, until the sheet has its columns).
 *
 * createGsi(incidents, config, asOf) returns an object with:
 *   entities            config.entities
 *   entity(key)         one entity, or undefined
 *   weeks               every week from the first incident to `asOf`, oldest first
 *   latestWeek          the newest week (the one ending on `asOf`)
 *   value(key, week)    { value, n }   value = average (null if no incidents), n = count
 *   series(key)         [{ week, value, n }] for every week
 *   change(key, week)   value minus the previous week's value (null if either is blank)
 *   ranking(level, week) entities of one level, most destabilized first,
 *                       blanks last: [{ entity, value, n, prev, change }]
 *   scoredIncidents(key) incidents that count toward the entity, newest first
 */
import { weekOf, weekRange, addDays } from "./weeks.js";

export function createGsi(incidents, config, asOf) {
  const entities = config.entities;
  const byKey = new Map(entities.map((e) => [e.key, e]));

  // 1. Sum and count every entity's scores per week, in one pass.
  //    totals.get(key).get(week) = { sum, n }
  const totals = new Map(entities.map((e) => [e.key, new Map()]));
  const scored = new Map(entities.map((e) => [e.key, []]));
  for (const inc of incidents) {
    for (const [key, score] of Object.entries(inc.scores)) {
      const perWeek = totals.get(key);
      if (!perWeek) continue; // a key no longer in config
      const t = perWeek.get(inc.week) || { sum: 0, n: 0 };
      t.sum += score;
      t.n += 1;
      perWeek.set(inc.week, t);
      scored.get(key).push(inc); // incidents arrive newest first already
    }
  }

  // 2. The week axis: from the first incident's week to the as-of week.
  const latestWeek = weekOf(asOf, config.weekStartsOn);
  const firstDate = incidents.reduce((m, i) => (i.date < m ? i.date : m), asOf);
  const weeks = weekRange(weekOf(firstDate, config.weekStartsOn), latestWeek);

  /** The entity's GSI for one week. */
  function value(key, week) {
    const t = totals.get(key)?.get(week);
    return t ? { value: t.sum / t.n, n: t.n } : { value: null, n: 0 };
  }

  /** Week-on-week change (null when either week is blank). */
  function change(key, week) {
    const now = value(key, week).value;
    const prev = value(key, addDays(week, -7)).value;
    return now === null || prev === null ? null : now - prev;
  }

  /** Most destabilized (most negative) first; blank weeks at the end. */
  function ranking(level, week) {
    return entities
      .filter((e) => e.level === level)
      .map((e) => {
        const v = value(e.key, week);
        return { entity: e, value: v.value, n: v.n, prev: value(e.key, addDays(week, -7)).value, change: change(e.key, week) };
      })
      .sort((a, b) => {
        if (a.value === null && b.value === null) return a.entity.name.localeCompare(b.entity.name);
        if (a.value === null) return 1;
        if (b.value === null) return -1;
        return a.value - b.value;
      });
  }

  return {
    entities,
    entity: (key) => byKey.get(key),
    weeks,
    latestWeek,
    value,
    change,
    ranking,
    series: (key) => weeks.map((w) => ({ week: w, ...value(key, w) })),
    scoredIncidents: (key) => scored.get(key) || []
  };
}
