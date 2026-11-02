/**
 * worldMap.js: the shaded world map with its value chips.
 *
 * COUNTRY LEVEL
 *   - The 17 spotlight countries are shaded by their GSI for the selected
 *     week. A spotlight country with no incidents that week is white with a
 *     dashed outline. Each has a chip showing its value.
 *   - Every other country that has incidents is light grey and clickable:
 *     clicking it lists its incidents (no GSI). Places without an outline
 *     at this scale (EU, Caribbean, Singapore) are small pins.
 * REGIONS & THEMES
 *   - Each region's member countries are shaded by the region's GSI, with one
 *     chip per region. The two global themes aren't places, so they sit as
 *     cards above the map.
 *
 * The country outlines are drawn once; each render only updates colours,
 * classes and chips, so switching weeks is instant.
 *
 * Reads:  state.level, state.sel, state.week
 * Writes: sel, ev
 * DOM:    #mapPanel
 * Also provides ctx.exportMap(state): saves the current map as a PNG.
 */
import { byId, esc, onAction } from "../../ui/dom.js";
import { fill, fmt, fmtInt, ink, band, plural } from "../../ui/format.js";
import { PLACE_PREFIX, describe } from "../../model/selection.js";
import { weekLabel } from "../../model/weeks.js";
import { showTip, hideTip } from "../../actions/tooltip.js";
import { downloadSvgAsPng, slug, xml } from "../../actions/download.js";

/** Natural Earth I projection, identical to tools/build_map.py, for pins and region labels. */
function projector(world) {
  const { x0, y0, k } = world.project;
  return ([lon, lat]) => {
    const lam = (lon * Math.PI) / 180;
    const phi = (lat * Math.PI) / 180;
    const p2 = phi * phi;
    const p4 = p2 * p2;
    const x = lam * (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4)));
    const y = -phi * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4)));
    return [(x - x0) * k, (y - y0) * k];
  };
}

