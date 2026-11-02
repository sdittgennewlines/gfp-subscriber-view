/**
 * state.js: the single source of truth for what the page is showing.
 *
 * Components never talk to each other. They read the state and, when the
 * reader does something, call store.set({...}). Every subscriber (each
 * component's render function) then runs with the new state.
 *
 * State shape:
 *   tab       "overview" | "map" | "feed" | "reports" | "alerts"
 *   level     "country" | "region"     the switch above the map
 *   sel       what is selected on the GSI Map:
 *               an entity key ("Sudan", "MENA", "Energy"), or
 *               "place:<Location>" for a country without a GSI ("place:Russia")
 *   week      the week shown, by its Friday ("2026-10-30")
 *   ev        the open incident's id, or null (= the first in the list)
 *   unscored  GSI Map event list: also show incidents located in the country
 *             that are not scored for it
 *   range     trend chart span: "3M" | "6M" | "1Y" | "All"
 *   cite      "page" | "event" | null  (the citation dialog)
 *   alertDraft { target } when "Set alert" sends the reader to the Alerts tab
 *
 * (The Event Feed's filters and the Alerts list are kept inside those
 * screens, since nothing else needs them.)
 *
 * The parts worth sharing (tab, level, sel, week, ev) are mirrored in the
 * address bar (#tab=map&sel=Sudan&week=2026-10-30...), so a copied link
 * opens the same view. That is what the Share buttons copy.
 */

const SHARED_KEYS = ["tab", "level", "sel", "week", "ev"];

export function createStore(initial) {
  let state = { ...initial, ...readHash() };
  const listeners = [];

  function set(patch) {
    state = { ...state, ...patch };
    writeHash(state);
    listeners.forEach((fn) => fn(state));
  }

  // Back/forward or a pasted link: adopt the address bar's values.
  window.addEventListener("hashchange", () => {
    const fromHash = readHash();
    if (SHARED_KEYS.some((k) => (fromHash[k] ?? null) !== (state[k] ?? null))) set(fromHash);
  });

  return {
    get: () => state,
    set,
    subscribe: (fn) => listeners.push(fn)
  };
}

/** #tab=map&sel=Sudan → { tab: "map", sel: "Sudan" } (only known keys). */
function readHash() {
  const params = new URLSearchParams(location.hash.replace(/^#/, ""));
  const out = {};
  for (const k of SHARED_KEYS) if (params.has(k)) out[k] = params.get(k) || null;
  return out;
}

/** Mirror the shareable keys into the address bar without adding history entries. */
function writeHash(state) {
  const params = new URLSearchParams();
  for (const k of SHARED_KEYS) if (state[k]) params.set(k, state[k]);
  const hash = "#" + params.toString();
  // Some embedding frames forbid changing the address; the page works without it.
  try { if (hash !== location.hash) history.replaceState(null, "", hash); } catch { /* ignore */ }
}

/** A full link to the current view (used by Share and in citations). */
export function shareUrl(state, base) {
  const params = new URLSearchParams();
  for (const k of SHARED_KEYS) if (state[k]) params.set(k, state[k]);
  const root = base || location.href.split("#")[0];
  return `${root}#${params.toString()}`;
}
