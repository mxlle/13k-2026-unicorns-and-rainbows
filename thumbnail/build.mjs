/**
 * Captures the js13k submission artwork out of thumbnail/art.html.
 *
 *   npm run images            both
 *   npm run images -- thumb   just the thumbnail
 *   npm run images -- cover   just the cover
 *
 * Neither file is part of the zip. They are the two images the js13k submission form asks for,
 * and they have their own limits (see TARGETS below), which this script checks rather than
 * trusts. Everything about how they *look* is in art.html; this file only shoots and squeezes.
 *
 * Why a headless browser instead of screenshotting the game: the art is emoji on a CSS gradient,
 * which is exactly what a browser is for, and doing it this way means re-cutting both images
 * after a visual change is one command rather than a session of temporarily breaking the
 * stylesheet to get a clean shot.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync, copyFileSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");

const TARGETS = {
  thumb: { w: 320, h: 320, limit: 64 * 1024, out: "thumbnail-320.png" },
  cover: { w: 800, h: 500, limit: 256 * 1024, out: "cover-800x500.png" },
};

/* -------------------------------------------------------------------------- *
 * The ladder's numbers, read out of the game rather than kept in step by hand.
 *
 * These are scraped with regexes rather than imported, because the launch screen is a TS
 * module in a vite app and standing one up here to read six numbers is not worth it. The
 * cost of that choice is that renaming a constant breaks this — which is why every lookup
 * throws by name instead of falling back to a default. If one of these fires, the constant
 * moved: point the regex at wherever it went.
 * -------------------------------------------------------------------------- */
function scrapeLadder() {
  const ts = readFileSync(join(ROOT, "src/components/launch-screen/launch-screen.component.ts"), "utf8");
  const scss = readFileSync(join(ROOT, "src/components/launch-screen/launch-screen.module.scss"), "utf8");
  const map = readFileSync(join(ROOT, "src/game/game-map.ts"), "utf8");

  const num = (src, re, what) => {
    const m = src.match(re);
    if (!m) throw new Error(`Could not find ${what} — it has been renamed or moved. Fix the regex in thumbnail/build.mjs.`);
    return Number(m[1]);
  };

  const sizes = map.match(/MAP_SIZES\s*=\s*\[([^\]]+)\]/);
  if (!sizes) throw new Error("Could not find MAP_SIZES in src/game/game-map.ts.");

  return {
    rungs: sizes[1].split(",").filter((s) => s.trim()).length,
    violetHue: num(ts, /const VIOLET_HUE = ([\d.]+)/, "VIOLET_HUE"),
    warmBias: num(ts, /const WARM_BIAS = ([\d.]+)/, "WARM_BIAS"),
    step: num(ts, /const NEIGHBOUR_HUE_STEP = ([\d.]+)/, "NEIGHBOUR_HUE_STEP"),
    satWarm: num(ts, /const SATURATION_WARM = ([\d.]+)/, "SATURATION_WARM"),
    satCool: num(ts, /const SATURATION_COOL = ([\d.]+)/, "SATURATION_COOL"),
    lightness: num(scss, /\$stripe-lightness:\s*([\d.]+)%/, "$stripe-lightness"),
    drop: num(scss, /\$stripe-lightness-drop:\s*([\d.]+)%/, "$stripe-lightness-drop"),
  };
}

/* -------------------------------------------------------------------------- */

function findChrome() {
  const candidates = [
    process.env.CHROME,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  const found = candidates.find((c) => existsSync(c));
  if (!found) throw new Error("No Chrome found. Set CHROME=/path/to/chrome and re-run.");
  return found;
}

function ect() {
  // the same binary package.js uses to recompress the zip
  const dir = join(ROOT, "node_modules/ect-bin/vendor");
  for (const p of [join(dir, process.platform === "darwin" ? "macos/ect" : "linux/ect"), join(dir, "ect")]) {
    if (existsSync(p)) return p;
  }
  return null;
}

const kb = (n) => `${(n / 1024).toFixed(1)} kB`;

function build(name) {
  const t = TARGETS[name];
  const chrome = findChrome();
  const src = join(HERE, "art.html");
  const shot = join(HERE, `.${name}-raw.png`);
  const out = join(ROOT, t.out);

  // The ladder's numbers are injected as a query parameter so art.html stays a plain file that
  // still opens correctly by hand — no build step between editing it and looking at it.
  const ladder = encodeURIComponent(JSON.stringify(scrapeLadder()));
  const url = `file://${src}?target=${name}&ladder=${ladder}`;

  // Shot at 2x and scaled down: emoji edges come out visibly cleaner than capturing at 1x.
  const scale = process.platform === "darwin" ? 2 : 1;
  execFileSync(
    chrome,
    [
      "--headless",
      "--disable-gpu",
      "--hide-scrollbars",
      "--virtual-time-budget=8000",
      `--force-device-scale-factor=${scale}`,
      `--window-size=${t.w},${t.h}`,
      `--screenshot=${shot}`,
      url,
    ],
    { stdio: "ignore" },
  );

  if (!existsSync(shot)) throw new Error(`Chrome produced no screenshot for ${name}.`);
  if (scale !== 1) execFileSync("sips", ["-z", String(t.h), String(t.w), shot], { stdio: "ignore" });

  copyFileSync(shot, out);
  unlinkSync(shot);

  const raw = statSync(out).size;
  const e = ect();
  if (e) execFileSync(e, ["-9", "--strict", out], { stdio: "ignore" });
  const size = statSync(out).size;

  const pct = ((size / t.limit) * 100).toFixed(0);
  const verdict = size <= t.limit ? "OK" : "OVER THE LIMIT";
  console.log(
    `${name.padEnd(6)} ${t.w}x${t.h}  ${kb(raw).padStart(8)} -> ${kb(size).padStart(8)}` +
      `  (${pct}% of ${kb(t.limit)})  ${verdict}   ${t.out}`,
  );
  if (size > t.limit) {
    console.log(
      "        Over budget. In order of preference: keep FLAT_RUNGS on in art.html (a smooth\n" +
        "        gradient is what makes these files big), drop the emoji count, or quantise —\n" +
        "        quantising is what banded the gradients the first time round, so it is a last resort.",
    );
    process.exitCode = 1;
  }
}

const wanted = process.argv.slice(2).filter((a) => a in TARGETS);
for (const name of wanted.length ? wanted : Object.keys(TARGETS)) build(name);
