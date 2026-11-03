/**
 * toolbar.js: the row above the map.
 *
 *   [Country level | Regions & themes]  COUNTRY [select ▾]   colour key   [Download map] [Share]
 *
 * The switch changes what the map, events, profile and table are about.
 * The select lists the same things you can click on the map: in country
 * mode the 17 spotlight countries plus every other country with incidents
 * (which has no GSI); in region mode the four regions and two themes.
 *
 * Reads:  state.level, state.sel
 * Writes: level, sel, ev
 * DOM:    #mapToolbar
 */
import { byId, esc, onAction } from "../../ui/dom.js";
import { defaultSel, PLACE_PREFIX, describe } from "../../model/selection.js";
import { share } from "../../actions/share.js";

export function createMapToolbar(ctx) {
  const { cfg, store, places } = ctx;
  const el = byId("mapToolbar");

  const byName = (a, b) => a.name.localeCompare(b.name);
  const countries = cfg.entities.filter((e) => e.level === "country").sort(byName);
  const regions = cfg.entities.filter((e) => e.level === "region").sort(byName);
  const themes = cfg.entities.filter((e) => e.level === "theme").sort(byName);
  const others = places.list.filter((p) => !p.entity);

  onAction(el, {
    level: (b) => {
      const level = b.dataset.level;
      if (level === store.get().level) return;
      store.set({ level, sel: defaultSel(cfg, level), ev: null });
    },
    download: () => ctx.exportMap(store.get()),
    share: () => share(store.get(), cfg, `${describe(ctx, store.get()).name}: Geopolitical Stability Index`)
  });
  el.addEventListener("change", (ev) => {
    if (ev.target.id === "selPicker") store.set({ sel: ev.target.value, ev: null });
  });

  const option = (value, label, sel) => `<option value="${esc(value)}"${value === sel ? " selected" : ""}>${esc(label)}</option>`;

  function render(state) {
    const regionMode = state.level === "region";
    const options = regionMode
      ? `<optgroup label="Regions">${regions.map((e) => option(e.key, e.name, state.sel)).join("")}</optgroup>
         <optgroup label="Global themes">${themes.map((e) => option(e.key, e.name, state.sel)).join("")}</optgroup>`
      : `<optgroup label="Spotlight countries (GSI)">${countries.map((e) => option(e.key, e.name, state.sel)).join("")}</optgroup>
         <optgroup label="Other places with incidents (no GSI)">${others.map((p) => option(PLACE_PREFIX + p.name, `${p.name} (${p.count})`, state.sel)).join("")}</optgroup>`;

    el.innerHTML = `
      <div class="toolbar-left">
        <div class="switch" role="group" aria-label="Map level">
          <button data-action="level" data-level="country" aria-pressed="${!regionMode}">Country level</button>
          <button data-action="level" data-level="region" aria-pressed="${regionMode}">Regions &amp; themes</button>
        </div>
        <label class="picker">${regionMode ? "REGION OR THEME" : "COUNTRY"}
          <select id="selPicker">${options}</select>
        </label>
      </div>
      <div class="legend" aria-label="Colour scale, from destabilizing (red) through status quo (pale gold) to stabilizing (blue)">
        <span class="t" style="margin-left:0">Destabilizing</span>
        ${cfg.scale.map((s) => `<span class="sw" style="background:${s.fill}" title="${esc(s.label)}"></span>`).join("")}
        <span class="t">Stabilizing</span>
        <span class="sw blank"></span><span class="t after">No incidents this week</span>
        ${regionMode ? "" : `<span class="sw other" style="background:${cfg.otherPlaceFill}"></span><span class="t after">Other places with incidents (no GSI)</span>`}
      </div>
      <div class="toolbar-right">
        <button class="btn" data-action="download">Download map</button>
        <button class="btn" data-action="share">Share</button>
      </div>`;
  }

  return { render };
}
