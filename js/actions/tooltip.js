/**
 * tooltip.js: one floating tooltip shared by the map and charts.
 *
 *   showTip(html, mouseEvent)   show/move it next to the pointer
 *   hideTip()
 *
 * Pass only escaped HTML (see ui/dom.js esc).
 */
import { byId } from "../ui/dom.js";

export function showTip(html, ev) {
  const tip = byId("tip");
  tip.innerHTML = html;
  tip.hidden = false;
  // Keep it on screen: flip to the left/top near the edges.
  const pad = 14;
  const { innerWidth: W, innerHeight: H } = window;
  const r = tip.getBoundingClientRect();
  let x = ev.clientX + pad;
  let y = ev.clientY + pad;
  if (x + r.width > W - 8) x = ev.clientX - r.width - pad;
  if (y + r.height > H - 8) y = ev.clientY - r.height - pad;
  tip.style.left = `${x}px`;
  tip.style.top = `${y}px`;
}

export function hideTip() {
  byId("tip").hidden = true;
}
