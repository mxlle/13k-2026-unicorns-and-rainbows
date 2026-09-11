# Plan: the lollipop as a second fountain ("variant T")

Written 2026-09-11 from a design discussion with Almut. To be executed in a later session.
Read CLAUDE.md first: the collaboration rules there apply to every step below (Almut commits,
placeholders are listed, nothing feature-shaped beyond this plan without asking).

## Why

Play testers understand movement and the UI but not the income rule. Two quotes:

> "the exact positioning for when I could use the fountains to produce water vs produce candy
> felt tricky. I definitely lost moves getting that wrong."

> "I read them but I don't fully get it ... I don't understand the rainbow thing fully and why
> it gets to the sweets or not"

Today a rainbow pays water, unless a lollipop tree stands beside the *rainbow's* tile, in which
case it pays candy (its size once per tree). The condition sits on a tile the player is not
looking at, two hops from the tile they tap, and the cause (the tree) is not the thing they
lined up with.

## The new rule

The lollipop is a light source of the same kind as the fountain. The line-up rule the player
already knows from level 1 applies to both, and the thing in the middle decides the currency:

- `🦄⛲🌈` casts a rainbow that pays 💧, its size per turn.
- `🦄🍭🌈` casts a rainbow that pays 🍬, its size per turn.

Everything else stays: a rainbow needs empty ground opposite, scores while it shines, grows
the unicorn, is contested by the rival exactly as before. Trees are neutral scenery like
fountains. Seedlings grow into lollipops the way empty jugs become fountains.

What goes away: the tree beside a fountain, the rainbow-to-tree feed beam, the tree glow, the
"size per tree" multiplier (a rainbow between two trees). What replaces the combo: a unicorn
standing between a ⛲ and a 🍭 (sources two tiles apart) lights one rainbow of each.

Design decisions already taken in the discussion (do not re-open, do ask if the code makes
one of them impossible):

- The model attributes income to the rainbow, as today. Badge, income line and flights stay on
  the rainbow.
- Beams keep both jobs: colour = currency, number of lines = amount.
- Level 1 (5x5) stays tree-free (`TREE_SIZE = 7`).
- Level 2 becomes the teaching board for the candy line-up, picked for that rather than for a
  median score, the way level 1 already breaks the median rule.
- The two level 2 nudges are approved: the tutorial's standing advice stays on through level 2
  until the first candy income exists, and the first time candy income appears the lollipop
  that cast it is selected so the info panel explains it right there.

## Phase 0: baseline

1. New branch. `npm run build-js13k-roadroller` three times and note the min packed size as the
   baseline (jitter is about 7 bytes run to run). Last known reading: 13,255 at `7dec14c`.
2. `npm run bot` and `npm run levels` once, keep the output as the "before" numbers.

## Phase 1: the model (`src/game/game-map.ts`)

The rule lives in `updateRainbows` and `getRainbowIncome`. Nothing else in the file states it.

1. **Light passes through a tree.** In `updateRainbows`, the inner loop currently `continue`s
   unless the neighbour is `GameObjectType.FOUNTAIN`. Accept `GameObjectType.TREE` too. Suggested
   shape: a small `isLightSource(objectType)` helper (or read it off `OBJECT_CONFIG` as a
   `refracts` boolean, data-driven; measure which is smaller). Stamp the currency on the beam
   from the source: `isCandy: source === GameObjectType.TREE` (for the unlit beam too, so a
   beam dying in a lollipop is drawn pink).
2. **The rainbow remembers its currency.** Add `candy?: boolean` to `Tile` next to `light`,
   written in the same `if (isLit)` block. Same guarantee as `light`: only ever read of a tile
   holding a rainbow, stamped in the pass that put it there.
3. **`getRainbowIncome`** becomes `[tile.candy ? 1 : 0, tile.light]`. Rewrite its docblock: the
   "either water or sweets" rule is now "whatever it was cast through". Delete `getTreesBeside`.
