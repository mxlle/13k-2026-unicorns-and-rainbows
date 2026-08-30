# 🦄 Unicorns and Rainbows 🌈

My entry for [js13kGames](https://js13kgames.com/) 2026 — this year's theme is
*Unicorns and Rainbows*. Everything has to fit into a 13,312-byte zip.

🚧 **Work in progress.** The game itself is still to come — right now the repo holds the
placeholder game from my [js13k base template](https://github.com/mxlle/js13k-base) with
themed emojis.

## Getting started

Requires Node.js ^20.19 or >=22.12.

```sh
npm install
npm start                       # dev server
npm run build-js13k-roadroller  # competition zip + size report
```

The competition zip is the Roadroller-packed one — the entry no longer fits without that crunch.
`npm run build-js13k` builds the same thing un-packed: faster and readable, but over the limit.

## Documentation

`CLAUDE.md` is the manual, for humans and AI agents alike: it explains the size machinery
(enum inlining, the enum-map transformer, property mangling and the rules it imposes, CSS class
name syncing) and the byte-golfing guidelines distilled from previous entries. **Read it before
touching `vite.config.ts` or adding an enum.**

`npm run lint` mechanically checks those size-machinery invariants, and `npm run typecheck` runs
strict `tsc`; CI runs both on every push.

## Licensing

MIT-licensed (see `LICENSE`).

One third-party component: the audio players in `src/audio/small-player*.ts` are modified versions
of `player-small.js` from [SoundBox](https://sb.bitsnbites.eu/) by Marcus Geelnard, under the
[zlib license](https://opensource.org/licenses/Zlib) (kept in the file headers — don't remove it).
Note that the SoundBox *editor* itself is GPLv3, but the exported player routine and your own
exported songs are not affected by that.
