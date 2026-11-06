/**
 * worldMap.js: the shaded world map, its incident bubbles and zoom.
 *
 * COLOURS (the GSI is read from the colour alone)
 *   Country level: the 17 spotlight countries are shaded by their GSI for the
 *   selected week; a spotlight country with no incidents that week is white
 *   with a dashed outline. Other countries with incidents are light grey and
 *   clickable (they have no GSI).
 *   Regions & themes: each region's member countries are shaded by the
 *   region's GSI. The two global themes are cards above the map.
 *
 * BUBBLES (the number = incidents this week)
 *   Every country with incidents in the selected week gets a bubble with
 *   the count. For spotlight countries and regions the count is the
 *   incidents that make up the GSI; for other countries, the incidents
 *   located there. Zoomed in (config.mapZoom.detailFrom), bubbles also show
 *   the name and, where there is one, the GSI. The selected place always
 *   shows its name.
 *
 * ZOOM
 *   + / − / reset buttons, double-click, a pinch on touch screens, or
 *   Ctrl/⌘ + scroll (plain scrolling still scrolls the page). Drag to move
 *   when zoomed in. Zooming changes the SVG viewBox, so outlines stay sharp
 *   and borders stay thin (vector-effect in the CSS).
 *
 * The country outlines are drawn once; each render only updates colours,
 * classes and bubbles, so switching weeks is instant.
 *
 * Reads:  state.level, state.sel, state.week
 * Writes: sel, ev
 * DOM:    #mapPanel
 * Also provides ctx.exportMap(state): saves the whole map as a PNG.
 */
