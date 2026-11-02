/**
 * cite.js: the "Cite this page" / "Cite this event" dialog.
 *
 * Opens when state.cite is "page" or "event"; closes on ×, Escape or a click
 * outside. Each citation has a Copy button. Formats: Chicago, APA, MLA, as in
 * the mockup. The access date is today's date; the link is a share link to
 * the exact view (see state.js), or config.publicUrl once that is set.
 *
 * Reads:  state.cite, state.tab, state.sel, state.week, state.ev
 * Writes: cite (null to close)
 * DOM:    #dialogRoot
 */
import { byId, esc, onAction } from "../ui/dom.js";
import { describe } from "../model/selection.js";
import { shareUrl } from "../state.js";
import { weekLabel, toDate, MONTHS } from "../model/weeks.js";
import { copyText } from "./share.js";

const SHORTM = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];

/** The three formats for one item. `date` is "YYYY-MM-DD" (publication date). */
function formats(cfg, title, container, date, url) {
  const { author, publisher } = cfg.citation;
  const d = toDate(date);
  const now = new Date();
  const longPub = `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
  const accessed = `${MONTHS[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
  const accessedMla = `${now.getDate()} ${SHORTM[now.getMonth()]} ${now.getFullYear()}`;
  const inContainer = container ? `${container}, ` : "";
  return [
    ["CHICAGO", `${author}. "${title}." ${inContainer}${publisher}, ${longPub}. Accessed ${accessed}. ${url}.`],
    ["APA", `${author}. (${d.getUTCFullYear()}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}). ${title}. ${container ? container + ". " : ""}${publisher}. ${url}`],
    ["MLA", `${author}. "${title}." ${inContainer}${publisher}, ${d.getUTCDate()} ${SHORTM[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${url.replace(/^https?:\/\//, "")}. Accessed ${accessedMla}.`]
  ];
}

export function createCiteDialog(ctx) {
  const { cfg, store } = ctx;
  const root = byId("dialogRoot");
  let items = [];
  let lastFocus = null;

  const close = () => store.set({ cite: null });

  onAction(root, {
    close,
    backdrop: (el, ev) => { if (ev.target === el) close(); },
    copy: async (el) => {
      const ok = await copyText(items[Number(el.dataset.i)][1]);
      el.textContent = ok ? "Copied" : "Copy failed";
    }
  });
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && store.get().cite) close(); });

  /** Work out heading + citations for the current state. */
  function build(state) {
    const base = cfg.publicUrl || undefined;
    if (state.cite === "event") {
      const inc = ctx.byId.get(state.ev) || null;
      if (!inc) return null;
      return {
        heading: "Cite this event",
        items: formats(cfg, inc.title, cfg.citation.platform, inc.date, shareUrl({ ...state, ev: inc.id }, base))
      };
    }
    const week = weekLabel(state.week, { upper: false, prefix: "Week of " });
    const title = state.tab === "overview"
      ? `Weekly Global Forecast Overview, ${week}`
      : `${describe(ctx, state).name}: Geopolitical Stability Index, ${week}`;
    return { heading: "Cite this page", items: formats(cfg, title, "", state.week, shareUrl({ ...state, ev: null }, base)) };
  }

  let openKey = "";

  function render(state) {
    if (!state.cite) {
      if (root.innerHTML) { root.innerHTML = ""; openKey = ""; lastFocus?.focus(); }
      return;
    }
    // Already showing this exact dialog: leave it alone (keeps focus and "Copied" labels).
    const key = [state.cite, state.tab, state.sel, state.week, state.ev].join("|");
    if (key === openKey) return;
    const built = build(state);
    if (!built) { root.innerHTML = ""; return; }
    items = built.items;
    if (!openKey) lastFocus = document.activeElement;
    openKey = key;
    root.innerHTML = `
      <div class="overlay" data-action="backdrop">
        <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="cite-title">
          <button class="x" data-action="close" aria-label="Close">×</button>
          <div style="display:flex;flex-direction:column;gap:6px;padding-right:40px">
            <span class="eyebrow gold" style="letter-spacing:1px">CITE</span>
            <h2 id="cite-title">${esc(built.heading)}</h2>
          </div>
          ${items.map(([style, text], i) => `
            <div class="cite-item">
              <div class="top"><span class="eyebrow">${style}</span>
                <button class="btn" data-action="copy" data-i="${i}" style="min-height:34px">Copy</button></div>
              <p>${esc(text)}</p>
            </div>`).join("")}
          <span style="font-size:12.5px;line-height:1.5;color:var(--muted)">Citations include today's date as the access date. Check them against your style guide before publishing.</span>
        </div>
      </div>`;
    root.querySelector(".x").focus();
  }

  return { render };
}
