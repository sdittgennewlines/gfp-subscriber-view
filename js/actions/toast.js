/**
 * toast.js: a short message at the bottom of the screen ("Link copied").
 * Also announced to screen readers (the element is role="status").
 */
import { byId } from "../ui/dom.js";

let timer = null;

export function toast(message) {
  const el = byId("toast");
  el.textContent = message;
  el.hidden = false;
  clearTimeout(timer);
  timer = setTimeout(() => { el.hidden = true; }, 2600);
}
