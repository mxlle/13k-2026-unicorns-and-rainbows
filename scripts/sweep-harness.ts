import { createGameMap, getExploration, getScore, isRunOver, MAP_SIZES } from "../src/game/game-map";
import { GameObjectType } from "../src/game/game-objects";
import {
  applyBotAction,
  BOT_STRATEGIES,
  BOT_STRATEGY_NAMES,
  BotStrategy,
  getBotAction,
  resetBot,
  setUsesBoardWeights,
  STRATEGY_WEIGHTS,
} from "../src/dev/bot";

/**
 * The third of the bot's three faces — `npm run sweep`. The ▶ button shows what a bot does
 * and why, `npm run bot` shows what a hundred of its runs come out at, and this asks the
 * question those two cannot: *which bot should we have been watching*.
 *
 * It turns one strategy's [explore, economy] weights over a grid and plays the whole board
 * ladder at every point of it. Nothing is re-implemented — it drives the same bot through the
 * same model as bot-harness.ts, and the only thing that moves between runs is the one entry in
 * STRATEGY_WEIGHTS. So the numbers are comparable with `npm run bot`'s to the digit.
 *
 * What it is for: those weights are the bot's *beliefs* about which half of the game pays, and
 * a change to the economy can make a belief that was true last week false. When `explore`
 * starts beating `mixed` outright, the mixed weights have gone stale and every reading taken
 * with them is suspect. Re-sweep, and the winner is the yardstick to measure the next change by.
 *
 * It is not a test. It asserts nothing, and the grid it prints is a landscape rather than an
 * answer: read how flat the top is, not only where the peak sits. A peak one percent above a
 * broad plateau is noise, and a cliff on one side of it is worth more than the peak itself.
 *
 *   npm run sweep                                  the default grid, 20 seeds, every board with trees
 *   npm run sweep -- --seeds=50                    steadier and slower
 *   npm run sweep -- --size=25                     one board
 *   npm run sweep -- --strategy=economy            sweep a different bot's weights
 *   npm run sweep -- --explore=0.8,1,1.2 --economy=0.4,0.6
 *                                                  a grid of your own, once the region is known
 */

// Declared rather than pulled in from @types/node, the same as bot-harness.ts: two fields off
// `process` is not worth a dependency, and the project's tsc runs without node types on purpose.
declare const process: { argv: string[] };

const args = process.argv.slice(2);
const option = (name: string) => args.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1];
const numbers = (name: string, fallback: number[]) => option(name)?.split(",").map(Number) ?? fallback;

const SEEDS = Number(option("seeds") ?? 20);
const MAX_ACTIONS = 20000; // the same belt and braces bot-harness.ts carries, and for the same reason
// The smallest board has no trees and therefore no candy at all, so it cannot tell these
// weights apart. Left out by default so it does not dilute the mean with a constant — name it
// with --size if you want to see that for yourself.
const SIZES = option("size") ? [Number(option("size"))] : MAP_SIZES.filter((size) => size > MAP_SIZES[0]);
const EXPLORE = numbers("explore", [0.6, 0.8, 1.0, 1.2, 1.5, 2.0]);
const ECONOMY = numbers("economy", [0.2, 0.4, 0.6, 0.8, 1.0]);
const STRATEGY =
  BOT_STRATEGIES.find((strategy) => BOT_STRATEGY_NAMES[strategy] === option("strategy")) ?? (BotStrategy.MIXED as BotStrategy);

interface Row {
  explore: number;
  economy: number;
  perSize: number[]; // mean score on each board of SIZES, in order
  mean: number;
  explored: number;
  herd: number;
  drops: number; // left in the purse at the whistle — money that scored nothing
}

/** One run of one board, played out by the bot under whatever weights are currently set. */
function play(size: number, seed: number) {
  const map = createGameMap(seed, size);
  resetBot(seed); // so the same board played by the same bot plays out the same way twice
  let actions = 0;

  while (!isRunOver(map) && actions++ < MAX_ACTIONS) {
    const action = getBotAction(map, STRATEGY);
    if (!action) break;
    applyBotAction(map, action);
  }

  return {
    score: getScore(map),
    explored: getExploration(map),
    herd: map.tiles.filter((tile) => tile.living === GameObjectType.UNICORN).length,
    drops: map.drops,
  };
}

// Two decimals, because the interesting grids are the narrow ones: rounded to one, a sweep of
// 0.75 / 1.0 / 1.25 prints as "0.8, 1.0, 1.3" and reads back as three weights nobody asked for.
const weight = (value: number) => value.toFixed(2).padStart(5);

