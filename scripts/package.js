import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createWriteStream, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { execSync, spawnSync } from "node:child_process";
import { ZipArchive } from "archiver";
import ect from "ect-bin";

const rootDir = resolve(fileURLToPath(import.meta.url), "../..");
const distDir = resolve(rootDir, "dist");
const zipFile = join(rootDir, "dist.zip");
const historyFile = join(rootDir, ".size-history.json");

const SIZE_LIMIT = 13 * 1024; // 13,312 bytes — the js13k rule

const args = process.argv.slice(2);
const reportOnly = args.includes("--report-only"); // don't re-zip, just report
const check = args.includes("--check"); // exit 1 if over the limit (for CI)
const track = args.includes("--track"); // record size history — competition builds only, so other modes don't pollute the diffs

if (!reportOnly) {
  await createZip();
  recompress();
}

report();

async function createZip() {
  const output = createWriteStream(zipFile);
  const archive = new ZipArchive({ zlib: { level: 9 } });

  await new Promise((res, rej) => {
    output.on("close", res);
    archive.on("error", rej);
    archive.pipe(output);
    archive.directory(distDir, false);
    archive.finalize();
  });
}

// ECT recompression typically saves ~4% over zlib level 9 (e.g. 559 B on a 14 kB zip)
function recompress() {
  const result = spawnSync(ect, ["-9", "-zip", zipFile], { stdio: "ignore" });
  if (result.error || result.status !== 0) {
    console.warn("(ect recompression failed — zip is plain zlib level 9)");
  }
}

function report() {
  if (!existsSync(zipFile)) {
    console.error("dist.zip not found — run a build first");
    process.exit(1);
  }

  const size = statSync(zipFile).size;

  // per-file breakdown of dist
  console.log("");
  for (const file of readdirSync(distDir, { recursive: true }).sort()) {
    const stats = statSync(join(distDir, file));
    if (stats.isFile()) {
      console.log(`  ${String(stats.size).padStart(7)} B  dist/${file}`);
    }
  }

  console.log(`\n${relative(rootDir, zipFile)}: ${size} / ${SIZE_LIMIT} bytes (${((size / SIZE_LIMIT) * 100).toFixed(1)}%)`);

  const previous = updateHistory(size);
  if (previous) {
    const delta = size - previous.size;
    const sign = delta > 0 ? "+" : "";
    console.log(`diff to previous build: ${sign}${delta} bytes (was ${previous.size})`);
  }

  if (size > SIZE_LIMIT) {
    console.log(`\n❌ ${size - SIZE_LIMIT} bytes OVER the limit`);
    if (check) process.exit(1);
  } else {
    console.log(`\n✅ ${SIZE_LIMIT - size} bytes left`);
  }
}

function updateHistory(size) {
  if (!track && !reportOnly) return undefined;

  let history = [];
  try {
    history = JSON.parse(readFileSync(historyFile, "utf8"));
  } catch {
    // no history yet
  }

  const previous = history.at(-1);

  if (track && !reportOnly) {
    let commit = "";
    try {
      commit = execSync("git rev-parse --short HEAD", { cwd: rootDir, stdio: ["ignore", "pipe", "ignore"] })
        .toString()
        .trim();
    } catch {
      // not a repo / no commits yet
    }

    history.push({ date: new Date().toISOString(), size, commit });
    writeFileSync(historyFile, JSON.stringify(history.slice(-200), null, 2) + "\n");
  }

  return previous;
}
