/**
 * problems.js: what the reader sees when one part of the page fails.
 *
 * reportProblem(spec, err)
 *   spec = { el, name, quiet } from main.js's COMPONENTS list
 *   - writes the full error to the browser console (for whoever debugs it),
 *   - puts a short notice in that part's box, and
 *   - shows one banner at the top of the page.
 *
 * The most common cause, right after an update, is a browser still holding
 * an older copy of some files (GitHub Pages lets browsers keep them for up
 * to 10 minutes). A hard reload fetches everything fresh, so that's what
 * the notices suggest.
 */
import { byId, esc } from "./dom.js";

const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const RELOAD = isMac ? "⌘ + Shift + R" : "Ctrl + Shift + R";
const reported = new Set();

export function reportProblem(spec, err) {
  console.error(`[GFP] "${spec.name}" could not ${err?.name === "SyntaxError" || err?.message?.includes("module") ? "load" : "draw"}:`, err);

  // A notice in the part's own box (once per part).
  const el = spec.quiet ? null : byId(spec.el); // dialogs have no box to put a notice in
  if (el && !reported.has(spec.el)) {
    reported.add(spec.el);
    el.innerHTML = `<div class="problem" role="alert">
      <b>${esc(spec.name)} couldn't load.</b>
      Reload the page with <kbd>${RELOAD}</kbd>. If it keeps happening, let the Geopolitical Forecasting and Analysis Unit know.
    </div>`;
  }

  // One banner for the whole page.
  const banner = byId("problemBanner");
  if (banner && banner.hidden) {
    banner.innerHTML = `Part of the platform didn't load, usually because your browser kept an older copy of the site after an update.
      <b>Reload with <kbd>${RELOAD}</kbd></b> to fix it. Everything else on the page still works.`;
    banner.hidden = false;
  }
}