const original = STRATEGY_WEIGHTS[STRATEGY];
const rows: Row[] = [];

// MIXED normally reads its economy weight off the board rather than out of STRATEGY_WEIGHTS
// (see MIXED_ECONOMY_AT_ZERO in bot.ts). Sweeping has to switch that off, or every row here
// would set a number nothing reads and the whole grid would come out flat — which is worth
// knowing about, because a sweep that quietly measures nothing is the one failure this tool
// cannot report. Sweep one board at a time when tuning that line: the weight is a function of
// the width, so a grid over the whole ladder can only ever find the best *constant*.
setUsesBoardWeights(false);

console.log(
  `\nsweeping ${BOT_STRATEGY_NAMES[STRATEGY]} · ${EXPLORE.length}x${ECONOMY.length} grid · ` +
    `${SEEDS} seeds · boards ${SIZES.join(", ")} · ${EXPLORE.length * ECONOMY.length * SIZES.length * SEEDS} runs\n`,
);

for (const explore of EXPLORE) {
  for (const economy of ECONOMY) {
    // The one thing that moves. Set rather than passed, because a strategy's weights are read
    // inside getBotAction and there is no way in from the outside — which is itself right: the
    // bot has one set of beliefs at a time, exactly as it does when a person is watching it.
    STRATEGY_WEIGHTS[STRATEGY] = [explore, economy];

    const perSize: number[] = [];
    let explored = 0;
    let herd = 0;
    let drops = 0;

    for (const size of SIZES) {
      let total = 0;

      for (let seed = 1; seed <= SEEDS; seed++) {
        const result = play(size, seed);
        total += result.score;
        explored += result.explored;
        herd += result.herd;
        drops += result.drops;
      }

      perSize.push(total / SEEDS);
    }

    const runs = SIZES.length * SEEDS;
    const mean = perSize.reduce((total, score) => total + score, 0) / perSize.length;
    rows.push({ explore, economy, perSize, mean, explored: explored / runs, herd: herd / runs, drops: drops / runs });
    // Printed as it goes: a full grid is thousands of runs and several minutes, and a sweep
    // that says nothing until it is finished cannot be watched or cut short.
    console.log(`  ${weight(explore)} / ${weight(economy)}  →  ${Math.round(mean)}⭐ mean`);
  }
}

// Leave the bot exactly as we found it, both the weights and where it reads them from.
STRATEGY_WEIGHTS[STRATEGY] = original;
setUsesBoardWeights(true);

const best = Math.max(...rows.map((row) => row.mean));
const width = SIZES.length * 7;

console.log(`\n    exp    eco │ ${SIZES.map((size) => String(size).padStart(6)).join(" ")} │   mean  vs best │  seen%   herd unspent💧`);
console.log(`  ${"─".repeat(13)}┼${"─".repeat(width)}┼${"─".repeat(17)}┼${"─".repeat(25)}`);

for (const row of rows) {
  console.log(
    `  ${weight(row.explore)}  ${weight(row.economy)} │ ` +
      `${row.perSize.map((score) => String(Math.round(score)).padStart(6)).join(" ")} │ ` +
      `${String(Math.round(row.mean)).padStart(6)} ${(((row.mean - best) / best) * 100).toFixed(1).padStart(6)}% │ ` +
      `${row.explored.toFixed(1).padStart(6)} ${row.herd.toFixed(1).padStart(6)} ${row.drops.toFixed(1).padStart(8)}` +
      `${row.mean === best ? "  ←" : ""}`,
  );
}

// And the winner on each board taken alone. One pair of weights has to serve the whole ladder
// today, so a column that wants something very different from the mean is the interesting
// result here — it is the case for the weights being a function of the board rather than a
// constant, and it is not visible anywhere in the mean.
console.log("\n  best on each board alone:");

SIZES.forEach((size, index) => {
  const winner = rows.reduce((best, row) => (row.perSize[index] > best.perSize[index] ? row : best));
  const atMean = rows.reduce((best, row) => (row.mean > best.mean ? row : best));
  const cost = ((winner.perSize[index] - atMean.perSize[index]) / atMean.perSize[index]) * 100;

  console.log(
    `  ${String(size).padStart(2)}x${size}  explore ${weight(winner.explore)}  economy ${weight(winner.economy)}  → ` +
      `${String(Math.round(winner.perSize[index])).padStart(5)}⭐   ` +
      `(the mean's winner scores ${Math.round(atMean.perSize[index])} here, ${cost.toFixed(1)}% less)`,
  );
});
