/**
 * tabs.js: the platform's tab bar (OVERVIEW · GSI MAP · EVENT FEED ·
 * REPORTS · ALERTS) and switching between screens.
 *
 * Each screen is a <section id="screen-<tab>"> in index.html; only the
 * active one is visible.
 *
 * Reads:  state.tab
 * Writes: tab
 * DOM:    #tabs, #screen-*
 */
import { byId, onAction, esc } from "../ui/dom.js";

export const TABS = [
  { id: "overview", label: "OVERVIEW" },
  { id: "map", label: "GSI MAP" },
  { id: "feed", label: "EVENT FEED" },
  { id: "reports", label: "REPORTS" },
  { id: "alerts", label: "ALERTS" }
];

export function createTabs(ctx) {
  const { store, cfg } = ctx;
  const el = byId("tabs");

  el.innerHTML = `
    <span class="list" role="tablist" aria-label="Platform">
      ${TABS.map((t) => `<button class="tab" role="tab" id="tab-${t.id}" aria-controls="screen-${t.id}" data-action="go" data-tab="${t.id}">${t.label}</button>`).join("")}
    </span>
    <a class="out" href="${esc(cfg.monitorsHubUrl)}">All New Lines monitors →</a>`;

  onAction(el, {
    go: (b) => {
      if (store.get().tab === b.dataset.tab) return;
      store.set({ tab: b.dataset.tab, cite: null });
      window.scrollTo({ top: el.offsetTop - 8 });
    }
  });

  // Arrow keys move between tabs (standard tablist keyboard behaviour).
  el.addEventListener("keydown", (ev) => {
    if (!["ArrowLeft", "ArrowRight"].includes(ev.key)) return;
    const i = TABS.findIndex((t) => t.id === store.get().tab);
    const next = TABS[(i + (ev.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length];
    store.set({ tab: next.id });
    byId(`tab-${next.id}`).focus();
  });

  function render(state) {
    for (const t of TABS) {
      const on = t.id === state.tab;
      const b = byId(`tab-${t.id}`);
      b.setAttribute("aria-selected", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
      byId(`screen-${t.id}`).hidden = !on;
    }
  }

  return { render };
}
