import { defineConfig } from "vite";
import { createHtmlPlugin } from "vite-plugin-html";
import replace from "@rollup/plugin-replace";
import { visualizer } from "rollup-plugin-visualizer";

import AST from "unplugin-ast/vite";
import { Transformer } from "unplugin-ast";
import type { Literal, NumericLiteral, ObjectExpression, ObjectProperty } from "yuku-parser";

import { TranslationKey } from "./src/translations/translationKey";
import { CssClass } from "./src/utils/css-class";
import { PubSubEvent } from "./src/utils/pub-sub-service";
import { LocalStorageKey } from "./src/utils/local-storage";
import { mapEntries, memoize } from "./src/utils/utils";
import { ChestLoot, GameObjectType } from "./src/game/game-objects";

// Placeholder favicon: swap the emoji for your game's (see the kickoff checklist
// in CLAUDE.md). Percent-encoded so the data URI stays valid as an HTML attribute
// value; keep it in sync with the icon in src/manifest.json.
const FAVICON_EMOJI = "🦄";
const FAVICON_DATA_URI =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${FAVICON_EMOJI}</text></svg>`,
  );

export default defineConfig(({ mode, command }) => {
  const production = command === "build";
  const poki = mode === "poki";
  const js13k = mode === "js13k";
  // The headless bot harness (`npm run bot`), which is an --ssr build of a node entry rather
  // than a build of the game. It only wants a predictable output name and no treemap.
  const bot = mode === "bot";
  const analyze = !bot;
  const analyzeOutputJson = false;

  const getCssIdentifier = memoize(idGenerator(), 2);

  return {
    base: "",
    // "LANG_" exposes every LANG_<code>_ENABLED language toggle without needing
    // a new prefix entry per language.
    envPrefix: ["LANG_", "POKI_ENABLED", "IS_JS13K"],
    build: {
      minify: production ? "terser" : false,
      cssMinify: production ? "lightningcss" : false,
      terserOptions:
        production && !poki
          ? {
              ecma: 2015,
              mangle: {
                properties: {
                  keep_quoted: true,
                },
              },
              compress: {
                ecma: 2015,
                booleans_as_integers: true,
                drop_console: js13k,
                keep_fargs: false,
                passes: 3,
                unsafe: true,
              },
            }
          : undefined,
      rollupOptions: {
        // rolldown (vite 8) has no rollup-style presets — these flags mirror
        // what rollup's `preset: "smallest"` used to enable
        treeshake: {
          moduleSideEffects: false,
          propertyReadSideEffects: false,
          unknownGlobalSideEffects: false,
        },
        output: {
          // filenames are stored twice in the zip — keep them short for js13k
          assetFileNames: js13k ? "a[extname]" : "[hash][extname]",
          entryFileNames: js13k ? "a.js" : bot ? "bot.js" : "[hash].js",
        },
      },
      modulePreload: { polyfill: false },
    },
    css: {
      modules: {
        localsConvention: "camelCaseOnly",
        generateScopedName: production ? getCssIdentifier : "[name]__[local]",
      },
    },
    plugins: [
      production &&
        replace({
          preventAssignment: true,
          delimiters: ["\\b", "\\b"],
          // Inline all enum member accesses (e.g. `GameObjectType.UNICORN` -> `0`) so the
          // enum objects themselves can be tree-shaken away.
          // Register every enum created with defineEnum here!
          ...replaceEnums({
            CssClass,
            TranslationKey,
            PubSubEvent,
            LocalStorageKey,
            GameObjectType,
            ChestLoot,
          }),
          ...mapEntries(CssClass, ([, name]) => [name, getCssIdentifier(name)]),
        }),
      production &&
        AST({
          include: ["src/**/*.ts"],
          transformer: [replaceMapsTransformer],
        }),
      js13k && {
        name: "js13k-tweaks",
        transformIndexHtml: {
          order: "post" as const,
          handler: (html: string) => html.replaceAll(" crossorigin", ""),
        },
        // rolldown emits the CSS of dynamic imports even when the import itself
        // is eliminated as dead code — drop the nice2have stylesheet (it sits
        // behind compile-time-false flags in js13k mode and is never referenced)
        generateBundle(_options: unknown, bundle: Record<string, any>) {
          for (const [fileName, output] of Object.entries(bundle)) {
            if (output.type === "asset" && output.originalFileNames?.some((n: string) => n.includes("nice2have"))) {
              delete bundle[fileName];
            }
          }
        },
      },
      createHtmlPlugin({
        minify: true,
        inject: {
          tags: js13k
            ? []
            : [
                { injectTo: "head", tag: "link", attrs: { rel: "manifest", href: "src/manifest.json" } },
                { injectTo: "head", tag: "meta", attrs: { name: "description", content: "My js13k game" } },
                // Emoji-glyph favicon, inline so it costs no extra request. Only
                // injected outside js13k mode — the competition build has no room
                // for it and browsers cope fine without one.
                { injectTo: "head", tag: "link", attrs: { rel: "icon", href: FAVICON_DATA_URI } },
              ],
        },
      }),
      analyze &&
        !analyzeOutputJson &&
        visualizer({
          filename: "dist-analyzation/stats.html",
          template: "treemap",
          gzipSize: true,
          brotliSize: true,
          open: false, // set to true to auto-open after build
        }),
      analyze &&
        analyzeOutputJson &&
        visualizer({
          filename: "dist-analyzation/stats.json",
          template: "raw-data",
          gzipSize: true,
          brotliSize: true,
          open: false,
        }),
    ],
  };
});

interface Obj<K, V> extends ObjectExpression {
  properties: (ObjectProperty & { key: K; value: V })[];
}

// Rewrites numeric-keyed object literals (the pattern produced by enum-keyed
// maps after enum inlining) into the shortest equivalent representation:
// a sparse array literal or a "a|b|c".split("|") expression.
const replaceMapsTransformer: Transformer = {
  onNode: (node) =>
    node.type === "ObjectExpression" &&
    node.properties.length > 0 &&
    node.properties.every(
      (p) => p.type === "Property" && p.key.type === "Literal" && typeof p.key.value === "number" && p.value.type === "Literal",
    ),
  transform: (node) => {
    const obj = node as Obj<NumericLiteral, Literal>;
    let best: { value: string | typeof obj; length: number } = { value: obj, length: (obj.end ?? 0) - (obj.start ?? 0) };
    function addCandidate(value: string) {
      if (value.length < best.length) best = { value, length: value.length };
    }

    // try ["a","b",,,"c"]
    const arr = obj.properties.reduce<unknown[]>((arr, p) => ((arr[p.key.value] = (p.value as { value?: unknown }).value), arr), []);
    addCandidate(JSON.stringify(arr).replaceAll("null,", ","));

    // try "a|b|c".split("|")
    if (obj.properties.every((p) => typeof p.value.value === "string")) {
      const str = arr.join("");
      const sep = [..."0123456789|,"].find((sep) => !str.includes(sep));
      if (sep !== undefined) {
        addCandidate(JSON.stringify(arr.join(sep)) + `.split(${isNaN(+sep) ? JSON.stringify(sep) : +sep})`);
      }
    }
    return best.value;
  },
};

const replaceEnums = (enums: object) =>
  Object.fromEntries(
    Object.entries(enums).flatMap(([name, obj]) => Object.entries(obj).map(([key, value]) => [`${name}.${key}`, JSON.stringify(value)])),
  );

const idGenerator =
  (i = 0) =>
  () => {
    const dict = "1234567890-qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM_";
    let str = "";
    if (i % dict.length === 0) i += 11;
    for (let x = i++; x > 0; x = Math.floor(x / dict.length)) {
      str += dict[x % dict.length];
    }
    return str;
  };
