import {
  createGameMap,
  getExploration,
  getScore,
  HAS_RIVAL,
  isRunOver,
  MAP_SIZES,
  nextTurn,
  setRivalEnabled,
  TURN_LIMIT,
} from "../src/game/game-map";
import { PLAYER, RIVAL, Side, SIDE_UNICORN } from "../src/game/game-objects";
import { applyBotAction, BOT_STRATEGIES, BOT_STRATEGY_NAMES, BotActionKind, BotStrategy, getBotAction, resetBot } from "../src/game/bot";

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
 *   npm run bot -- --solo                the opponent switched off on every board
 *
 * The opponent changes what this measures on the boards it turns up on (21x21 and 25x25): the
 * bot under test is no longer alone on the map, so its score there is a score against
 * somebody. Those rows print an extra 🌑 column with what the rival came out at, and the
 * strategy under test is what plays *both* sides — which is the honest comparison, since a
 * strategy that beats mixed by being greedier has to beat it while mixed is being greedy back.
 * `--solo` is the old reading, and the one to use when a price or an income has moved and the
 * question is what the board is worth rather than who wins on it.
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

// The opponent off on every board, for reading what the board itself is worth rather than who
// wins on it. Set once, before any map is built — HAS_RIVAL is worked out in setMapSize.
if (flag("solo")) setRivalEnabled(false);

interface Result {
  score: number;
  rivalScore: number; // 0 on a board with nobody on it to race
  explored: number;
  rainbows: number;
  herd: number;
  kinds: number[]; // indexed by BotActionKind
  drops: number; // left in the purse when the whistle went — money that scored nothing
  candy: number;
}

/**
 * One side playing until it runs out of things worth doing. It is where a turn actually ends:
 * the bot decides that for itself, exactly as it does with a person watching, and END_TURN is
 * the last action of the go rather than something the harness imposes.
 *
 * Returns how many actions it took, so the outer loop's runaway guard still counts every
 * action in the run rather than every turn.
 */
function playGo(map: ReturnType<typeof createGameMap>, strategy: BotStrategy, side: Side, kinds: number[], budget: number): number {
  let actions = 0;

  while (actions < budget) {
    const action = getBotAction(map, strategy, side);
    if (!action) break;
    actions++;

    if (verbose && side === PLAYER)
      console.log(
        `  t${map.turn}/${TURN_LIMIT} ${map.drops[side]}💧 ${map.candy[side]}🍬 ${getScore(map, side)}⭐ → ` +
          `${action.label} [${Math.round(action.value)}]`,
      );

    if (side === PLAYER) kinds[action.kind]++; // the counts describe the bot under test, not its rival
    applyBotAction(map, action, side);
    if (action.kind === BotActionKind.END_TURN) break;
  }

  return actions;
}

function play(size: number, seed: number, strategy: BotStrategy): Result {
  const map = createGameMap(seed, size);
  resetBot(seed); // so the same board played by the same bot plays out the same way twice
  const kinds = [0, 0, 0, 0, 0];
  let actions = 0;

  // A turn is now every side's go, then the clock. Without an opponent that is one go and a
  // tick, which is exactly what the flat loop here used to be.
  while (!isRunOver(map) && actions < MAX_ACTIONS) {
    const sides: Side[] = HAS_RIVAL ? [PLAYER, RIVAL] : [PLAYER];
    for (const side of sides) actions += playGo(map, strategy, side, kinds, MAX_ACTIONS - actions);
    nextTurn(map);
  }

  return {
    score: getScore(map, PLAYER),
    rivalScore: HAS_RIVAL ? getScore(map, RIVAL) : 0,
    explored: getExploration(map, PLAYER),
    rainbows: map.rainbowCounts[PLAYER],
    herd: map.tiles.filter((tile) => tile.living === SIDE_UNICORN[PLAYER]).length,
    kinds,
    drops: map.drops[PLAYER],
    candy: map.candy[PLAYER],
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
    const rivalScore = mean((result) => result.rivalScore);
    const explored = mean((result) => result.explored);
    const rainbows = mean((result) => result.rainbows);
    const herd = mean((result) => result.herd);
    const drops = mean((result) => result.drops);
    const candy = mean((result) => result.candy);
    const [steps, jumps, buys, builds] = [BotActionKind.MOVE, BotActionKind.PORTAL, BotActionKind.BUY, BotActionKind.BUILD].map((kind) =>
      mean((result) => result.kinds[kind]),
    );

    // The rival column only on the boards that have one, so the ladder's other rows keep the
    // exact shape they have always had and are still readable against last week's run.
    const rival = HAS_RIVAL ? ` ${pad(rivalScore, 6, 0)}🌑` : "";

    console.log(
      `${BOT_STRATEGY_NAMES[strategy].padEnd(8)} ${pad(score, 7, 0)}⭐${rival}  ${pad(explored, 5)}% seen  ` +
        `${pad(rainbows, 5)}🌈 ${pad(herd, 5)}🦄  ` +
        `steps ${pad(steps, 5)} jumps ${pad(jumps, 5)} buys ${pad(buys, 5)} builds ${pad(builds, 5)}  ` +
        `unspent ${pad(drops, 5)}💧 ${pad(candy, 5)}🍬`,
    );
  }
}
