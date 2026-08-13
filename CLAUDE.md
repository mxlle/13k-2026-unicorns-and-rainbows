# js13k Base Project

Base project for [js13kGames](https://js13kgames.com/) entries: the whole game must fit in a
**13,312-byte (13 kB) zip**. Everything in this repo — build config, code style, helper choice —
serves that constraint. When in doubt, the smaller output wins.

## Commands

- `npm start` — dev server (unminified, readable class names)
- `npm run build` — "friends & family" build (all nice-to-haves, PWA manifest)
- `npm run build-js13k` — competition build → `dist.zip` + size report
- `npm run build-js13k-roadroller` — same + Roadroller-crunched JS inlined into the HTML (test in browser afterwards, it is eval-based!)
- `npm run build-poki` — Poki platform build (Poki SDK, no property mangling)
- `npm run size` — re-report last `dist.zip` size without rebuilding
- `npm run typecheck` — strict `tsc` check (the vendored `small-player*.ts` are `@ts-nocheck`'d,
  typed via `src/audio/player-interface.ts`); CI runs this on every push
- `npm run lint` — `scripts/lint-invariants.mjs` mechanically checks the size-machinery rules
  below (enum registration, no `Object.values(Enum)`, no direct `import.meta.env`); also in CI

After **every** change while working on the js13k build, run `npm run build-js13k` and check the
reported size. `scripts/package.js` prints a per-file breakdown, the diff to the previous build
(tracked in `.size-history.json`, gitignored — competition builds only via `--track`, so poki
builds don't pollute the diffs), and bytes left. For a treemap of what costs what,
open `dist-analyzation/stats.html` after any build.

## Build modes / feature flags

Three modes via `.env`, `.env.js13k`, `.env.poki` (`POKI_ENABLED`, `IS_JS13K`, and per-language
`LANG_<code>_ENABLED` toggles such as `LANG_DE_ENABLED`). The `LANG_` prefix is registered in
`vite.config.ts`'s `envPrefix`, so new language toggles need no `envPrefix` edit.
**Never check `import.meta.env` in game code directly** — add a `HAS_*` flag in `src/env-utils.ts`
instead. Because the flags are compile-time constants, everything behind `if (HAS_X)` is
tree-shaken out of builds where the flag is false. That is the mechanism that lets the
friends-&-family build carry extra content without costing the js13k build a single byte.

- js13k mode: short texts, no console logs, no manifest/meta tags, no nice-to-have styles
- poki mode: loads the Poki SDK (`src/poki-integration.ts`), gameplayStart/Stop wired in `index.ts`;
  terser property mangling is DISABLED for poki (their SDK breaks otherwise)

## Size machinery — read before touching vite.config.ts or adding enums

The unusual parts of this codebase exist to make minification maximally effective:

1. **`defineEnum` + build-time inlining.** Enums are plain objects created with `defineEnum`
   (`src/utils/enums.ts`). `vite.config.ts` textually replaces every member access
   (`Direction.UP` → `0`) via `@rollup/plugin-replace`, so the enum object itself is tree-shaken
   away. **Every new `defineEnum` enum MUST be registered in the `replaceEnums({...})` call in
   `vite.config.ts`**, and enum member access must always be written literally as `EnumName.MEMBER`
   (never destructured or aliased), or the replacement misses it. In particular, **never write
   `Object.values(SomeEnum)`** — it keeps the whole enum object alive in the bundle; write the
   literal member list instead (`[Direction.UP, Direction.DOWN, ...]`), which inlines to plain
   numbers (2025 postmortem: five such calls cost ~57 zipped bytes).
2. **Enum-keyed maps get compacted.** A custom AST transformer rewrites numeric-keyed object
   literals (`{0: "a", 1: "b"}`) into arrays or `"a|b".split("|")` — writing lookup maps keyed by
   enums is therefore cheap and idiomatic here.
3. **Property mangling is ON** (js13k + default build): terser renames all *unquoted* properties.
   Consequences:
   - String-keyed data that must survive verbatim (e.g. `"ArrowUp"`, JSON-ish config) must use
     **quoted keys** (`keep_quoted: true` protects them). Prettier is configured with
     `quoteProps: "preserve"` so it won't strip the quotes.
   - Standard DOM/browser properties are safe (terser knows the builtins).
   - If something works in dev but breaks in the build, suspect property mangling first.
4. **CSS class names are minified in sync.** Global class names live twice: `src/utils/css-class.ts`
   (TS) and `src/names.scss` (SCSS) — keep both in sync. The build replaces them (and CSS module
   class names) with 1-2 char identifiers via a shared generator, so TS and SCSS stay consistent.
   Component-scoped styles use CSS modules (`*.module.scss`, accessed as `styles.foo`).
5. **No frameworks, no runtime deps.** UI is built with `createElement` from
   `src/utils/html-utils.ts` and the component pattern in `src/framework/components/_component-template`.

## Byte-golfing guidelines

- Measure, don't guess: `npm run build-js13k` after each change; the zip size is the only truth.
  Minified+zipped size correlates poorly with source size — repetitive code compresses well.
- Prefer data-driven code (lookup tables keyed by enums) over branching; the map transformer and
  zip compression both love it.
- Emojis are the sprite sheet: one emoji ≈ 4 bytes buys full-color art. No image assets.
- But keep emojis (and any repeated markers) out of *data tables*: store level/config data as
  compact digit strings and reconstruct the presentation at runtime. In 2025, replacing 21
  emoji-formatted level strings with bare digit pairs + a 5-line decoder saved ~90 zipped bytes.
- Audit data definitions for never-read fields before shipping — the 2025 levels carried a
  `description` field no code ever read; comments are free, object properties are not.
- Music/sfx via SoundBox player (`src/audio/small-player*.ts`) — song data are tiny JS objects
  (the 2025 background track ≈ 290 zipped bytes). Use the `soundbox-composer` skill to
  compose/edit them in code (audible preview + size/loop-seam stats via
  `node scripts/render-song.mjs`), or compose at https://sb.bitsnbites.eu/ and export as JS.
  The full-featured player is the default; before shipping, run
  `node scripts/audit-player-usage.mjs` and trim the player to what the songs actually use
  (switch to `CPlayerSimple` if everything is sine-only — that's the 2025 trim).
- Fonts: system/monospace + Noto Color Emoji. The Noto webfont import lives in
  `globals.nice2have.scss` so it ships only in non-js13k builds — the competition build must not
  make external requests (offline rule) and falls back to the system emoji font.
- Reuse translations keys / strings where possible; identical strings compress, but each unique
  string costs.
- ECT zip recompression runs automatically in package.js (via the `ect-bin` npm package, so it
  also works on CI) and is worth ~4%. Roadroller (`build-js13k-roadroller`) is the emergency
  reserve for the last kilobyte — don't design around it.
- Output filenames and HTML attributes count too: js13k mode already uses single-letter
  bundle names (filenames are stored twice in a zip) and strips `crossorigin` attributes.

## Conventions

- Components: `function MyComponent(): HTMLElement` or `ComponentDefinition` tuple
  `[hostElement, updateFn]` — see `src/framework/components/_component-template`.
- Cross-component communication via `pubSubService` (`src/utils/pub-sub-service.ts`); register new
  events in the `PubSubEvent` enum (and remember rule 1 above — it's already registered).
- Persistent state via `src/utils/local-storage.ts` with single-letter keys.
- Formatting: prettier (140 chars, preserved quote props) — `npm run prettier`.

## Yearly kickoff checklist

1. Update dependencies BEFORE the jam (`npm outdated`; majors deliberately, one at a time) — no
   time for bundler surprises mid-competition. After upgrading, `npm run build-js13k` and compare
   the zip size, then verify the size machinery in `dist/a.js`: no `Object.values`/`Object.freeze`
   leaked, quoted keys (`"ArrowUp"`) survived, numeric-keyed maps got compacted, and no external
   URL (`fonts.googleapis`) or unreferenced asset landed in the js13k dist.
2. Update `GAME_TITLE` in `src/env-utils.ts`, title in `index.html`, name in `src/manifest.json`,
   `package.json` name/description/repository, and `FAVICON_EMOJI` in `vite.config.ts` (keep the
   icon in `src/manifest.json` in sync).
3. Set `LOCAL_STORAGE_PREFIX` in `src/utils/local-storage.ts` — it ships as the placeholder
   `"your-handle"`. All entries are served from the same origin, so js13k asks you to namespace
   your keys (conventionally with your GitHub handle); keep it short, every character costs bytes.
4. Replace `src/components/demo-game/` with the real game (keep the GAME_START/GAME_END events).
5. Check the js13k rules page for this year's exact rules (zip size, allowed APIs) — they
   occasionally change.
6. `npm run build-js13k` early and often; keep CI green (it enforces the limit on every push).
