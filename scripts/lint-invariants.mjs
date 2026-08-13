// Enforces the mechanical size-machinery invariants from CLAUDE.md — the ones
// that fail silently as wasted bytes rather than as errors:
//   1. every `export const X = defineEnum({...})` is registered in
//      vite.config.ts's replaceEnums({...}) call (else members aren't inlined)
//   2. no Object.values/keys/entries(<Enum>) — it pins the whole enum object
//      into the bundle (write the literal member list instead)
//   3. no import.meta.env outside src/env-utils.ts (add a HAS_* flag instead)
// Exits 1 with a message per violation; run via `npm run lint` (also in CI).

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(fileURLToPath(import.meta.url), "../..");
const srcDir = join(rootDir, "src");

// files that legitimately touch import.meta.env
const ENV_ALLOWLIST = ["src/env-utils.ts", "src/utils/enums.ts"];

const errors = [];

const sourceFiles = readdirSync(srcDir, { recursive: true })
  .map((f) => join(srcDir, f))
  .filter((f) => f.endsWith(".ts") && !f.endsWith(".d.ts") && statSync(f).isFile());

// strip block comments and whole-line // comments so documentation examples
// (e.g. the add-a-language how-to in i18n.ts) don't trigger false positives
const stripComments = (code) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const sources = new Map(sourceFiles.map((f) => [relative(rootDir, f), stripComments(readFileSync(f, "utf8"))]));

// --- collect defineEnum enums and the ones registered in vite.config.ts ---

const enumNames = [];
for (const [file, code] of sources) {
  for (const [, name] of code.matchAll(/export\s+(?:const|var)\s+(\w+)\s*=\s*defineEnum\(/g)) {
    enumNames.push({ name, file });
  }
}

const viteConfig = readFileSync(join(rootDir, "vite.config.ts"), "utf8");
const replaceEnumsBlock = viteConfig.match(/replaceEnums\(\{([\s\S]*?)\}\)/)?.[1] ?? "";
const registered = new Set(replaceEnumsBlock.split(/[,\s]+/).filter(Boolean));

// --- rule 1: every enum registered ---

for (const { name, file } of enumNames) {
  if (!registered.has(name)) {
    errors.push(`${file}: enum ${name} is not registered in replaceEnums({...}) in vite.config.ts — its members won't be inlined`);
  }
}

// --- rule 2: no Object.values/keys/entries on enums ---

for (const [file, code] of sources) {
  for (const { name } of enumNames) {
    const match = code.match(new RegExp(`Object\\.(values|keys|entries)\\(\\s*${name}\\b`));
    if (match) {
      errors.push(`${file}: Object.${match[1]}(${name}) pins the whole enum object into the bundle — list the members literally instead`);
    }
  }
}

// --- rule 3: no import.meta.env outside env-utils ---

for (const [file, code] of sources) {
  if (code.includes("import.meta.env") && !ENV_ALLOWLIST.includes(file)) {
    errors.push(`${file}: import.meta.env used directly — add a HAS_* flag in src/env-utils.ts instead`);
  }
}

if (errors.length) {
  console.error(errors.map((e) => `❌ ${e}`).join("\n"));
  process.exit(1);
}

console.log(`✅ size-machinery invariants OK (${enumNames.length} enums registered, ${sources.size} files scanned)`);
