#!/usr/bin/env node
// Render a SoundBox song module to a WAV file using the project's own player,
// so what you hear is exactly what ships. Reports duration, peak level, loop-seam
// stats, and an estimated zipped byte cost of the song data.
//   peak 0%   → song data is wrong (silence)
//   peak ~100% → clipping
//
// Usage:
//   node scripts/render-song.mjs <song-file.(ts|js|mjs)> [exportName] [--simple] [--loop=N] [--out=file.wav]
//
//   exportName  which export to render (default: "song", or the only export)
//   --simple    render with the trimmed small-player-simple.ts (sine only) instead
//               of the full small-player.ts — use to preview the trimmed pipeline
//   --loop=N    write the song N times back-to-back, to listen to the loop seam
//   --out=      output path (default: out/<file>[-<export>].wav)
//
// Preview: afplay out/<name>.wav (macOS), aplay/paplay (Linux),
//          Start-Process out/<name>.wav (Windows PowerShell)
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

const rootDir = resolve(fileURLToPath(import.meta.url), "../..");

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const flags = process.argv.slice(2).filter((a) => a.startsWith("--"));
const [songFile, exportName] = args;

if (!songFile) {
  console.error("usage: node scripts/render-song.mjs <song-file> [exportName] [--simple] [--loop=N] [--out=file.wav]");
  process.exit(1);
}

// The song sources are type-annotation-free JS in .ts files, so copying them to .mjs makes
// them importable by Node's ESM loader as they stand. The two players are very nearly that:
// they are `@ts-nocheck` vendored JS, but each carries exactly two type-only bits that Node
// cannot parse — an `import type` line and the annotation on the exported class. Both are
// erasable by hand, which is what this does; a real TS toolchain in a script whose whole
// point is to run with nothing installed would cost more than it is worth.
// If a third kind of annotation ever appears in a player, it belongs in this list.
const tmp = mkdtempSync(join(tmpdir(), "soundbox-"));
async function importAsMjs(file) {
  const target = join(tmp, basename(file).replace(/\.\w+$/, "") + ".mjs");
  const source = readFileSync(file, "utf8")
    .replace(/^import type .*$/gm, "")
    .replace(/^(export var \w+)\s*:\s*[\w.]+/gm, "$1");
  writeFileSync(target, source);
  return import(pathToFileURL(target).href);
}

const useSimple = flags.includes("--simple");
const playerModule = await importAsMjs(join(rootDir, "src/audio", useSimple ? "small-player-simple.ts" : "small-player.ts"));
const Player = useSimple ? playerModule.CPlayerSimple : playerModule.CPlayer;

const songModule = await importAsMjs(resolve(songFile));
const exports = Object.keys(songModule);
const name = exportName ?? (exports.includes("song") ? "song" : exports.length === 1 ? exports[0] : null);
if (!name || !songModule[name]) {
  console.error(`export not found — available exports: ${exports.join(", ")}`);
  process.exit(1);
}
const song = songModule[name];

const player = new Player();
player.init(song);
while (player.generate() < 1);
const wave = player.createWave();

const loopFlag = flags.find((f) => f.startsWith("--loop="));
const loops = loopFlag ? Math.max(1, parseInt(loopFlag.slice(7))) : 1;
let out_wave = wave;
if (loops > 1) {
  // WAV header is 44 bytes; repeat the sample data and patch the size fields
  const data = wave.subarray(44);
  out_wave = new Uint8Array(44 + data.length * loops);
  out_wave.set(wave.subarray(0, 44));
  for (let i = 0; i < loops; i++) out_wave.set(data, 44 + i * data.length);
  const dv = new DataView(out_wave.buffer);
  dv.setUint32(4, out_wave.length - 8, true);
  dv.setUint32(40, out_wave.length - 44, true);
}

const outFlag = flags.find((f) => f.startsWith("--out="));
const defaultName =
  basename(songFile).replace(/\.\w+$/, "") + (exportName ? "-" + exportName : "") + (loops > 1 ? `-x${loops}` : "") + ".wav";
const out = outFlag ? outFlag.slice(6) : join(rootDir, "out", defaultName);
mkdirSync(resolve(out, ".."), { recursive: true });
writeFileSync(out, out_wave);

const samples = new Int16Array(wave.buffer, 44);
let peak = 0;
let seamSq = 0;
const seamSamples = Math.min(samples.length, Math.floor(0.2 * 44100) * 2); // last 200 ms (stereo)
for (let i = 0; i < samples.length; i++) {
  const a = Math.abs(samples[i]);
  if (a > peak) peak = a;
  if (i >= samples.length - seamSamples) seamSq += samples[i] * samples[i];
}
const seamRms = (Math.sqrt(seamSq / seamSamples) / 32767) * 100;
const duration = samples.length / 2 / 44100;
const warning = peak === 0 ? " — SILENT, check note/pattern data" : peak >= 32767 ? " — CLIPPING, lower volumes/drive" : "";

// zipped-size estimate of the song data itself (JSON ≈ minified object literal)
const zippedBytes = gzipSync(JSON.stringify(song), { level: 9 }).length;

console.log(`${out}: ${duration.toFixed(2)}s${loops > 1 ? ` x${loops}` : ""}, peak ${((peak / 32767) * 100).toFixed(0)}%${warning}`);
if (duration > 8) {
  console.log(
    `loop seam: last 200ms RMS ${seamRms.toFixed(1)}% ${seamRms > 15 ? "— tail is loud, seam may click; end sparser or use --loop=2 to listen" : "(quiet tail, seam should be clean)"}`,
  );
}
console.log(`song data: ~${zippedBytes} bytes zipped (player: ${useSimple ? "CPlayerSimple (trimmed)" : "CPlayer (full)"})`);