import { byId, esc, onAction } from "../../ui/dom.js";
import { fill, fmt, fmtInt, ink, tint, band, plural } from "../../ui/format.js";
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

  /* ------------------------------------------------ lookups (prepared once) */
  const countries = cfg.entities.filter((e) => e.level === "country");
  const regions = cfg.entities.filter((e) => e.level === "region");
  const themes = cfg.entities.filter((e) => e.level === "theme");
  const entityByMapName = new Map(countries.map((e) => [places.mapNameOf(e.place), e]));
  const regionByMapName = new Map();
  regions.forEach((r) => r.members.forEach((m) => regionByMapName.set(m, r)));
  const labelOf = new Map(world.countries.map((c) => [c.name, c.label]));

  /** Where a spotlight country's bubble goes (SVG units). config `chipAt` [lon, lat] overrides. */
  const chipPoint = (e) => (e.chipAt ? project(e.chipAt) : labelOf.get(places.mapNameOf(e.place)) || [0, 0]);
  /** Where any other place's bubble goes: its outline's label point, or its pin. */
  const placePoint = (p) => (p.mapName ? labelOf.get(p.mapName) : p.pin ? project(p.pin.at) : null);

  const placeCountUpTo = (name, week) => places.incidentsAt(name).filter((i) => i.week <= week).length;
  const placeCountIn = (name, week) => places.incidentsAt(name).filter((i) => i.week === week).length;

  /* ---------------------------------------------------------- skeleton */
  el.innerHTML = `
    <div class="themes" id="themeCards" hidden></div>
    <div class="map-box" id="mapBox" style="aspect-ratio:${W} / ${H}">
      <svg id="mapSvg" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="mapTitle">
        <title id="mapTitle">World map</title>
        <g id="mapShapes">${world.countries.map((c) => `<path d="${c.d}" data-name="${esc(c.name)}"></path>`).join("")}</g>
        <g id="mapPins"></g>
      </svg>
      <div class="bubbles" id="mapBubbles"></div>
      <div class="zoom" role="group" aria-label="Map zoom">
        <button data-action="zoom-in" aria-label="Zoom in">+</button>
        <button data-action="zoom-out" aria-label="Zoom out">−</button>
        <button data-action="zoom-reset" aria-label="Show the whole map" title="Show the whole map">⤢</button>
      </div>
    </div>
    <div class="map-note" id="mapNote"></div>`;
  const svg = byId("mapSvg");
  const box = byId("mapBox");
  const paths = [...svg.querySelectorAll("#mapShapes path")];

  /* ---------------------------------------------- what a shape means */
  /**
   * For one map country in the current state: what it represents and how to
   * draw it. Returns { target, fill, blank, tip } or null (inert land).
   *   target  the state.sel value a click selects
   */
  function shapeInfo(mapName, state) {
    if (state.level === "region") {
      const r = regionByMapName.get(mapName);
      if (!r) return null;
      const v = gsi.value(r.key, state.week);
      return { target: r.key, fill: fill(v.value), blank: v.value === null, tip: `<b>${esc(r.name)}</b> (${esc(mapName)})<br>GSI ${fmt(v.value)} · ${plural(v.n, "incident")} this week` };
    }
    const e = entityByMapName.get(mapName);
    if (e) {
      const v = gsi.value(e.key, state.week);
      return { target: e.key, fill: fill(v.value), blank: v.value === null, tip: `<b>${esc(e.name)}</b><br>GSI ${fmt(v.value)} · ${v.value === null ? "no incidents this week" : plural(v.n, "incident") + " this week"}` };
    }
    const p = places.atMapName(mapName);
    if (p && placeCountUpTo(p.name, state.week) > 0) {
      return { target: PLACE_PREFIX + p.name, fill: cfg.otherPlaceFill, blank: false, tip: placeTip(p.name, state) };
    }
    return null;
  }

  function placeTip(name, state) {
    const all = placeCountUpTo(name, state.week);
    const now = placeCountIn(name, state.week);
    return `<b>${esc(name)}</b> · no GSI<br>${now ? `${plural(now, "incident")} this week, ` : ""}${plural(all, "incident")} to date`;
  }

  /* ================================================================ ZOOM */
  // The visible part of the map, in SVG units. Zoom = W / view.w.
  const view = { x: 0, y: 0, w: W, h: H };
  const zoomLevel = () => W / view.w;
  let lastState = null;
  let detailShown = false;

  /** Keep the view inside the map. */
  function clampView() {
    view.w = Math.min(W, Math.max(W / cfg.mapZoom.max, view.w));
    view.h = (view.w * H) / W;
    view.x = Math.min(W - view.w, Math.max(0, view.x));
    view.y = Math.min(H - view.h, Math.max(0, view.y));
  }

  /** Zoom by `factor` (>1 = in) keeping the SVG point (cx, cy) under the same spot. */
  function zoomAt(factor, cx = view.x + view.w / 2, cy = view.y + view.h / 2) {
    const w = Math.min(W, Math.max(W / cfg.mapZoom.max, view.w / factor));
    const s = w / view.w;
    view.x = cx - (cx - view.x) * s;
    view.y = cy - (cy - view.y) * s;
    view.w = w;
    clampView();
    applyView();
  }

  /** Push the view to the SVG and the bubbles. */
  function applyView() {
    svg.setAttribute("viewBox", `${view.x} ${view.y} ${view.w} ${view.h}`);
    box.classList.toggle("zoomed", zoomLevel() > 1.01);
    // Crossing the detail threshold changes what bubbles say; otherwise just move them.
    const detail = zoomLevel() >= cfg.mapZoom.detailFrom;
    if (detail !== detailShown && lastState) drawBubbles(lastState);
    else positionBubbles();
  }

  /** A pointer position (client px) → SVG units in the current view. */
  function toSvg(clientX, clientY) {
    const r = svg.getBoundingClientRect();
    return [view.x + ((clientX - r.left) / r.width) * view.w, view.y + ((clientY - r.top) / r.height) * view.h];
  }

  // Buttons.
  onAction(el, {
    "zoom-in": () => zoomAt(2),
    "zoom-out": () => zoomAt(0.5),
    "zoom-reset": () => { Object.assign(view, { x: 0, y: 0, w: W, h: H }); applyView(); },
    pick: (b) => select(b.dataset.target)
  });

  // Ctrl/⌘ + scroll (and trackpad pinch, which browsers report the same way).
  svg.addEventListener("wheel", (ev) => {
    if (!ev.ctrlKey && !ev.metaKey) return; // plain scroll scrolls the page
    ev.preventDefault();
    const [cx, cy] = toSvg(ev.clientX, ev.clientY);
    zoomAt(Math.exp(-ev.deltaY * 0.01), cx, cy);
  }, { passive: false });

  // Double-click zooms in on that spot.
  svg.addEventListener("dblclick", (ev) => {
    ev.preventDefault();
    const [cx, cy] = toSvg(ev.clientX, ev.clientY);
    zoomAt(2, cx, cy);
  });

  // Drag to pan; two fingers to pinch. A drag of more than a few pixels is
  // not a click, so it won't select the country under the pointer.
  const pointers = new Map();
  let dragged = false;
  let pinchStart = null;
  svg.addEventListener("pointerdown", (ev) => {
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY, startX: ev.clientX, startY: ev.clientY });
    dragged = false;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchStart = { dist: Math.hypot(a.x - b.x, a.y - b.y), w: view.w };
    }
  });
  svg.addEventListener("pointermove", (ev) => {
    const p = pointers.get(ev.pointerId);
    if (!p) return hover(ev);
    const r = svg.getBoundingClientRect();
    if (pointers.size === 2 && pinchStart) {
      p.x = ev.clientX; p.y = ev.clientY;
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const [cx, cy] = toSvg((a.x + b.x) / 2, (a.y + b.y) / 2);
      zoomAt((pinchStart.w / view.w) * (dist / pinchStart.dist), cx, cy);
      dragged = true;
      return;
    }
    if (!dragged && Math.hypot(ev.clientX - p.startX, ev.clientY - p.startY) < 5) return;
    if (zoomLevel() <= 1.01) return; // nothing to pan at full view
    if (!dragged) { dragged = true; svg.setPointerCapture(ev.pointerId); hideTip(); }
    view.x -= ((ev.clientX - p.x) / r.width) * view.w;
    view.y -= ((ev.clientY - p.y) / r.height) * view.h;
    p.x = ev.clientX; p.y = ev.clientY;
    clampView();
    applyView();
  });
  const release = (ev) => { pointers.delete(ev.pointerId); if (pointers.size < 2) pinchStart = null; };
  svg.addEventListener("pointerup", release);
  svg.addEventListener("pointercancel", release);

  /* ======================================================= SELECTING */
  const select = (target) => { if (target) store.set({ sel: target, ev: null }); };

  svg.addEventListener("click", (ev) => {
    if (dragged) { dragged = false; return; } // that was a drag, not a click
    const pin = ev.target.closest("[data-pin]");
    if (pin) return select(PLACE_PREFIX + pin.dataset.pin);
    const path = ev.target.closest("path[data-name]");
    if (path) select(shapeInfo(path.dataset.name, store.get())?.target);
  });

  function hover(ev) {
    const pin = ev.target.closest("[data-pin]");
    if (pin) return showTip(placeTip(pin.dataset.pin, store.get()), ev);
    const path = ev.target.closest("path[data-name]");
    const info = path && shapeInfo(path.dataset.name, store.get());
    if (info) showTip(info.tip, ev); else hideTip();
  }
  svg.addEventListener("pointerleave", hideTip);

  /* ========================================================= BUBBLES */
  let bubbles = []; // [{ target, x, y, html, style, cls, aria }] for the current state

  /**
   * Work out every bubble for a state. Each is one <button> in #mapBubbles.
   *   far:  the incident count (and the name, for the selection and regions)
   *   near: name · count · GSI
   */
  function bubbleList(state) {
    const near = zoomLevel() >= cfg.mapZoom.detailFrom;
    const out = [];
    const gsiBadge = (v) => `<span class="bv" style="background:${tint(v)};color:${ink(v)}">${fmt(v)}</span>`;
    const label = (name, n, v, withGsi) =>
      `<span class="bn">${esc(name)}</span>${n ? `<span class="bc">${n}</span>` : `<span class="bz">no incidents</span>`}${withGsi && v !== null ? gsiBadge(v) : ""}`;

    if (state.level === "region") {
      for (const r of regions) {
        const { value: v, n } = gsi.value(r.key, state.week);
        const [x, y] = project(r.label);
        out.push({ target: r.key, x, y, cls: "named", html: label(r.name, n, v, near), aria: `${r.name}: ${plural(n, "incident")} this week, GSI ${fmt(v)}` });
      }
      return out;
    }

    // Spotlight countries.
    for (const e of countries) {
      const { value: v, n } = gsi.value(e.key, state.week);
      const on = e.key === state.sel;
      if (!n && !near && !on) continue; // nothing this week: the dashed outline says so
      const [x, y] = chipPoint(e);
      out.push({
        target: e.key, x, y, cls: near || on ? "named" : "",
        html: near || on ? label(e.name, n, v, near) : `<span class="bc">${n}</span>`,
        aria: `${e.name}: ${plural(n, "incident")} this week, GSI ${fmt(v)}`
      });
    }

    // Every other place with incidents this week.
    for (const p of places.list) {
      if (p.entity) continue;
      const n = placeCountIn(p.name, state.week);
      const on = PLACE_PREFIX + p.name === state.sel;
      if (!n && !on) continue;
      const pt = placePoint(p);
      if (!pt) continue;
      out.push({
        target: PLACE_PREFIX + p.name, x: pt[0], y: pt[1], cls: "other" + (near || on ? " named" : ""),
        html: near || on ? label(p.name, n, null, false) : `<span class="bc">${n}</span>`,
        aria: `${p.name}: ${plural(n, "incident")} this week, no GSI`
      });
    }
    return out;
  }

  function drawBubbles(state) {
    detailShown = zoomLevel() >= cfg.mapZoom.detailFrom;
    bubbles = bubbleList(state);
    byId("mapBubbles").innerHTML = bubbles.map((b, i) =>
      `<button class="bubble ${b.cls}" data-action="pick" data-target="${esc(b.target)}" data-i="${i}"
        aria-pressed="${b.target === state.sel}" aria-label="${esc(b.aria)}">${b.html}</button>`).join("");
    positionBubbles();
  }

  /** Place bubbles for the current zoom; hide those outside the view. */
  function positionBubbles() {
    byId("mapBubbles").querySelectorAll(".bubble").forEach((el) => {
      const b = bubbles[Number(el.dataset.i)];
      const px = (b.x - view.x) / view.w;
      const py = (b.y - view.y) / view.h;
      el.hidden = px < -0.02 || px > 1.02 || py < -0.02 || py > 1.02;
      el.style.left = `${px * 100}%`;
      el.style.top = `${py * 100}%`;
    });
  }

  /* =========================================================== RENDER */
  function render(state) {
    lastState = state;
    const regionMode = state.level === "region";
    box.classList.toggle("regions", regionMode);
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

    // 2. Small dots for outline-less places (EU, Caribbean, Singapore) with
    //    incidents to date, so they can be clicked even in a quiet week.
    byId("mapPins").innerHTML = regionMode ? "" : Object.entries(cfg.placePins)
      .filter(([name]) => placeCountUpTo(name, state.week) > 0)
      .map(([name, pin]) => {
        const [x, y] = project(pin.at);
        return `<circle data-pin="${esc(name)}" class="pin" cx="${x}" cy="${y}" r="3.5" fill="#8C8A91" stroke="#FFFFFF" stroke-width="1.2"></circle>`;
      }).join("");

    // 3. Bubbles.
    drawBubbles(state);

    // 4. Theme cards (regions & themes level only).
    const tc = byId("themeCards");
    tc.hidden = !regionMode;
    if (regionMode) {
      tc.innerHTML = `<span class="lbl">GLOBAL THEMES</span>` + themes.map((e) => {
        const v = gsi.value(e.key, state.week);
        return `<button class="theme-card" data-action="pick" data-target="${e.key}" aria-pressed="${e.key === state.sel}" style="border-left-color:${v.value === null ? "#DCDAD3" : fill(v.value)}">
          <span><span class="nm">${esc(e.name)}</span><br><span class="sub">${esc(band(v.value))} · ${plural(v.n, "incident")}</span></span>
          <span class="badge lg" style="background:${v.value === null ? "#F1F0EC" : "#FFFFFF"};color:${ink(v.value)}">${fmt(v.value)}</span></button>`;
      }).join("");
    }

    // 5. Caption.
    byId("mapNote").innerHTML = (regionMode
      ? "Each region is shaded by its GSI for the week: the average score of the incidents our analysts tied to it. NATO covers all of Europe plus Ukraine, Belarus and Russia; the US and Canada are drawn under US/Americas."
      : "Colour = the spotlight country's GSI for the week. Bubbles = incidents this week. Grey countries have incidents on record but no GSI; select one to read them.") +
      ` <b style="font-weight:500">Zoom</b> with + and −, a double-click, a pinch, or Ctrl/⌘ + scroll; drag to move. Zoomed in, bubbles show names and GSI.`;
  }

  /* =========================================================== EXPORT */
  /** Build a self-contained SVG of the whole map (title, labels, key) and save it as a PNG. */
  ctx.exportMap = (state) => {
    const regionMode = state.level === "region";
    const top = 70;
    const legendY = top + H + 30;
    const totalH = legendY + 60;
    const shapes = paths.map((p) => {
      const blank = p.classList.contains("blank");
      return `<path d="${p.getAttribute("d")}" fill="${p.getAttribute("fill")}" stroke="${blank ? "#8C8A91" : "#FFFFFF"}" stroke-width="${blank ? 0.8 : 0.6}"${blank ? ' stroke-dasharray="3 2"' : ""}/>`;
    }).join("");
    const labels = (regionMode ? regions : countries).map((e) => {
      const { value: v, n } = gsi.value(e.key, state.week);
      const [x, y] = regionMode ? project(e.label) : chipPoint(e);
      const text = `${e.name} ${fmtInt(v)}${n ? ` (${n})` : ""}`;
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
      <g transform="translate(0,${top})">${shapes}</g>${labels}
      <text x="0" y="${legendY + 10}" font-size="12" fill="#3E3A46">Destabilizing</text>${swatches}
      <text x="${120 + cfg.scale.length * 28 + 6}" y="${legendY + 10}" font-size="12" fill="#3E3A46">Stabilizing</text>
      <text x="${W}" y="${legendY + 10}" font-size="12" fill="#3E3A46" text-anchor="end">${xml(cfg.copyright)}</text>
      <text x="0" y="${legendY + 40}" font-size="11" fill="#5E5A66">GSI = average score of the week's incidents tied to each ${regionMode ? "region" : "country"}, −100 to +100; (n) = incidents this week. Map: Natural Earth.</text>
    </svg>`;
    const name = `gsi-map-${regionMode ? "regions" : "countries"}-${state.week}`;
    downloadSvgAsPng(out, W + 2 * M, totalH + M, `${slug(name)}.png`);
  };

  return { render };
}
