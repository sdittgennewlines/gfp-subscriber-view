#!/usr/bin/env node
/**
 * stamp.mjs: stops browsers from mixing old and new copies of the site's
 * files after an update. Run it before pushing any change to the code or CSS:
 *
 *   node tools/stamp.mjs
 *
 * WHY
 *   Web hosts let browsers keep files for a while (GitHub Pages: 10 minutes).
 *   Right after an update a browser can end up with some new files and some
 *   old ones, which don't fit together. This gives every file an address
 *   that includes a fingerprint of its contents (e.g. js/ui/dom.js?v=3f9a1c2e):
 *   when a file changes, its address changes, so the browser must fetch the
 *   new one; unchanged files keep their address and stay cached.
 *
 * WHAT IT CHANGES (in index.html only)
 *   - the stylesheet link:      css/styles.css?v=<fingerprint>
 *   - the entry script:         js/main.js?v=<fingerprint>
 *   - an "import map" between the <!-- stamp:start --> / <!-- stamp:end -->
 *     markers, listing every other module with its fingerprint. Browsers use
 *     it to fetch the right version of every file a script imports.
 *
 * Forgetting to run it doesn't break anything: the site just goes back to
 * relying on the browser's cache timing, and the safety nets in main.js still
 * keep a stale file from blanking the page.
 */
import { readFile, writeFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Every file under `dir` (relative to the project), recursively. */
async function walk(dir) {
  const out = [];
  for (const e of await readdir(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(rel)));
    else out.push(rel);
  }
  return out;
}

const fingerprint = async (rel) => createHash("sha1").update(await readFile(path.join(ROOT, rel))).digest("hex").slice(0, 10);

async function main() {
  const modules = ["config.js", ...(await walk("js")).filter((f) => f.endsWith(".js"))].sort();
  const imports = {};
  for (const f of modules) if (f !== "js/main.js") imports[`./${f}`] = `./${f}?v=${await fingerprint(f)}`;

  const map = `<!-- stamp:start: written by tools/stamp.mjs; don't edit by hand -->
<script type="importmap">
${JSON.stringify({ imports }, null, 2)}
</script>
<!-- stamp:end -->`;

  const file = path.join(ROOT, "index.html");
  let html = await readFile(file, "utf8");
  if (!html.includes("<!-- stamp:start")) throw new Error("index.html has no <!-- stamp:start --> marker");
  html = html
    .replace(/<!-- stamp:start[\s\S]*?<!-- stamp:end -->/, map)
    .replace(/href="css\/styles\.css(\?v=[^"]*)?"/, `href="css/styles.css?v=${await fingerprint("css/styles.css")}"`)
    .replace(/src="js\/main\.js(\?v=[^"]*)?"/, `src="js/main.js?v=${await fingerprint("js/main.js")}"`);
  await writeFile(file, html);
  console.log(`Stamped ${modules.length} scripts and the stylesheet in index.html.`);
}

main().catch((err) => { console.error(err.message); process.exit(1); });
