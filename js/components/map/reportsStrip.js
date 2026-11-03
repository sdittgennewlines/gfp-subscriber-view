/**
 * reportsStrip.js: "This week's New Lines reports" at the bottom of the GSI
 * Map. The cards themselves (and their order) come from reportCards.js, so
 * they match the Overview.
 *
 * Reads:  state.week
 * DOM:    #reportsStrip
 * Data:   data/reports.json
 */
import { byId } from "../../ui/dom.js";
import { reportCards } from "../reportCards.js";

export function createReportsStrip(ctx) {
  const el = byId("reportsStrip");

  function render(state) {
    el.innerHTML = `
      <h2 class="section-h2">This week's New Lines reports</h2>
      <div class="cards">${reportCards(ctx.reports, state.week)}</div>`;
  }

  return { render };
}
