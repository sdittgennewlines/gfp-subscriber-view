/**
 * share.js: the Share buttons.
 *
 * The link always opens the same view (tab, selection, week, incident),
 * because those live in the address bar (see state.js).
 * On phones and tablets that offer it, the system share sheet opens;
 * everywhere else the link is copied to the clipboard.
 */
import { shareUrl } from "../state.js";
import { toast } from "./toast.js";

export async function share(state, cfg, title) {
  const url = shareUrl(state, cfg.publicUrl || undefined);
  const touch = window.matchMedia?.("(pointer: coarse)").matches;
  if (touch && navigator.share) {
    try { await navigator.share({ title, url }); return; } catch { /* cancelled: fall through to copy */ }
  }
  const ok = await copyText(url);
  toast(ok ? "Link copied" : "Couldn't copy automatically. Copy the address from your browser's address bar.");
}

/** Copy text to the clipboard, with a fallback for older browsers / iframes. */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { /* ignore */ }
    ta.remove();
    return ok;
  }
}
