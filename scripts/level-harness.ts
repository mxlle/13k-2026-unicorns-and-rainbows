import {
  createGameMap,
  getExploration,
  getScore,
  HAS_RIVAL,
  hasGo,
  isRunOver,
  MAP_SIZES,
  nextTurn,
  TURN_LIMIT,
} from "../src/game/game-map";
import { PLAYER, RIVAL, Side } from "../src/game/game-objects";
import { applyBotAction, BOT_STRATEGY_NAMES, BotActionKind, BotStrategy, getBotAction, resetBot } from "../src/game/bot";
import { getPercent, LEVEL_SEEDS, LEVEL_TARGETS } from "../src/game/levels";

/**
 * The bot against the *curated levels* — `npm run levels`. Where `npm run bot` asks what a
 * board size is worth on average, this asks what the bot makes of the seven boards a player
 * is actually given (LEVEL_SEEDS), and puts that beside what those boards have been played to
 * (LEVEL_TARGETS). It is what re-measures BOT_MIN_SCORES / BOT_MAX_SCORES, and it prints them
 * ready to paste back into levels.ts.
 *
 * Three readings, because a level is one seed and one seed is not a fact about the bot:
 *
 *  - **canonical** — `mixed` with resetBot(mapSeed), which is bit-for-bit the run the game
 *    itself plays (see resetBot in game-map.component.ts). This is the opponent a player meets,
 *    and the only row that is a promise about what will happen on their screen.
 *  - **every strategy** on the same board, which is the sanity check the sweep exists for: when
 *    `explore` or `economy` beats `mixed` outright, mixed's weights have stopped describing the
 *    economy and every reading taken with it is suspect (see the sweep notes in CLAUDE.md).
 *  - **the band** — `mixed` on the same board with only its tie-break RNG re-seeded. The bot
 *    breaks ties by rolling (see pickTie), so the same bot on the same board scores a range,
 *    and on the middle boards that range is wider than the gap between two strategies.
 *
 * Like the other two harnesses it asserts nothing and cannot fail: it imports the game's own
 * TypeScript out of src, so there is no second copy of the rules in it, and the numbers are
 * only ever what *this* bot makes of these boards. Read them against the last time.
 *
 *   npm run levels                 every level: canonical, all strategies, the band
 *   npm run levels -- --spread=50  a steadier band, and slower
 *   npm run levels -- --level=7    one rung (1-based, as the launch screen counts them)
 *
 * The opponent is left on, because it is on when these levels are played — a "beat the bot"
 * target measured without it would be a number from a different game.
 */

// Declared rather than pulled in from @types/node, exactly as in bot-harness.ts: two fields
// off `process` is not worth a dependency.
declare const process: { argv: string[] };

const args = process.argv.slice(2);
const option = (name: string) => args.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1];

const SPREAD = Number(option("spread") ?? 20);
// Where the band's bot seeds start. Away from the map seeds on purpose: a run seeded from the
// map seed is the canonical one and belongs in its own column, not in the band's twenty.
const SPREAD_FIRST_SEED = 1000;
const MAX_ACTIONS = 20000;

const levels = option("level") ? [Number(option("level")) - 1] : MAP_SIZES.map((_, level) => level);
// RANDOM is left out: it scores nothing on purpose and would only ever be the min of every row.
const STRATEGIES: BotStrategy[] = [BotStrategy.EXPLORE, BotStrategy.ECONOMY, BotStrategy.MIXED];

interface Run {
  score: number;
  rivalScore: number; // 0 on a board with nobody on it to race
  explored: number;
  hasRival: boolean;
}

/** One side playing until it runs out of things worth doing — see playGo in bot-harness.ts. */
function playGo(map: ReturnType<typeof createGameMap>, strategy: BotStrategy, side: Side, budget: number): number {
  let actions = 0;

  while (actions < budget) {
    const action = getBotAction(map, strategy, side);
    if (!action) break;
    actions++;
    applyBotAction(map, action, side);
    if (action.kind === BotActionKind.END_TURN) break;
  }

  return actions;
}

