/**
 * alerts.js: the ALERTS tab. A PREVIEW: alerts can be created and removed
 * here, but nothing is saved or sent. Delivery (email, accounts) is for IT
 * to build behind the login.
 *
 * Three kinds of alert:
 *   threshold  a country/region/theme's weekly GSI falls below / rises above a value
 *   change     its GSI moves by at least N points from one week to the next
 *   incident   an incident at or above a severity is tied to it
 *
 * To make the preview concrete, each alert says how often it would have
 * fired so far this year, computed from the real data.
 *
 * Reads:  state.alertDraft (set by "Set alert" on the GSI Map: pre-selects
 *         the country), state.alerts
 * Writes: alerts, alertDraft
 * DOM:    #screen-alerts
 */
import { byId, esc, onAction } from "../ui/dom.js";
import { fmt } from "../ui/format.js";
import { weekShort } from "../model/weeks.js";

export function createAlerts(ctx) {
  const { cfg, store, gsi, incidents } = ctx;
  const el = byId("screen-alerts");
  const byLevel = (lvl) => cfg.entities.filter((e) => e.level === lvl).sort((a, b) => a.name.localeCompare(b.name));

  // Two examples so the list isn't empty on first visit.
  let alerts = [
    { id: 1, kind: "threshold", target: "Iran", dir: "below", value: -30, delivery: "As soon as the week is published (Fridays, 5pm ET)" },
    { id: 2, kind: "incident", target: "MENA", severity: "Medium/High", delivery: "Weekly digest email" }
  ];
  let nextId = 3;

  /* ---------------------------------------------- describing an alert */
  const nameOf = (key) => gsi.entity(key)?.name || key;

  function sentence(a) {
    if (a.kind === "threshold") return `${nameOf(a.target)}'s weekly GSI ${a.dir === "below" ? "falls below" : "rises above"} ${fmt(a.value)}`;
    if (a.kind === "change") return `${nameOf(a.target)}'s GSI moves by ${a.value} points or more in a week`;
    return `A ${a.severity} or higher severity incident is tied to ${nameOf(a.target)}`;
  }

  /** How many times the alert would have fired on the published data, and when last. */
  function wouldHaveFired(a) {
    let hits = [];
    if (a.kind === "threshold" || a.kind === "change") {
      hits = gsi.weeks.filter((w) => {
        if (a.kind === "change") { const c = gsi.change(a.target, w); return c !== null && Math.abs(c) >= a.value; }
        const v = gsi.value(a.target, w).value;
        return v !== null && (a.dir === "below" ? v < a.value : v > a.value);
      });
    } else {
      const min = cfg.severities.indexOf(a.severity);
      hits = [...new Set(incidents.filter((i) => a.target in i.scores && cfg.severities.indexOf(i.severity) >= min).map((i) => i.week))].sort();
    }
    if (!hits.length) return "Would not have fired yet this year.";
    return `Would have fired in ${hits.length} of ${gsi.weeks.length} weeks so far this year, most recently the week of ${weekShort(hits[hits.length - 1])}.`;
  }

  /* ------------------------------------------------------- interaction */
  onAction(el, {
    remove: (b) => { alerts = alerts.filter((a) => a.id !== Number(b.dataset.id)); render(store.get(), true); },
    save: () => {
      const form = byId("alertForm");
      const kind = form.querySelector('input[name="kind"]:checked').value;
      const a = { id: nextId++, kind, target: byId("aTarget").value, delivery: byId("aDelivery").value };
      if (kind === "threshold") { a.dir = byId("aDir").value; a.value = Number(byId("aValue").value); }
      if (kind === "change") a.value = Math.abs(Number(byId("aChange").value));
      if (kind === "incident") a.severity = byId("aSeverity").value;
      alerts = [a, ...alerts];
      render(store.get(), true);
    }
  });
  // Show only the fields the chosen kind needs.
  el.addEventListener("change", (ev) => { if (ev.target.name === "kind") showKind(ev.target.value); });
  function showKind(kind) {
    for (const k of ["threshold", "change", "incident"]) byId(`aField-${k}`).hidden = k !== kind;
  }

  /* ------------------------------------------------------------ render */
  const opts = (list, sel) => list.map((e) => `<option value="${e.key}"${e.key === sel ? " selected" : ""}>${esc(e.name)}</option>`).join("");

  let lastDraft = undefined;
  function render(state, force = false) {
    // Re-draw on first visit, after a change here, or when "Set alert" sent a new target.
    if (!force && lastDraft === state.alertDraft && el.innerHTML) return;
    lastDraft = state.alertDraft;
    const draftKey = state.alertDraft?.target && gsi.entity(state.alertDraft.target) ? state.alertDraft.target : cfg.defaultSelection.country;

    el.innerHTML = `
      <div class="preview-note"><b style="font-weight:500">Preview.</b> This shows how alerts will work for subscribers. Alerts you create here aren't saved or sent yet; delivery will be set up with subscriber accounts.</div>
      <div class="alert-layout">
        <form class="alert-form" id="alertForm" onsubmit="return false" aria-labelledby="alertFormTitle">
          <h2 id="alertFormTitle">Create an alert</h2>
          <div class="radios" role="radiogroup" aria-label="Alert type">
            <label><input type="radio" name="kind" value="threshold" checked> GSI crosses a level</label>
            <label><input type="radio" name="kind" value="change"> GSI changes sharply</label>
            <label><input type="radio" name="kind" value="incident"> Severe incident</label>
          </div>
          <label>COUNTRY, REGION OR THEME
            <select id="aTarget">
              <optgroup label="Spotlight countries">${opts(byLevel("country"), draftKey)}</optgroup>
              <optgroup label="Regions">${opts(byLevel("region"), draftKey)}</optgroup>
              <optgroup label="Global themes">${opts(byLevel("theme"), draftKey)}</optgroup>
            </select></label>
          <div class="row" id="aField-threshold">
            <label>WHEN THE WEEKLY GSI<select id="aDir"><option value="below">Falls below</option><option value="above">Rises above</option></select></label>
            <label>LEVEL (−100 TO +100)<input id="aValue" type="number" min="-100" max="100" step="5" value="-30"></label>
          </div>
          <div class="row" id="aField-change" hidden>
            <label>WHEN IT MOVES BY AT LEAST (POINTS)<input id="aChange" type="number" min="5" max="200" step="5" value="20"></label>
          </div>
          <div class="row" id="aField-incident" hidden>
            <label>SEVERITY AT LEAST<select id="aSeverity">${cfg.severities.map((s) => `<option${s === "Medium/High" ? " selected" : ""}>${s}</option>`).join("")}</select></label>
          </div>
          <label>DELIVERY<select id="aDelivery"><option>As soon as the week is published (Fridays, 5pm ET)</option><option>Weekly digest email</option></select></label>
          <button type="button" class="btn dark" data-action="save" style="align-self:flex-start;min-height:44px">Create alert</button>
        </form>
        <div class="alert-list">
          <h2>Your alerts</h2>
          ${alerts.length ? alerts.map((a) => `
            <div class="alert-card">
              <div>
                <div class="t">${esc(sentence(a))}</div>
                <div class="m">${esc(a.delivery)}</div>
                <div class="would">${esc(wouldHaveFired(a))}</div>
              </div>
              <button class="btn" data-action="remove" data-id="${a.id}" aria-label="Remove alert: ${esc(sentence(a))}">Remove</button>
            </div>`).join("") : `<p class="muted">No alerts yet.</p>`}
        </div>
      </div>`;
  }

  return { render };
}
