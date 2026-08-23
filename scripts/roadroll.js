// Optional extra crunch step for the js13k build: packs the bundled JS with
// Roadroller and inlines it into index.html. Often saves 1-2 kB, but the
// output is eval-based — ALWAYS test the resulting dist in a browser.
// Usage: npm run build-js13k-roadroller
import { readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Packer } from "roadroller";

const rootDir = resolve(fileURLToPath(import.meta.url), "../..");
const distDir = resolve(rootDir, "dist");
const htmlFile = join(distDir, "index.html");

let html = readFileSync(htmlFile, "utf8");

// The js13k build inlines the bundle into index.html (one zip entry — see vite.config.ts),
// so the script is normally already in the page; the external form is still handled for a
// build that skipped that step, or that hit the `</script` guard and kept its separate file.
const externalMatch = html.match(/<script[^>]*src="\.?\/?([^"]+\.js)"[^>]*><\/script>/);
const inlineMatch = html.match(/<script type="module">([\s\S]*?)<\/script>/);

if (!externalMatch && !inlineMatch) {
  console.error("No module script found in dist/index.html");
  process.exit(1);
}

const jsFile = externalMatch && join(distDir, externalMatch[1]);
const js = externalMatch ? readFileSync(jsFile, "utf8") : inlineMatch[1];
const scriptTag = (externalMatch ?? inlineMatch)[0];

const packer = new Packer([{ data: js, type: "js", action: "eval" }], {});
await packer.optimize();
const { firstLine, secondLine } = packer.makeDecoder();

// The module script tag sits in <head> and is deferred; the inlined classic
// script is not, so it must move to the end of <body> to find the DOM.
// Both replacements take a *function*: `$&`, `$\'`, "$`" and `$1` in a replacement string are
// substitution patterns, and the packed payload is arbitrary text. It happens to carry no `$`
// today, which is luck rather than a guarantee.
html = html.replace(scriptTag, () => "");
html = html.replace("</body>", () => `<script>${firstLine}\n${secondLine}</script></body>`);
writeFileSync(htmlFile, html);
if (jsFile) rmSync(jsFile);

console.log(`roadroller: ${js.length} B js -> ${statSync(htmlFile).size} B inlined html`);