4. **Income pass.** The second `map.tiles.forEach` in `updateRainbows` keeps summing through
   `getRainbowIncome`. Delete the block that pushes one feed beam per tree.
5. **Beam docs.** The `Beam` interface comment on `isCandy` talks about feeds; rewrite. `lines`
   stays.
6. Run `npm run typecheck`. The bot and the component will now fail to compile on
   `getTreesBeside`; that is phases 2 and 4.

Check `growUnicorns` counts a unicorn shining through a lollipop as shining. It should already,
if it reads beams or rainbows rather than fountains; verify rather than assume.

## Phase 2: the bot (`src/game/bot.ts`)

CLAUDE.md: when the rules change, change the bot, or the harnesses measure a game that no
longer exists. The rules change in phase 1, so this is not optional and not later.

1. **`getRainbows`** currently only looks past fountains. Look past both sources, and return
   for each rainbow whether it is a candy one (the source it came through). Simplest: return
   `{ position, candy }` pairs, or a parallel flag; keep it readable, the bot is not golfed.
2. **`getRainbowsValue`** uses `getTreesBeside` to pick `candyWorth` vs `dropWorth` per rainbow.
   Use the flag from step 1 instead. The `trees *` multiplier goes.
3. **`getBuildValue`** for `TREE_SITE` uses `countFeeding` (rainbows and fountains beside the
   seedling). A seedling is now a fountain-to-be, so value it like `FOUNTAIN_SITE`:
   `economy * (hasRainbowSpot(map, position) ? candyRainbowValue : 0)`, where the candy
   variant of `rainbowValue` is built from `candyWorth` the way `rainbowValue` is from
   `dropWorth`. Delete `countFeeding`.
4. `getLegalActions` (behind `HAS_BOT_LOGS`) probably needs nothing; check it does not filter
   moves on fountain adjacency.
5. `npm run typecheck`, then `npm run bot -- --solo` to see it plays at all. Numbers are not
   comparable yet: the boards still have the old layout.

## Phase 3: the generator (`src/game/game-map.ts`, `createGameMap` and helpers)

Trees stop being ring decoration and become sources with a ring of their own.

1. **Remove** the tree-beside-fountain placement inside the fountain loop, and with it
   `getFreeNeighbours` if nothing else uses it, `TREES_PER_FOUNTAIN`, `countTrees`.
2. **Place trees like fountains.** Replace the free-roaming loop with
   `placeObject(map, GameObjectType.TREE, FOUNTAIN_COUNT + TREE_COUNT, 1)` per tree: margin 1
   like fountains so every side has an opposite tile, and the spacing worked out from all
   sources together so trees and fountains share the board rather than each spacing only
   among their own kind. Placing them right after the fountains (before donuts) keeps the
   fussiest-first order.
3. **Rings.** `isFountainish` is the set whose rings `crowdsFountain` protects. Rename it to
   something like `isLightish` and include `TREE` and `TREE_SITE`. The special "a tree may sit
   on a ring" branch in `crowdsFountain` goes; every ground-owning thing keeps off every
   source's ring. Rewrite the docblock.
4. **Seedlings.** `getSeedlingSpots` (beside a fountain or rubble) is wrong now. Place them like
   `FOUNTAIN_SITE`: `placeObject(map, GameObjectType.TREE_SITE, SITE_COUNT, 1)`, in the same
   place in the order. Delete `getSeedlingSpots`.
5. **`build`**: nothing changes, a raised tree is neutral scenery already. `BUILD_TABLE` price
   `[TREE, 0, 4]` stays until the sweep says otherwise (phase 7).
6. **Counts.** `TREE_COUNT = size < TREE_SIZE ? 0 : FOUNTAIN_COUNT` is a PLACEHOLDER: with trees
   as full sources this doubles the light on the board. Leave it for the first measurement, it
   is one of the knobs phase 7 turns.
