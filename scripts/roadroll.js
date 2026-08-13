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

const scriptTagMatch = html.match(/<script[^>]*src="\.?\/?([^"]+\.js)"[^>]*><\/script>/);
if (!scriptTagMatch) {
  console.error("No script tag with src found in dist/index.html");
  process.exit(1);
}

const jsFile = join(distDir, scriptTagMatch[1]);
const js = readFileSync(jsFile, "utf8");

const packer = new Packer([{ data: js, type: "js", action: "eval" }], {});
await packer.optimize();
const { firstLine, secondLine } = packer.makeDecoder();

// The module script tag sits in <head> and is deferred; the inlined classic
// script is not, so it must move to the end of <body> to find the DOM.
html = html.replace(scriptTagMatch[0], "");
html = html.replace("</body>", `<script>${firstLine}\n${secondLine}</script></body>`);
writeFileSync(htmlFile, html);
rmSync(jsFile);

console.log(`roadroller: ${js.length} B js -> ${statSync(htmlFile).size} B inlined html`);
