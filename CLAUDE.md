# Unicorns and Rainbows — js13k 2026

[js13kGames](https://js13kgames.com/) 2026 entry (theme: **Unicorns and Rainbows**): the whole
game must fit in a **13,312-byte (13 kB) zip**. Everything in this repo — build config, code
style, helper choice — serves that constraint. When in doubt, the smaller output wins.

## Collaboration rules — roles and scope

Almut is the **game designer and owner of the game logic**; Claude provides **technical
implementation support**. Creative decisions stay on Almut's side.

1. **Implement the ask, plus necessary plumbing only.** The minimal technical scaffolding an ask
   requires (types, small utils, wiring, enum registration) is in scope. Anything feature-shaped
   beyond the ask — extra mechanics, unrequested polish, "while I'm here" refactors — is not.
   When in doubt whether something is plumbing or a feature, it's a feature: ask first.
2. **Design gaps: small ones get placeholders, big ones get questions.** If an unspecified detail
   merely needs *a* value (a speed, a duration, a color), pick a neutral default as an
   easy-to-tune named constant and **explicitly list every such stubbed decision** when reporting
   back. If the gap shapes the mechanic itself (what happens on collision, win/lose conditions,
   how an interaction works), stop and ask before implementing.
3. **Own ideas: offer, never implement.** Ideas for mechanics, twists, or theme are welcome as a
   brief, clearly separated suggestion at the end of a response — never built, not even partially,
   without an explicit go-ahead.
4. **No silent scope growth across turns.** A go-ahead covers exactly what was approved; new ideas
   that come up mid-implementation go back through rules 2–3.
5. **Almut does the committing.** Claude works in the working tree and reports what changed;
   `git add`, `git commit` and `git push` are Almut's — no exceptions for "small" or obviously
   safe commits. This **overrides the global preference** that lets Claude commit autonomously.
   A suggested commit message is welcome as text in the response; running the command is not.

## Commands

- `npm start` — dev server (unminified, readable class names)
- `npm run build` — "friends & family" build (all nice-to-haves, PWA manifest)
- `npm run build-js13k` — competition build → `dist.zip` + size report
- `npm run build-js13k-roadroller` — same + Roadroller-crunched JS inlined into the HTML (test in browser afterwards, it is eval-based!)
- `npm run build-poki` — Poki platform build (Poki SDK, no property mangling)
- `npm run size` — re-report last `dist.zip` size without rebuilding
- `npm run bot` — headless balancing runs: the dev bot plays every board with every strategy
  (see "Dev tools" below). Never shipped, never part of a build
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

## Dev tools — and keeping the bot in step with the game

Everything under `src/dev/` is for looking at the game rather than playing it, and none of it
ships: it is reached only from behind `HAS_DEV_TOOLS` (which is `IS_DEV`, so it is absent from
the friends-&-family build too) and tree-shaken out of every real build. Keep it that way —
`npm run build-js13k` is the check, and the whole bot currently costs the competition build
0 bytes. Nothing in there is byte-golfed, and it should not be: clarity and being easy to
re-tune are worth more in a file that never leaves the machine.

- **☁️ fog toggle** — the clouds off, for looking at how a board actually came out. Drawing
  only; the model's `isRevealed` is untouched, so the run behaves exactly as it would with the
  clouds on.
- **The bot** (`src/dev/bot.ts`), in the same corner: ⚖️ cycles the four strategies
  (random / explore / economy / mixed), ▶ takes one action, ⏩ plays the rest of the run out on
  a timer. Every action prints to the console with what the bot thought it was worth. The
  buttons are for seeing *why* a bot does something; the numbers come from the harness.
- **`npm run bot`** (`scripts/bot-harness.ts`) plays whole runs with nobody watching — every
  board × every strategy × N seeds — and prints score, exploration, rainbows, herd, what the
  actions were spent on, and what was left unspent at the whistle. It is a vite `--ssr` build
  of a node entry, so it imports the game's own TypeScript out of `src` and there is no second
  copy of the rules in it. `npm run bot -- --size=13 --seed=7 --strategy=mixed --verbose`
  replays one run action by action. Runs are seeded from the map seed, so they repeat exactly.
  It asserts nothing and cannot fail: read the numbers against each other and against the last
  time you ran it, never as a verdict.

**When the rules change, change the bot.** Nothing will break if you don't — it will quietly
go on playing a game that no longer exists and hand you balancing numbers for it. After a
change to the economy, the objects or the board, walk `src/dev/bot.ts`:

- `getLegalActions` — anything a player can now do that is not in there is invisible to the bot.
- the value model (`getBestAction`, `getStandingValue`, `getBuildValue`) — a new object, price
  or income stream needs a worth in score points, or the bot plays as if it were worth nothing.
- `applyBotAction` — the one place in the repo that says a second time what the interface does
  when it carries an action out. If `move` / `buy` / `raise` / `finishTurn` in
  `game-map.component.ts` change, this changes with them, or the headless runs quietly stop
  matching the game that is actually played. (The interface itself does *not* go through it:
  the buttons play a bot action through `select` + the real handlers, so the bot can only ever
  do what a tap can do.)
- the tuning constants at the top are the bot's *beliefs* about what things are worth — not the
  game's balance. A bot that plays badly after a change is a finding about the change or about
  the constants, and telling those two apart is the work.

The bot plays fair: it decides only from revealed tiles, never from what the fog is hiding.
Hold any new heuristic to that, or its runs stop saying anything about what a player could do.

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