7. Update the `setMapSize` docblock ("the tree beside each fountain" is no longer one of the
   three non-loop placements) and the generator comments.
8. `npm run typecheck`, `npm run bot -- --solo`, and look at a few boards with the ☁️ fog
   toggle in `npm start` (level 2 and level 4 at least).

## Phase 4: the interface (`src/components/game-map/*`)

1. **Delete the tree glow.** The `powering` set in `render()`, the `.earning` class toggle on
   the ground glyph, and `.earning` in `game-map.module.scss` (plus the theme comment trail
   about "the two ends of the feed agreeing").
2. **Badge, income line, flights**: all read `getRainbowIncome` and need no change. Verify the
   badge shows 🍬 on a lollipop rainbow and 💧 on a fountain one.
3. **`hasFoundFountain`** in `showInfo` gates the rank ladder and the shine text. It should be
   "has found a light source": fountain or tree.
4. **Beam colours**: `isCandy` now comes from the source, the stylesheet's `.candy` rule stays.
   Rewrite the comment in the scss (lines around `&.candy`) that describes the feed.
5. **Currency display** hidden while `!TREE_COUNT`, and the tub's sell sentence gated on
   `TREE_COUNT`: both still right.
6. `npm run typecheck`, `npm run lint`, `npm run prettier`, click through `npm start`.

## Phase 5: texts (`src/translations/en.ts`, and `de.ts` if it has these keys)

PLACEHOLDER wordings, Almut's to change. Keep them short: the info panel reserves
`$info-height` for `INFO_UNICORN_SHINE`, the longest line, so re-measure that if it grows.

- `INFO_FOUNTAIN`: `Fountain|Line up 🦄⛲🌈. Its 🌈 make 💧.`
- `INFO_TREE`: `Lollipop|Line up 🦄🍭🌈. Its 🌈 make 🍬. 🍬 buy unicorns.` The name drops
  "tree": a tree says grow and harvest, and this thing is a fountain.
- `INFO_RAINBOW`: `Rainbow|Scores while it shines.` (the tile's own income line is appended
  already, so the currency is still said on tap)
- `INFO_UNICORN_SHINE`: `Line up 🦄⛲🌈 or 🦄🍭🌈 to shine. Shining raises its rank. Each rank
  makes its 🌈 worth more.` Watch `$info-height`.
- `INFO_TREE_SITE`: `Seedling|A unicorn beside it can grow it into a 🍭.`
- `INFO_RIVAL` ("Beat it to the fountains") can stay.

Update the comments above each key in `en.ts`; several describe the old rule at length.

## Phase 6: the level 2 nudges (`game-map.component.ts`)

Both approved; both small.

1. **Advice through level 2.** `refreshAdvice` has `advice = level ? undefined : getBotAction(...)`.
   Make it: on level 0 always; on level 1 while `map.candyIncome[PLAYER] === 0`; otherwise
   none. Update the docblock (the "a random deal at the tutorial's size counts as level 1"
   paragraph still holds). Check `advisesEndTurn` still reads right on the 7x7.
2. **First-candy focus.** Where `render()` compares `income` to `lastIncome` for the counter
   pops, detect candy income going from 0 to positive for the first time in a run (a boolean
   reset with the board). Find the lollipop that cast it: the first beam with `isCandy && isLit
   && side === PLAYER`, source tile at `(x + dx, y + dy)`, and `select` that tile so `showInfo`
   shows the lollipop's text. Do it after the render, not during the payout lock. If the
   rainbow is cast mid-turn (it is: rainbows update on every step), this fires on the step
   that lines it up, which is the right moment.
3. Optional, ASK FIRST (feature-shaped): a lollipop pulsing like a raisable site while a
   unicorn could shine through it, as the "over here" for the first attempt. Only if the level
   2 seed does not make the discovery obvious on its own.

## Phase 7: rebalance

