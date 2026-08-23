// Folds the stylesheet and the bundle into index.html, so the js13k build is one file and
// therefore one zip entry. Run between `vite build -m js13k` and `scripts/package.js`.
//
// A zip does not compress the archive — it compresses each entry separately. Three files cost
// three local headers, three central-directory records and three filenames (~96 bytes apiece),
// and none of them share a compression dictionary. Folding them into one was measured at 263
// bytes, for no change to a single line of game code.
//
// js13k only, which is why this is a step in that npm script rather than a vite plugin: the
// other builds keep separate files, because those are what a browser's dev tools can show you.
// Running after vite also means what gets inlined is the final, minified, transformed text.
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const distDir = resolve(fileURLToPath(import.meta.url), "../../dist");
const htmlFile = join(distDir, "index.html");
const inlined = [];

let html = readFileSync(htmlFile, "utf8");

// Every replacement below takes a *function*. A replacement string would read `$&`, `$'`,
// "$`" and `$1` in the payload as substitution patterns — and terser mangles identifiers to
// `$`, so a bundle is full of them. The corruption is silent until the browser fails to parse
// what it was handed, with a `SyntaxError` pointing at a line you never wrote.
html = html.replace(/<link[^>]+rel="stylesheet"[^>]*>/g, (tag) => {
  const href = tag.match(/href="\.?\/?([^"]+)"/)?.[1];
  if (!href) return tag;
  inlined.push(href);

  return `<style>${readFileSync(join(distDir, href), "utf8")}</style>`;
});

html = html.replace(/<script type="module"[^>]*src="\.?\/?([^"]+)"[^>]*><\/script>/g, (tag, src) => {
  const js = readFileSync(join(distDir, src), "utf8");
  // `</script` anywhere in the code would close the tag early. No string in the game has one,
  // and this is what says so out loud on the day one does: the build keeps its separate file
  // rather than shipping an HTML page that stops halfway through the game.
  if (js.includes("</script")) {
    console.warn(`inline: ${src} contains "</script" — left as a separate file`);
    return tag;
  }
  inlined.push(src);

  return `<script type="module">${js}</script>`;
});

writeFileSync(htmlFile, html);
inlined.forEach((file) => rmSync(join(distDir, file)));

console.log(`inline: ${inlined.join(", ")} -> index.html (${inlined.length + 1} zip entries -> 1)`);
