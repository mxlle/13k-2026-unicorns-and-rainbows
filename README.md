# js13k Base

Starter template for [js13kGames](https://js13kgames.com/) entries (13 kB zip limit), extracted
from [Kittens United](https://github.com/mxlle/13k-purrfect-plan) (js13k 2025).

**[▶ Live demo](https://mxlle.github.io/js13k-base/)** — a tiny placeholder game (move the cat 🐱
to collect three stars ⭐ while avoiding the bomb 💣) that exercises the whole pipeline. Replace
`src/components/demo-game/` with your game.

![The placeholder game: a 5×5 grid with a cat, three stars and a bomb, arrow buttons below and a
mute toggle in the header](js13k-base.png)

It builds to **~5,150 bytes zipped, leaving ~8,160 bytes** for your game — the entire framework,
audio player, i18n and demo game included.

## What's included

- **Vite build with aggressive size optimization**: terser property mangling, build-time enum
  inlining, CSS class name minification synced between TS and SCSS, enum-map compaction,
  treemap bundle analysis (`dist-analyzation/stats.html`)
- **Three build modes**: friends & family (`npm run build`), competition (`npm run build-js13k`),
  Poki (`npm run build-poki`) — controlled via `.env` files and tree-shaken `HAS_*` feature flags
- **Size tooling**: zip + size report with per-file breakdown and diff to previous build,
  automatic ECT recompression (via `ect-bin`, ~4% smaller zips), optional Roadroller crunch
  (`npm run build-js13k-roadroller`), CI workflow that enforces the 13,312-byte limit on every push
- **Micro framework**: `createElement` helpers, component pattern, dialog + header components,
  pub-sub service, local storage helpers, i18n (en/de), emoji-splitting helpers
  (`src/utils/emojis/`) for emoji-as-sprite games, SoundBox music/sfx players
- **An AI-assist setup that knows the size rules**: `CLAUDE.md` documents the whole size machinery,
  and `.claude/skills/soundbox-composer/` is a skill for composing the game's music and sound
  effects in code, with audible previews and per-song byte estimates

## Getting started

Requires Node.js ^20.19 or >=22.12 (CI runs 24).

```sh
npm install
npm start            # dev server
npm run build-js13k  # competition zip + size report
```

Click **Use this template** on GitHub to start your own entry, then work through the
"Yearly kickoff checklist" at the end of `CLAUDE.md` — it lists every placeholder that needs
renaming (game title, favicon emoji, localStorage prefix).

`npm install` reports a pile of `npm audit` findings. They all come from build-time tooling —
mostly `ect-bin`'s old binary-wrapper dependency stack — and every dependency here is a
`devDependency`, so none of it reaches the shipped zip.

## Documentation

`CLAUDE.md` is the real manual, for humans and AI agents alike: it explains the size machinery
(enum inlining, the enum-map transformer, property mangling and the rules it imposes, CSS class
name syncing) and the byte-golfing guidelines distilled from previous entries. **Read it before
touching `vite.config.ts` or adding an enum** — new enums must be registered in the
`replaceEnums({...})` call or their members won't be inlined.

`npm run lint` mechanically checks those size-machinery invariants, and `npm run typecheck` runs
strict `tsc`; CI runs both on every push.

## Licensing

This template is MIT-licensed (see `LICENSE`) — fork it, ship it, sell it, no need to ask. Since a
13 kB zip has no room for license boilerplate, consider the attribution requirement waived for games
built with it; a mention is welcome but never expected.

One third-party component: the audio players in `src/audio/small-player*.ts` are modified versions
of `player-small.js` from [SoundBox](https://sb.bitsnbites.eu/) by Marcus Geelnard, under the
[zlib license](https://opensource.org/licenses/Zlib) (kept in the file headers — don't remove it).
Note that the SoundBox *editor* itself is GPLv3, but the exported player routine and your own
exported songs are not affected by that.