Everything measured so far was measured on boards that no longer exist.

1. `npm run sweep` (defaults, then `--size=7` and `--size=17` alone). Read it as a landscape.
   If `explore` or `economy` beat `mixed` outright, fix `STRATEGY_WEIGHTS` / the `mixed`
   board-weight line before reading anything else.
2. Knobs, in this order, one at a time, `npm run bot` between: `TREE_COUNT` (sources per
   board), the `BUILD_TABLE` tree price, `CHEST_CANDY`. Watch the 🌑 column: the rival is the
   same bot, so the boards must stay a race.
3. **Re-pick `LEVEL_SEEDS`.** Median rule per rung as documented in `levels.ts`, except:
   - level 1: unchanged criterion (present with a unicorn, ceiling reachable). The seed may
     still change if the generator's roll order changed; check `10` still qualifies.
   - level 2: teaching criterion. Write a throwaway `vite --ssr` script (see the memory note on
     one-off measurements) that, for seeds 1..60 on the 7x7, reports the distance from the
     start to the nearest fountain and to the nearest lollipop, and whether the two are exactly
     two tiles apart (the combo spot). Pick a seed where the lollipop is found on the way to or
     right beside the first fountain, and both line-ups are possible within one turn.
4. `npm run levels`, paste `BOT_MIN_SCORES` / `BOT_MAX_SCORES` back.
5. **`LEVEL_TARGETS`**: Almut's bests are for the old boards. Set them to the bot's MAX row for
   now and say so in the docblock; Almut replaces them as she plays. Level 1's 400 ceiling
   only holds if the tutorial board is unchanged; re-derive if the seed moved.
6. Rewrite the `levels.ts` docblocks: the numbers quoted in prose (92% / 78 / 62 ...) are
   dead after this.

## Phase 8: size and docs

1. `npm run build-js13k-roadroller` three times, min against the phase 0 baseline. Expected to
   save: `getTreesBeside`, `countTrees`, `countFeeding`, `getSeedlingSpots`, `getFreeNeighbours`,
   the feed beams, the glow. Expected to cost: the tile flag, the source check, the two nudges.
   Net should be a saving; if it is not, find out why before trimming elsewhere.
2. Click through the packed build (eval).
3. CLAUDE.md: "The opponent" paragraph about contested things still holds. The "Dev tools"
   walk-list mentions trees only generically. Add one sentence to the opponent section or a
   short "Light sources" note: fountains and lollipops are the same kind of thing, water and
   candy, and rings are protected for both.
4. `DESCRIPTION.md` if it describes the rule.
5. Suggested commit message for Almut, once she has played it:
   `feat: lollipops are candy fountains (🦄🍭🌈 makes 🍬)`.

## Verification checklist

- `npm run typecheck`, `npm run lint`, `npm run prettier -- --check` (or `npm run prettier`)
- `npm run build-js13k` shows no dev tool leaked; `npm run build-js13k-roadroller` under 13,312
- `npm run bot`, `npm run bot -- --solo`, `npm run bot -- --size=7 --seed=<level2> --verbose`
  (read that one: does the bot line up with the lollipop early?)
- In `npm start`: level 1 unchanged; level 2 shows the advice ring until the first 🍬 income,
  then the lollipop is selected and its text is showing; the badge on that rainbow is 🍬; the
  beam through the lollipop is pink; end of turn flies 🍬 from the rainbow to the jar.
- A dark-theme and a phone-width pass, since the lollipop glyph is drawn tilted and stood
  upright by the stylesheet (see the `.tree` ground class) and now matters more.

## Open points for Almut (not blocking the phases above)

- Naming: "Lollipop" vs "Candy fountain" for the panel.
- Whether a lollipop should halo when light passes through it (fountains do not today).
- Whether the double-source combo (unicorn between ⛲ and 🍭) is wanted or should be kept
  rare by spacing. It is the only place a single tile pays both currencies.
