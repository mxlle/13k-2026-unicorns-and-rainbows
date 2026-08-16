import { createGameMap, getExploration, getScore, isRunOver, MAP_SIZES, TURN_LIMIT } from "../src/game/game-map";
import { GameObjectType } from "../src/game/game-objects";
import { applyBotAction, BOT_STRATEGIES, BOT_STRATEGY_NAMES, BotActionKind, BotStrategy, getBotAction, resetBot } from "../src/dev/bot";

/**
 * The bot playing whole runs with nobody watching — `npm run bot`. It is the balancing half
 * of the dev bot: the ▶ button in the game shows what a bot does and why, and this shows what
 * a hundred of its runs come out at. A change to a price, an income or a map size can be read
 * here in seconds, across every board and every strategy at once.
 *
 * It is not a test — it asserts nothing and there is nothing to pass. The numbers are only
 * ever what *these* bots make of the board, so read them against each other and against the
 * last time you ran it, never as a verdict.
 *
 * Run through vite (`npm run bot`) rather than node directly: it imports the game's TypeScript
 * straight out of src, which is the whole point — there is no second copy of the rules here.
 *
 *   npm run bot                          every board, every bot, 10 seeds each
 *   npm run bot -- --seeds=50            the same, steadier and slower
 *   npm run bot -- --size=13             one board
 *   npm run bot -- --strategy=economy    one bot
 *   npm run bot -- --size=13 --seed=7 --strategy=mixed --verbose
 *                                        one run, every action it takes and what it thought
 *                                        the action was worth
 */

// Declared rather than pulled in from @types/node: two fields off `process` is not worth a
// dependency, and the project's tsc runs without node types on purpose.
declare const process: { argv: string[] };

const args = process.argv.slice(2);
const flag = (name: string) => args.some((arg) => arg === `--${name}`);
const option = (name: string) => args.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1];

const SEED_COUNT = Number(option("seeds") ?? 10);
const FIRST_SEED = Number(option("seed") ?? 1);
const verbose = flag("verbose");
const sizes = option("size") ? [Number(option("size"))] : MAP_SIZES;
const strategies = option("strategy")
  ? BOT_STRATEGIES.filter((strategy) => BOT_STRATEGY_NAMES[strategy] === option("strategy"))
  : BOT_STRATEGIES;
// A run cannot go on forever — every turn ends and the turns run out — but a bot that has
// found a way to spend nothing could still churn. This is the belt and braces.
const MAX_ACTIONS = 20000;

interface Result {
  score: number;
  explored: number;
  rainbows: number;
  herd: number;
  kinds: number[]; // indexed by BotActionKind
  drops: number; // left in the purse when the whistle went — money that scored nothing
  candy: number;
}

function play(size: number, seed: number, strategy: BotStrategy): Result {
  const map = createGameMap(seed, size);
  resetBot(seed); // so the same board played by the same bot plays out the same way twice
  const kinds = [0, 0, 0, 0, 0];
  let actions = 0;

  while (!isRunOver(map) && actions++ < MAX_ACTIONS) {
    const action = getBotAction(map, strategy);
    if (!action) break;

    if (verbose)
      console.log(
        `  t${map.turn}/${TURN_LIMIT} ${map.drops}💧 ${map.candy}🍬 ${getScore(map)}⭐ → ${action.label} [${Math.round(action.value)}]`,
      );

    kinds[action.kind]++;
    applyBotAction(map, action);
  }

  return {
    score: getScore(map),
    explored: getExploration(map),
    rainbows: map.rainbowCount,
    herd: map.tiles.filter((tile) => tile.living === GameObjectType.UNICORN).length,
    kinds,
    drops: map.drops,
    candy: map.candy,
  };
}

const seeds = Array.from({ length: verbose ? 1 : SEED_COUNT }, (_, index) => FIRST_SEED + index);
const pad = (value: number, width: number, digits = 1) => value.toFixed(digits).padStart(width);

for (const size of sizes) {
  console.log(`\n=== ${size}x${size} · ${size} turns · ${seeds.length} seed${seeds.length > 1 ? "s" : ""} from ${FIRST_SEED} ===`);

  for (const strategy of strategies) {
    if (verbose) console.log(`\n${BOT_STRATEGY_NAMES[strategy]}:`);

    const runs = seeds.map((seed) => play(size, seed, strategy));
    const mean = (pick: (result: Result) => number) => runs.reduce((total, result) => total + pick(result), 0) / runs.length;
    // Averaged one at a time rather than inline in the line below, which prettier turns into
    // a column of fragments the moment a call is nested inside a template.
    const score = mean((result) => result.score);
    const explored = mean((result) => result.explored);
    const rainbows = mean((result) => result.rainbows);
    const herd = mean((result) => result.herd);
    const drops = mean((result) => result.drops);
    const candy = mean((result) => result.candy);
    const [steps, jumps, buys, builds] = [BotActionKind.MOVE, BotActionKind.PORTAL, BotActionKind.BUY, BotActionKind.BUILD].map((kind) =>
      mean((result) => result.kinds[kind]),
    );

    console.log(
      `${BOT_STRATEGY_NAMES[strategy].padEnd(8)} ${pad(score, 7, 0)}⭐  ${pad(explored, 5)}% seen  ${pad(rainbows, 5)}🌈 ${pad(herd, 5)}🦄  ` +
        `steps ${pad(steps, 5)} jumps ${pad(jumps, 5)} buys ${pad(buys, 5)} builds ${pad(builds, 5)}  ` +
        `unspent ${pad(drops, 5)}💧 ${pad(candy, 5)}🍬`,
    );
  }
}
