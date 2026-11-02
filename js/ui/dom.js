/**
 * dom.js: tiny DOM helpers shared by all components.
 */

/** Escape text for safe use inside HTML (every sheet value goes through this). */
export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** document.getElementById shorthand. */
export const byId = (id) => document.getElementById(id);

/**
 * One click handler for a whole container: calls handlers[action](element, event)
 * for the nearest ancestor of the click with data-action="...".
 * Lets components re-render their innerHTML freely without re-binding.
 */
export function onAction(container, handlers, eventName = "click") {
  container.addEventListener(eventName, (ev) => {
    const el = ev.target.closest("[data-action]");
    if (!el || !container.contains(el)) return;
    const fn = handlers[el.dataset.action];
    if (fn) fn(el, ev);
  });
}

/** Only links that are real web addresses (or in-page placeholders) are rendered as links. */
export const safeUrl = (u) => (/^(https?:\/\/|#)/i.test(u || "") ? u : "#");