/**
 * One whole run. The bot's seed is a parameter rather than the map's, which is the only thing
 * this harness does that the others do not: the band comes from holding the board still and
 * re-rolling the bot.
 */
function play(size: number, mapSeed: number, strategy: BotStrategy, botSeed: number): Run {
  const map = createGameMap(mapSeed, size);
  resetBot(botSeed);
  let actions = 0;

  while (!isRunOver(map) && actions < MAX_ACTIONS) {
    const sides: Side[] = (HAS_RIVAL ? [PLAYER, RIVAL] : [PLAYER]).filter((side) => hasGo(map, side));
    for (const side of sides) actions += playGo(map, strategy, side, MAX_ACTIONS - actions);
    nextTurn(map);
  }

  return {
    score: getScore(map, PLAYER),
    rivalScore: HAS_RIVAL ? getScore(map, RIVAL) : 0,
    explored: getExploration(map, PLAYER),
    hasRival: HAS_RIVAL,
  };
}

const board = (level: number) => `${MAP_SIZES[level]}x${MAP_SIZES[level]}`;
const canonical = (level: number, strategy: BotStrategy) => play(MAP_SIZES[level], LEVEL_SEEDS[level], strategy, LEVEL_SEEDS[level]);
const cell = (value: number | string, width: number) => `${value}`.padStart(width);
const median = (values: number[]) => [...values].sort((a, b) => a - b)[values.length >> 1];

console.log(`\n=== the run the game plays: mixed, seeded from the map seed ===`);
console.log(`level  board    turns   seed    target    bot     % of target   rival   seen%`);

for (const level of levels) {
  const run = canonical(level, BotStrategy.MIXED);
  console.log(
    `${cell(level + 1, 5)}  ${board(level).padEnd(8)} ${cell(TURN_LIMIT, 5)} ${cell(LEVEL_SEEDS[level], 6)} ` +
      `${cell(LEVEL_TARGETS[level], 9)} ${cell(run.score, 6)} ${cell(`${getPercent(level, run.score)}%`, 13)} ` +
      `${cell(run.hasRival ? run.rivalScore : "—", 7)} ${cell(run.explored.toFixed(0), 7)}`,
  );
}

console.log(`\n=== every strategy on the same boards — mixed should win, and where it does not the weights are stale ===`);
console.log(`level  board    ${STRATEGIES.map((strategy) => cell(BOT_STRATEGY_NAMES[strategy], 9)).join("")}     best`);

for (const level of levels) {
  const runs = STRATEGIES.map((strategy) => canonical(level, strategy));
  const best = Math.max(...runs.map((run) => run.score));
  const winner = BOT_STRATEGY_NAMES[STRATEGIES[runs.findLastIndex((run) => run.score === best)]];
  console.log(`${cell(level + 1, 5)}  ${board(level).padEnd(8)} ${runs.map((run) => cell(run.score, 9)).join("")}   ${winner}`);
}

console.log(`\n=== the band: mixed on the same board, tie-break RNG re-seeded ${SPREAD}x ===`);
console.log(`level  board       min   median      max   as % of target`);

const mins: number[] = [];
const maxes: number[] = [];

for (const level of levels) {
  const scores = Array.from(
    { length: SPREAD },
    (_, index) => play(MAP_SIZES[level], LEVEL_SEEDS[level], BotStrategy.MIXED, SPREAD_FIRST_SEED + index).score,
  );
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  mins.push(min);
  maxes.push(max);
  console.log(
    `${cell(level + 1, 5)}  ${board(level).padEnd(8)} ${cell(min, 6)} ${cell(median(scores), 8)} ${cell(max, 8)}   ` +
      `${getPercent(level, min)}%–${getPercent(level, max)}%`,
  );
}

// Ready to paste back into levels.ts, which is the whole point of the band — the two arrays
// there are what this harness maintains.
if (levels.length === MAP_SIZES.length) {
  console.log(`\n--- for levels.ts ---`);
  console.log(`export const BOT_MIN_SCORES = [${mins.join(", ")}];`);
  console.log(`export const BOT_MAX_SCORES = [${maxes.join(", ")}];`);
}