export function createWorldMap(ctx) {
  const { cfg, store, gsi, places, world } = ctx;
  const el = byId("mapPanel");
  const W = world.width;
  const H = world.height;
  const project = projector(world);

  // Lookups prepared once.
  const countries = cfg.entities.filter((e) => e.level === "country");
  const regions = cfg.entities.filter((e) => e.level === "region");
  const themes = cfg.entities.filter((e) => e.level === "theme");
  const entityByMapName = new Map(countries.map((e) => [places.mapNameOf(e.place), e]));
  const regionByMapName = new Map();
  regions.forEach((r) => r.members.forEach((m) => regionByMapName.set(m, r)));
  const labelOf = new Map(world.countries.map((c) => [c.name, c.label]));

  /** Where a spotlight country's chip goes (SVG units). config `chipAt` [lon, lat] overrides. */
  const chipPoint = (e) => (e.chipAt ? project(e.chipAt) : labelOf.get(places.mapNameOf(e.place)) || [0, 0]);

  /* ---------------------------------------------------------- skeleton */
  el.innerHTML = `
    <div class="themes" id="themeCards" hidden></div>
    <div class="map-box" style="aspect-ratio:${W} / ${H}">
      <svg id="mapSvg" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="mapTitle">
        <title id="mapTitle">World map</title>
        <g id="mapShapes">${world.countries.map((c) => `<path d="${c.d}" data-name="${esc(c.name)}"></path>`).join("")}</g>
        <g id="mapPins"></g>
      </svg>
      <div id="mapChips"></div>
    </div>
    <div class="map-note" id="mapNote"></div>`;
  const svg = byId("mapSvg");
  const paths = [...svg.querySelectorAll("#mapShapes path")];

  /* ------------------------------------------------- what a shape means */
  /**
   * For one map country, in the current state: what it represents and how
   * to draw it. Returns { target, fill, blank, tip } or null (inert land).
   *   target  the state.sel value a click selects
   */
  function shapeInfo(mapName, state) {
    if (state.level === "region") {
      const r = regionByMapName.get(mapName);
      if (!r) return null;
      const v = gsi.value(r.key, state.week);
      return { target: r.key, fill: fill(v.value), blank: v.value === null, tip: `<b>${esc(r.name)}</b> (${esc(mapName)})<br>GSI ${fmt(v.value)} · ${plural(v.n, "event")}` };
    }
    const e = entityByMapName.get(mapName);
    if (e) {
      const v = gsi.value(e.key, state.week);
      return { target: e.key, fill: fill(v.value), blank: v.value === null, tip: `<b>${esc(e.name)}</b><br>GSI ${fmt(v.value)} · ${v.value === null ? "no events this week" : plural(v.n, "event")}` };
    }
    const p = places.atMapName(mapName);
    if (p && placeCountUpTo(p.name, state.week) > 0) {
      return { target: PLACE_PREFIX + p.name, fill: cfg.otherPlaceFill, blank: false, tip: placeTip(p.name, state) };
    }
    return null;
  }

  const placeCountUpTo = (name, week) => places.incidentsAt(name).filter((i) => i.week <= week).length;
  function placeTip(name, state) {
    const all = placeCountUpTo(name, state.week);
    const thisWeek = places.incidentsAt(name).filter((i) => i.week === state.week).length;
    return `<b>${esc(name)}</b> · no GSI<br>${plural(all, "incident")} to date${thisWeek ? `, ${thisWeek} this week` : ""}`;
  }

  /* ------------------------------------------------------------ events */
  const select = (target) => { if (target) store.set({ sel: target, ev: null }); };

  svg.addEventListener("click", (ev) => {
    const path = ev.target.closest("path[data-name]");
    const pin = ev.target.closest("[data-pin]");
    if (pin) return select(PLACE_PREFIX + pin.dataset.pin);
    if (path) select(shapeInfo(path.dataset.name, store.get())?.target);
  });
  svg.addEventListener("pointermove", (ev) => {
    const path = ev.target.closest("path[data-name]");
    const pin = ev.target.closest("[data-pin]");
    if (pin) return showTip(placeTip(pin.dataset.pin, store.get()), ev);
    const info = path && shapeInfo(path.dataset.name, store.get());
    if (info) showTip(info.tip, ev); else hideTip();
  });
  svg.addEventListener("pointerleave", hideTip);
  onAction(el, { pick: (b) => select(b.dataset.target) });

  /* ------------------------------------------------------------ render */
  function render(state) {
    const regionMode = state.level === "region";
    const current = describe(ctx, state);
    byId("mapTitle").textContent = `World map shading ${regionMode ? "the four regions" : "the spotlight countries"} by GSI for the ${weekLabel(state.week, { upper: false, prefix: "week of " })}`;

    // 1. Shapes: fill, dashed outline for blank weeks, clickable, selected.
    const selMapNames = new Set(
      current.level === "region" ? current.entity.members
        : current.place ? [places.mapNameOf(current.place)] : []
    );
    for (const p of paths) {
      const info = shapeInfo(p.dataset.name, state);
      p.setAttribute("fill", info ? info.fill : cfg.emptyPlaceFill);
      p.classList.toggle("blank", !!info?.blank);
      p.classList.toggle("hit", !!info);
      p.classList.toggle("sel", selMapNames.has(p.dataset.name));
    }

    // 2. Pins for places without an outline (country level only).
    byId("mapPins").innerHTML = regionMode ? "" : Object.entries(cfg.placePins)
      .filter(([name]) => placeCountUpTo(name, state.week) > 0)
      .map(([name, pin]) => {
        const [x, y] = project(pin.at);
        const on = current.place === name;
        // Label only when selected (the tooltip names it on hover), so pins never cover chips.
        return `<g data-pin="${esc(name)}" class="pin" aria-label="${esc(pin.label)}: incidents, no GSI">
          <circle cx="${x}" cy="${y}" r="${on ? 6 : 4.5}" fill="${on ? "#1B1725" : "#8C8A91"}" stroke="#FFFFFF" stroke-width="1.5"></circle>
          ${on ? `<text x="${x + 9}" y="${y + 4}" font-size="12" font-weight="500" font-family="Roboto, sans-serif" fill="#1B1725">${esc(pin.label)}</text>` : ""}</g>`;
      }).join("");

    // 3. Chips: one per spotlight country, or one per region.
    const chipItems = (regionMode ? regions : countries).map((e) => {
      const v = gsi.value(e.key, state.week).value;
      const [x, y] = regionMode ? project(e.label) : chipPoint(e);
      const on = e.key === state.sel;
      const text = regionMode || on ? `${e.name} ${fmtInt(v)}` : fmtInt(v);
      return `<button class="chip" data-action="pick" data-target="${e.key}" aria-pressed="${on}"
        aria-label="${esc(e.name)}: ${v === null ? "no events this week" : "GSI " + fmt(v)}"
        style="left:${(x / W) * 100}%;top:${(y / H) * 100}%;color:${ink(v)}">${esc(text)}</button>`;
    });
    byId("mapChips").innerHTML = chipItems.join("");

    // 4. Theme cards (regions & themes level only).
    const tc = byId("themeCards");
    tc.hidden = !regionMode;
    if (regionMode) {
      tc.innerHTML = `<span class="lbl">GLOBAL THEMES · NOT TIED TO A PLACE</span>` + themes.map((e) => {
        const v = gsi.value(e.key, state.week);
        return `<button class="theme-card" data-action="pick" data-target="${e.key}" aria-pressed="${e.key === state.sel}" style="border-left-color:${v.value === null ? "#DCDAD3" : fill(v.value)}">
          <span><span class="nm">${esc(e.name)}</span><br><span class="sub">${esc(band(v.value))} · ${plural(v.n, "event")}</span></span>
          <span class="badge lg" style="background:${v.value === null ? "#F1F0EC" : "#FFFFFF"};color:${ink(v.value)}">${fmt(v.value)}</span></button>`;
      }).join("");
    }

    // 5. Caption.
    byId("mapNote").textContent = regionMode
      ? "Each region is shaded by its GSI for the week: the average score of the events our analysts tied to that region. NATO is drawn as its European members and Turkey; the US and Canada are drawn under US/Americas. Select a region or theme to open its events."
      : "Each spotlight country's shade is its GSI for the week: the average score of the events our analysts tied to it. Grey countries have incidents on record but no GSI; select one to read them.";
  }

  /* ------------------------------------------------------------ export */
  /** Build a self-contained SVG of the current map (title, chips, key) and save it as a PNG. */
  ctx.exportMap = (state) => {
    const regionMode = state.level === "region";
    const top = 70;
    const legendY = top + H + 30;
    const totalH = legendY + 60;
    const shapes = paths.map((p) => {
      const blank = p.classList.contains("blank");
      return `<path d="${p.getAttribute("d")}" fill="${p.getAttribute("fill")}" stroke="${blank ? "#8C8A91" : "#FFFFFF"}" stroke-width="${blank ? 0.8 : 0.6}"${blank ? ' stroke-dasharray="3 2"' : ""}/>`;
    }).join("");
    const chips = (regionMode ? regions : countries).map((e) => {
      const v = gsi.value(e.key, state.week).value;
      const [x, y] = regionMode ? project(e.label) : chipPoint(e);
      const text = `${e.name} ${fmtInt(v)}`; // downloads always name each chip
      const w = text.length * 6.4 + 14;
      return `<g transform="translate(${x},${y + top})"><rect x="${-w / 2}" y="-11" width="${w}" height="22" rx="11" fill="#FFFFFF" stroke="#BDB9C2"/><text text-anchor="middle" y="4" font-size="11" font-weight="700" fill="${ink(v)}">${xml(text)}</text></g>`;
    }).join("");
    const swatches = cfg.scale.map((s, i) => `<rect x="${120 + i * 28}" y="${legendY}" width="26" height="12" fill="${s.fill}"/>`).join("");
    const title = regionMode ? "Geopolitical Stability Index: regions" : "Geopolitical Stability Index: spotlight countries";
    const M = 24; // margin around the whole image
    const out = `<svg xmlns="http://www.w3.org/2000/svg" width="${W + 2 * M}" height="${totalH + M}" viewBox="${-M} ${-M} ${W + 2 * M} ${totalH + M}" font-family="Helvetica, Arial, sans-serif">
      <rect x="${-M}" y="${-M}" width="100%" height="100%" fill="#FFFFFF"/>
      <text x="0" y="30" font-size="24" font-family="Georgia, serif" font-weight="700" fill="#1B1725">${xml(title)}</text>
      <text x="0" y="54" font-size="14" fill="#3E3A46">${xml(weekLabel(state.week, { upper: false }))} · New Lines Institute, Geopolitical Forecasting and Analysis Unit</text>
      <g transform="translate(0,${top})">${shapes}</g>${chips}
      <text x="0" y="${legendY + 10}" font-size="12" fill="#3E3A46">Destabilizing</text>${swatches}
      <text x="${120 + cfg.scale.length * 28 + 6}" y="${legendY + 10}" font-size="12" fill="#3E3A46">Stabilizing</text>
      <text x="0" y="${legendY + 40}" font-size="11" fill="#5E5A66">GSI = average score of the week's incidents tied to each ${regionMode ? "region" : "country"}, −100 to +100. Map: Natural Earth.</text>
    </svg>`;
    const name = `gsi-map-${regionMode ? "regions" : "countries"}-${state.week}`;
    downloadSvgAsPng(out, W + 2 * M, totalH + M, `${slug(name)}.png`);
  };

  return { render };
}
