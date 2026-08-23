#!/usr/bin/env node
// Report which SoundBox player features your songs actually use, and what is
// therefore safe to delete from the player before shipping the js13k build.
//
// Usage: node scripts/audit-player-usage.mjs [song files...]
//        (default: every .ts file in src/audio/songs/)
//
// Trimming options, in order of effort:
//  1. Everything sine-only, and no LFO / distortion / f-automation? -> switch imports to
//     small-player-simple.ts (the shipped trim) and delete small-player.ts.
//  2. Otherwise: copy small-player.ts and delete the unused oscillator functions /
//     effect blocks this audit lists (that's exactly how small-player-simple.ts
//     was made). Keep the zlib header and the "altered version" note.
import { copyFileSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = resolve(fileURLToPath(import.meta.url), "../..");
const songsDir = join(rootDir, "src/audio/songs");

const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(songsDir)
      .filter((f) => /\.(ts|js|mjs)$/.test(f))
      .map((f) => join(songsDir, f));

const tmp = mkdtempSync(join(tmpdir(), "soundbox-audit-"));
async function importAsMjs(file) {
  const target = join(tmp, basename(file).replace(/\.\w+$/, "") + ".mjs");
  copyFileSync(file, target);
  return import(pathToFileURL(target).href);
}

const WAVEFORM_NAMES = ["sin", "square", "saw", "tri"];
const used = {
  waveforms: new Set(),
  noise: false,
  arp: false,
  lfo: false,
  filter: new Set(),
  dist: false,
  pan: false,
  delay: false,
  fx_automation: false,
};
const isSong = (v) => v && typeof v === "object" && Array.isArray(v.songData);

for (const file of files) {
  const mod = await importAsMjs(resolve(file));
  for (const [name, value] of Object.entries(mod)) {
    if (!isSong(value)) continue;
    for (const channel of value.songData) {
      const i = channel.i;
      used.waveforms.add(i[0]);
      used.waveforms.add(i[4]);
      if (i[9]) used.noise = true;
      if (i[14]) used.arp = true;
      if (i[19]) used.lfo = true; // LFO_FX_FREQ toggles the filter LFO
      if (i[20]) used.filter.add(i[20]);
      if (i[23]) used.dist = true;
      if (i[25]) used.pan = true;
      if (i[27]) used.delay = true;
      for (const pattern of channel.c ?? []) {
        if (pattern.f?.some(Boolean)) used.fx_automation = true;
      }
    }
    console.log(`scanned ${basename(file)} : ${name} (${value.songData.length} channel(s))`);
  }
}

const waveforms = [...used.waveforms].sort();
console.log(`\nwaveforms used: ${waveforms.map((w) => `${w}=${WAVEFORM_NAMES[w] ?? "?"}`).join(", ")}`);
console.log(`noise: ${used.noise} | arpeggio: ${used.arp} | filter LFO: ${used.lfo} | filter types: ${[...used.filter].join(",") || "-"}`);
console.log(`distortion: ${used.dist} | panning: ${used.pan} | delay: ${used.delay} | f-automation: ${used.fx_automation}`);

const sineOnly = waveforms.every((w) => w === 0);
console.log("\n--- Trimming verdict ---");
if (sineOnly && !used.lfo && !used.dist && !used.fx_automation) {
  console.log("Songs fit small-player-simple.ts as-is -> switch imports in music-control.ts");
  console.log("and sound-control-box.ts to CPlayerSimple and let small-player.ts tree-shake away.");
} else {
  console.log("Songs need more than the simple player. Deletable from a copy of small-player.ts:");
  for (let w = 1; w < 4; w++)
    if (!used.waveforms.has(w)) console.log(`  - osc_${WAVEFORM_NAMES[w]} (keep array positions with a placeholder, e.g. 0)`);
  if (!used.lfo) console.log("  - the filter-LFO block (oscLFO/lfoAmt/lfoFreq usage)");
  if (!used.dist) console.log("  - the distortion block");
  if (!used.noise) console.log("  - the noise-oscillator block in createNote");
  if (!used.arp) console.log("  - arpeggio handling in createNote (arp/arpInterval)");
  if (!used.fx_automation) console.log("  - the effect-command block (instr.c[..].f handling)");
}
console.log("Re-render everything after trimming (render-song.mjs --simple or your trimmed copy) — then npm run build-js13k.");
