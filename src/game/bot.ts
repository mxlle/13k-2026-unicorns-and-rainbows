import {
  BASE_INCOME,
  build,
  buyUnicorn,
  canBuild,
  canUsePortal,
  countTreesBeside,
  endTurn,
  GameMap,
  getBuild,
  CHEST_CANDY,
  CHEST_DROPS,
  getUnicornPrice,
  getExploration,
  getIndex,
  getMoveCost,
  getMoveTargets,
  getPortalTargets,
  getPosition,
  getSpawnTargets,
  getTile,
  getUnicornLevel,
  isRunOver,
  isSeen,
  MAP_SIZE,
  moveCharacter,
  openChest,
  PORTAL_COST,
  Position,
  revealAround,
  TURN_LIMIT,
  updateRainbows,
} from "./game-map";
import { GameObjectType, OBJECT_CONFIG, Side, SIDE_BATHTUB, SIDE_RAINBOW, SIDE_UNICORN } from "./game-objects";

/**
 * A bot that plays the game. It has two jobs, and they are the same code:
 *
 *  - the **opponent** on the big boards, behind HAS_OPPONENT — the dark unicorn playing its
 *    own turn between the player's, on its own purse, its own fog and its own score;
 *  - the **balancing tool** it started life as, behind HAS_DEV_TOOLS — the ▶ / ⏩ buttons in
 *    the dev corner, `npm run bot` and `npm run sweep`.
 *
 * That is why it moved out of src/dev: it ships now, in any build with an opponent in it. It
 * is still not byte-golfed, because the same clarity that makes it re-tunable is what makes
 * an opponent's behaviour arguable — but it is no longer free, and `npm run build-js13k` is
 * the check on what it costs.
 *
 * It plays *fairly*: every judgement below is made from what its own side can see, off its
 * own fog. The one exception is which tiles can be stepped onto, and that is not an exception
 * at all — a fogged tile hiding a fountain is not offered as a step by the interface either,
 * so a player reading the highlights knows exactly as much as the bot does here.
 *
 * The shape of a decision is a one-ply greedy search over four kinds of thing the bot can
 * do — raise a building, buy a unicorn, take a step, end the turn — scored in one currency
 * (score points) so that they can be compared at all. Moves are scored by where they are
 * *heading* rather than by the tile they land on: a Dijkstra over the board in units of
 * water drops gives what it costs to reach every tile, every tile is valued as a place to
 * stand, and what wins is the best prize once faded by the walk to it. That is what makes it
 * set off across the board towards something rather than sniff around its own eight
 * neighbours — and the whole action is one step, so it is re-decided after every one.
 *
 * Nothing in here knows about the *other* side as a rival. It plays its own board, and the
 * competition is entirely in the board itself: a tile the other herd is standing on cannot be
 * stepped onto or lit, a site the other side has raised is spent, and a fountain whose good
 * side already holds somebody else's rainbow is worth less. That is enough — and it is the
 * honest kind of enough, since it is exactly what a player can see too.
 *
 * Every number in the tuning block is a placeholder in the CLAUDE.md sense — the point of
 * the tool is that they get turned. What they encode is what the bot *believes* the game is
 * worth, so a bot that plays badly is as interesting a result as one that plays well.
 */

// The four bots on offer. Still a plain object rather than defineEnum even though this file
// ships now: only MIXED reaches a real build — it is the opponent's strategy and the only one
// named outside HAS_DEV_TOOLS — so the object folds to the one number that is actually read,
// and registering an enum in vite.config.ts would buy nothing.
export const BotStrategy = { RANDOM: 0, EXPLORE: 1, ECONOMY: 2, MIXED: 3 } as const;
export type BotStrategy = (typeof BotStrategy)[keyof typeof BotStrategy];

export const BOT_STRATEGIES: BotStrategy[] = [BotStrategy.RANDOM, BotStrategy.EXPLORE, BotStrategy.ECONOMY, BotStrategy.MIXED];
// Indexed by strategy: the face the toggle wears and the name it goes by in the log.
export const BOT_STRATEGY_EMOJIS = ["🎲", "🧭", "💰", "⚖️"];
export const BOT_STRATEGY_NAMES = ["random", "explore", "economy", "mixed"];

/**
 * MIXED's economy weight, and the one number in this file that is a function of the board
 * rather than a constant. It falls as the board grows: `(37 - width) / 16`, which is not a
 * curve fitted to anything but the four measurements themselves — swept at 40 seeds, the best
 * economy weight came out 1.5, 1.25, 1.0 and 0.75 for widths 13, 17, 21 and 25, which is that
 * line exactly. Capped for the smaller boards, where the line would run off above 1.5 and
 * where the measurements are flat enough not to care either way.
 *
 * Why the board should matter at all: exploring is the score's multiplier, and how hard it is
 * to move depends entirely on how much board there is. A 9x9 gets to 90% seen almost whatever
 * the bot does, so weighting the fog higher buys nothing and the economy is where the points
 * are. A 25x25 is 625 tiles in 25 turns — the multiplier is genuinely hard to shift, so every
 * step into the fog is worth more than the rainbow it walks away from.
 *
 * It is also why the whole-ladder mean wanted a single [2, 1]: the big boards score in the
 * thousands and simply outvote the small ones in any average.
 */
const MIXED_ECONOMY_CAP = 1.5; // what the small boards get, and the value stored in the table
const MIXED_ECONOMY_AT_ZERO = 37; // the width at which the line would reach nothing
const MIXED_ECONOMY_SLOPE = 16; // how many tiles of width it takes to shed one point of weight

/**
 * Whether MIXED's economy weight comes off the board (normally) or is taken verbatim from
 * STRATEGY_WEIGHTS (while the sweep harness is running). Without this the sweep would go on
 * setting an entry nothing reads, and quietly stop measuring the thing it exists to measure —
 * which is the exact failure the sweep was written to catch in the first place.
 */
let usesBoardWeights = true;

export function setUsesBoardWeights(uses: boolean) {
  usesBoardWeights = uses;
}

/** What a strategy weighs the two halves of the game by, on the board being played. */
function getWeights(strategy: BotStrategy): [explore: number, economy: number] {
  const [explore, economy] = STRATEGY_WEIGHTS[strategy];
  const board = Math.min(MIXED_ECONOMY_CAP, (MIXED_ECONOMY_AT_ZERO - MAP_SIZE) / MIXED_ECONOMY_SLOPE);

  return [explore, strategy === BotStrategy.MIXED && usesBoardWeights ? board : economy];
}

/**
 * How much each half of the game a strategy cares about, as a multiplier on that half's
 * gains: [exploring, economy]. They are not normalised and do not have to add up to
 * anything — what matters is their ratio to each other and their size against the tuning
 * constants below. Random ignores both: it does not score anything at all.
 *
 * Read through getWeights rather than directly, because MIXED's economy weight is not in here:
 * it is a function of the board. See MIXED_ECONOMY_AT_ZERO.
 */
export const STRATEGY_WEIGHTS: [explore: number, economy: number][] = [
  [0, 0], // RANDOM — unused
  [1, 0.25], // EXPLORE
  [0.25, 1], // ECONOMY
  // Swept with `npm run sweep` after lollipop trees began earning per rainbow, which is what
  // made the old [0.8, 0.6] stale: with candy feeding itself, the plain `explore` bot started
  // beating `mixed` outright on the biggest boards, and a yardstick that loses to one of the
  // things it is measuring is no yardstick.
  //
  // What the sweep found, over three grids: the good region is a broad plateau defined by the
  // *ratio*, at roughly 2 parts exploring to 1 part economy, and it is flat in overall scale
  // once that is past about 3 — [2, 1], [3, 1.5], [4, 2] and [6, 3] all score within 2% of each
  // other, while ratios of 4 and above fall off a cliff. So the fix was to lean harder into the
  // fog, not to care less about money: the price constants below came out exonerated.
  // The economy half is the entry that is ignored; it is written here as the small-board cap.
  [2, MIXED_ECONOMY_CAP], // MIXED
];

// PLACEHOLDER tuning. Everything is in "score points", the unit the game's own score is in,
// so that a rainbow and a mouthful of fog can be weighed against each other at all.
// What one newly uncovered tile is worth. The honest figure is builtScore/tiles — exploring
// multiplies what has been built — but that is 0 on the opening turn, which would leave a
// bot with nothing to do on the very turn it has to start walking. A flat value instead.
const TILE_VALUE = 12;
// One water drop in hand — one step, and a step reveals a tile or two on a board with any fog
// left on it. It is also the exchange rate income is valued at: a rainbow pays its level in
// drops a turn.
//
// Was 4, on the reading that "a step is worth a fraction of a reveal". Gridded against
// CANDY_VALUE over {4, 8, 12} x {6, 12, 18} on the 13x13, 17x17 and 21x21 once a rainbow began
// earning water *or* sweets rather than both, and 4 turned out to be the single worst thing in the
// bot's beliefs: it priced a fed rainbow's sweets at three times a bare one's water, so the bot
// lit tree-side spots for the jar, ran out of drops, stopped walking, and sat on sweets it could
// no longer justify spending. At 20 seeds, raising it to 12 was worth +33% on the 13x13, +128% on
// the 17x17 and +52% on the 21x21, and it bought back the exploring the bot had given up — 55% of
// the 17x17 seen became 86%.
const DROP_VALUE = 12;
// One sweet in the jar. The same as a drop, which reads oddly for the currency that buys the
// unicorns — until you notice what a sweet actually converts to: `price` of them buy one unicorn
// and the price is the size of the herd, so a sweet is worth a whole unicorn on the opening turn
// and a thirtieth of one by the end. A flat rate has to sit somewhere in between, and every grid
// row above picked 12 whatever the drops were worth.
const CANDY_VALUE = 12;
// The loot table's odds: three outcomes, one entry each, so an unopened present is worth the
// plain mean of a pile of drops, a pile of sweets and a whole unicorn. A number rather than a
// value, because what is in a present now depends on the board it is on — see CHEST_DROPS — so
// the bot has to work out what an unopened one is worth instead of being told.
const CHEST_ODDS = 1 / 3;
// What a unicorn is worth beyond the score it carries: a second pair of eyes and a second
// light, for the rest of the run.
const UNICORN_POTENTIAL = 60;
// What a rebuilt bathtub is worth beyond the drops it pays: it is a second place to buy
// unicorns, out in the middle of the board rather than back in the corner.
const TUB_UNICORN_VALUE = 80;
/**
 * What a prize keeps of its worth per drop of walking it takes to reach — a prize six drops
 * away is worth DISTANCE_DISCOUNT^6 of what the same prize next door would be. It is what
 * makes a unicorn set off across the board at all, and turning it down makes a bot that only
 * ever picks up what is under its nose.
 *
 * Geometric rather than "worth divided by the distance", which matters: a move is worth the
 * discounted prize less the whole of what walking away gives up, and under a geometric
 * discount no pair of tiles can make both directions look profitable *while nothing else
 * changes*. That last clause is doing a great deal of work — the things a unicorn's own step
 * changes are what the three rules below exist for.
 */
const DISTANCE_DISCOUNT = 0.85;
/**
 * How much of what a unicorn gives up by leaving its tile is actually charged against the
 * move. At 1 it is charged in full, which is the honest reading of a bot that only ever looks
 * one action ahead: it cannot see "go and fetch that, then come back", so as far as it knows
 * a rainbow it walks away from is out for the rest of the run.
 *
 * That blind spot is why a lone unicorn holding a rainbow will stand there for eight turns
 * rather than walk three tiles for a present — which is a real thing about greedy play, not
 * about the board. Turn this down to make every bot more restless without touching what
 * anything is worth: it changes only how dearly a post is held, never which of two posts is
 * preferred.
 *
 * Which is also why turning it down was the wrong fix for the standing-still that DROP_VALUE = 12
 * brought with it. Gridded at {1, 0.7, 0.5, 0.3}: 0.7 did cure the idling and cost 18% of the
 * score, and 0.5 and 0.3 threw the game away entirely — because the dial is indiscriminate, and
 * the bot was not holding *every* post too dearly, only the ones paying it money it was not
 * spending. That belonged in what a drop is worth. See dropWorth.
 */
const LEAVING_WEIGHT = 1;
/**
 * How much better than the plan in progress a new idea has to be before a unicorn abandons
 * what it was doing: half again as good, as it stands. It is the one thing in here that is
 * not about what the board is worth but about how a decision taken one step at a time can
 * fail to add up to anything.
 *
 * Two ways it fails without this, both watched happening. A goal's fog is uncovered from the
 * tile *beside* it, so what a unicorn set out for is worth almost nothing by the time it is
 * one step away, while whatever lies behind it still has all of its fog — and it turns round.
 * And a post it steps off is an empty post one step away, which is a prize like any other, so
 * it gets tempted straight back onto the tile it has just decided to leave. Either way it
 * paces on the spot until the purse is empty, and every half of every decision is correct.
 *
 * The price is a little deafness: a present that turns up mid-walk is ignored unless it is
 * half again better than finishing the walk. That is the trade, and it is the right way
 * round — a bot that finishes things plays a board a person would recognise.
 */
const COMMITMENT_BREAK = 1.5;
// How long the bot is willing to stand still saving up for a building it is already next to,
// in turns. Beyond that it gives up on the plan and goes back to spending its drops on steps.
const RESERVE_PATIENCE = 3;
// Below this, the best thing the bot can think of is not worth doing and it ends the turn —
// which banks the drops for next turn rather than dribbling them away on aimless steps.
const MIN_ACTION_VALUE = 1;
/**
 * How many turns from the end money stops being worth what it cost. Neither currency is
 * part of the score, so a purse carried over the final whistle scores exactly nothing: what
 * it can still be turned into is worth having at almost any price. Prices are scaled down
 * over these last turns rather than switched off on the last one, so the bot starts spending
 * up before it is too late to walk anywhere with what it buys.
 */
const CURRENCY_HORIZON = 3;
/**
 * How many drops per unicorn count as a purse the run can still spend. Below that the next drop
 * of income is worth DROP_VALUE; above it, water is piling up faster than the herd can walk it
 * off and the surplus is worth less and less — see `dropWorth`.
 *
 * It is the income-side twin of CURRENCY_HORIZON above. That one says money left at the whistle
 * scored nothing, and discounts what a *price* costs the run near the end. This says money left
 * in the purse *turn after turn* scored nothing either, and discounts what an *income* is worth
 * while it is going unspent. Both are the same sentence about a currency being worth only what
 * it buys, read from the two ends.
 *
 * Per unicorn rather than flat, because the same purse means opposite things at the two ends of
 * a run: fifty drops behind one unicorn is a fortnight of standing still, and behind twenty it is
 * barely a turn of walking. Without that, a big board's ordinary working balance would read as a
 * glut and the bot would stop valuing water exactly when it needs it most.
 */
const SPENDABLE_PER_UNICORN = 4;

export const BotActionKind = { MOVE: 0, PORTAL: 1, BUY: 2, BUILD: 3, END_TURN: 4 } as const;
export type BotActionKind = (typeof BotActionKind)[keyof typeof BotActionKind];

/**
 * One thing the bot wants to do, in the shape the interface can carry out: `from` is what
 * is acting (the unicorn stepping, the tub selling, the site being raised) and `to` is where
 * it lands. `value` and `label` are the bot showing its working — they are what makes a run
 * readable in the console, and they are the whole reason the decision is returned as data
 * rather than simply performed.
 *
 * `goal` is where a step is ultimately headed, as a tile index — `to` is only the first step
 * of the way there. It is what the bot remembers between decisions; see `goals`.
 */
export interface BotAction {
  kind: BotActionKind;
  from?: Position;
  to?: Position;
  goal?: number;
  value: number;
  label: string;
}

// The bot's own generator, deliberately not the game's: rolling on the game's would advance
// the state that decides what a chest is holding, so simply watching the bot play would
// change the board it is playing. Seeded from the map seed all the same, so a bot run on a
// given map is repeatable.
const MODULUS = 2147483647;
let botState = 1;

/**
 * Where each unicorn is headed, as tile index → tile index — the first of the three things
 * the bot remembers, and all three exist for the same reason: a decision re-taken from
 * scratch every step has no way to *finish* anything. A goal's fog is uncovered as soon as a
 * unicorn is beside it rather than on it, so what it set off for is worth almost nothing by
 * the time it gets close, while whatever lies behind it still has all of its own. Two prizes
 * on opposite sides and it steps between them until the purse is empty, reaching neither.
 * This is what a plan in progress is kept in; see COMMITMENT_BREAK for what it buys.
 *
 * Keyed by where the unicorn is standing, since that is the only name a unicorn has. Kept up
 * to date by rememberGoal, which every decision goes through. A player moving a unicorn by
 * hand in between can leave an entry behind on a tile — worth nothing worse than one
 * inherited plan for whoever wanders onto it next.
 */
const goals = new Map<number, number>();
/**
 * Everywhere each unicorn has stood this turn, in the same keying: the trail travels with the
 * unicorn, so the entry under a tile is the story of whoever is standing on it. It is the
 * other half of the problem above, and the half a plan cannot fix — a goal one step away is
 * *reached* in one step, so there is never a plan in progress to hold on to. A unicorn steps
 * off a post onto something next door, and the post, empty again and one step away and worth
 * exactly what it always was, is the best thing on the board again. Back it goes, and round
 * it goes, all turn.
 *
 * So: a tile a unicorn has already stood on this turn is not a destination worth paying to
 * reach. If it were, the unicorn would not have left it. It may still be walked *through* on
 * the way to somewhere else, which is why this bans a goal rather than a step — and it is
 * forgotten at the turn boundary, so a post given up to open a present is not given up for
 * good. It is the only rule in here that is about the shape of the search rather than about
 * the game, and it is what finally stopped the pacing.
 */
const trails = new Map<number, number[]>();
// Both maps above are keyed by tile index and a tile holds one unicorn, so the two sides
// cannot collide in them however many herds are walking about — no per-side keying needed.
// These two are a different matter: they are per *side*, because each side's turn begins at a
// different moment and its board earns a different amount.
const lastTurn = [0, 0];
/**
 * What the board could pay with when the turn began: the purse, the jar, and what the two
 * incomes were paying. Whether a building is worth caring about is judged against this rather
 * than against the live numbers, and the reason is a loop that took some finding.
 *
 * A tub site is only worth walking to if the run can still pay for it, and paying for it needs
 * candy, and the candy income comes from a lollipop tree lit by a rainbow — which was being
 * cast by the very unicorn setting off to build the tub. One step and its rainbow went out,
 * the jar's income fell to nothing, the site it was walking to became unaffordable and
 * therefore worthless, and the best thing on the board was the tile it had just left. Back it
 * went, the rainbow came on, the site was worth 120 again — and so on until the drops ran out.
 * What the board earns is a fact about the turn, not about the step, and reading it once a
 * turn is both truer and unshakeable.
 */
const income = [0, 1].map(() => ({ drops: 0, candy: 0, dropIncome: 0, candyIncome: 0, herd: 0 }));

export function resetBot(seed: number) {
  botState = ((Math.imul(seed, 2654435761) >>> 0) % (MODULUS - 1)) + 1;
  goals.clear(); // a new board, and nobody on it is on their way anywhere
  trails.clear();
  lastTurn[0] = lastTurn[1] = 0; // so each side's first decision reads the board's income afresh
}

function botRandom(): number {
  botState = (botState * 16807) % MODULUS;

  return botState / MODULUS;
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(botRandom() * items.length)];
}

/**
 * Whether the `count`-th thing found to be worth exactly as much as the best so far should take
 * its place — true with probability 1/count, which leaves every one of a run of equals with the
 * same chance of being the one picked.
 *
 * It exists because the alternative is not "no tie-break" but "the first one scanned", and the
 * scan is row-major: ties went to the tile nearest the top-left corner of the board. That is a
 * tailwind for whichever herd lives in the *opposite* corner — its ties point out into the open
 * board, while the other side's point back into ground it has already walked. Measured on the
 * 21x21 over 40 seeds it was worth about 13% of the score to the dark side, and reversing the
 * scan handed light 10% instead: the same code, playing both sides, was not playing them the
 * same game. The board is mirror-symmetric by construction (see `mirror`), and this is what
 * stops the bot's own reading of it from having a direction.
 *
 * Seeded, like everything else the bot rolls, so a board still replays exactly.
 */
function pickTie(count: number): boolean {
  return botRandom() * count < 1;
}

/**
 * What the bot would do next, or undefined once the run is over. Nothing is applied here —
 * the caller carries the action out through the same paths a tap goes through, so the bot
 * can only ever do things a player could have done, and it sees the same animations.
 */
export function getBotAction(map: GameMap, strategy: BotStrategy, side: Side): BotAction | undefined {
  if (isRunOver(map)) return undefined;

  // A new turn for this side: the board has paid it out, everybody may think again about where
  // they have been, and what the board earns is read afresh. Per side, because the two sides'
  // turns begin at different moments and the trail a unicorn is forbidden to head back to is
  // forgotten at *its own* turn boundary.
  if (map.turn !== lastTurn[side]) {
    lastTurn[side] = map.turn;
    getUnicorns(map, side).forEach((position) => trails.delete(getIndex(position)));
    income[side] = {
      drops: map.drops[side],
      candy: map.candy[side],
      dropIncome: map.dropIncome[side],
      candyIncome: map.candyIncome[side],
      // How many pairs of legs there are to walk the purse off with — read here with everything
      // else it is judged against, and for the same reason: it must not shift under a step.
      herd: getUnicorns(map, side).length,
    };
  }

  const action = strategy === BotStrategy.RANDOM ? pickRandom(getLegalActions(map, side)) : getBestAction(map, getWeights(strategy), side);
  rememberGoal(action);

  return action;
}

/**
 * Files the plan the action just committed to: whoever was standing on `from` is not there
 * any more, and whoever ends up on `to` is on their way to `goal` — unless `goal` is `to`
 * itself, which means they have arrived and are free to think again.
 *
 * Done here rather than by the caller because every caller applies what it is given; the
 * interface's ▶ and the harness both act on the action they asked for. A caller that asked
 * and then did nothing would leave the bot believing in a step that was never taken.
 */
function rememberGoal({ kind, from, to, goal }: BotAction) {
  if (!from) return;

  const fromIndex = getIndex(from);
  const trail = trails.get(fromIndex) ?? [fromIndex];
  goals.delete(fromIndex);
  trails.delete(fromIndex);

  if (kind !== BotActionKind.MOVE && kind !== BotActionKind.PORTAL) return;

  const toIndex = getIndex(to!);
  trails.set(toIndex, [...trail, toIndex]);
  if (goal !== undefined && goal !== toIndex) goals.set(toIndex, goal);
}

/**
 * Carries an action out on the model alone, for the harness — no selection, no animation, no
 * sound. The interface does NOT go through here: it plays a bot action through its own
 * select / move / buy / raise, so that the bot can only ever do what a tap can do and the
 * player watches the same board a person would.
 *
 * Which makes this the one place in the bot that says a second time what the game already
 * says once, and the one place that can quietly fall out of step. It is a transcription of
 * `move`, `buy`, `raise` and `finishTurn` in game-map.component.ts with the presentation
 * taken out — if those change, change this, and if a new kind of action is added it has to
 * be added in both.
 */
export function applyBotAction(map: GameMap, action: BotAction, side: Side) {
  if (action.kind === BotActionKind.END_TURN) return endTurn(map, side);
  if (action.kind === BotActionKind.BUILD) return build(map, action.from!, side);
  if (action.kind === BotActionKind.BUY) return buyUnicorn(map, action.to!, side);

  map.drops[side] -= action.kind === BotActionKind.PORTAL ? PORTAL_COST : getMoveCost(map, action.to!, side);
  moveCharacter(map, action.from!, action.to!);
  openChest(map, action.to!, side); // before the fog and the light: a present can hold a unicorn
  revealAround(map, action.to!, side);
  updateRainbows(map);
}

/** Where this side's herd is — only the ones out in its own open, which today is all of them. */
function getUnicorns(map: GameMap, side: Side): Position[] {
  const positions: Position[] = [];

  map.tiles.forEach((tile, index) => {
    if (tile.living === SIDE_UNICORN[side] && isSeen(tile, side)) positions.push(getPosition(index));
  });

  return positions;
}

/**
 * Whether a character is standing in the surrounding 3x3 — the game's own build condition.
 * `ignore` leaves one tile out of the count, and it is always the tile the unicorn being
 * moved is standing on: a site is being asked whether it would *still* have somebody beside
 * it once that unicorn has walked off, which is a different question from whether it has one
 * now, and it is the difference between the bot staying put and pacing back and forth.
 */
function hasUnicornNeighbour(map: GameMap, { x, y }: Position, side: Side, ignore?: Position): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const position = { x: x + dx, y: y + dy };
      const isIgnored = ignore && ignore.x === position.x && ignore.y === position.y;

      // One of *ours*, matching the game's own build condition: the other side's unicorn
      // standing beside a site does not raise it for us, so a bot that counted it would sit
      // waiting for a build that nobody was ever going to make.
      if ((dx || dy) && !isIgnored && getTile(map, position)?.living === SIDE_UNICORN[side]) return true;
    }
  }

  return false;
}

/**
 * Every legal action on the board right now, ending the turn included. It is the random
 * bot's whole decision — and the definition of "legal" the scoring bot is held to, since
 * every candidate it invents has to be one of these.
 */
function getLegalActions(map: GameMap, side: Side): BotAction[] {
  const actions: BotAction[] = [{ kind: BotActionKind.END_TURN, value: 0, label: "end turn" }];

  getUnicorns(map, side).forEach((from) => {
    getMoveTargets(map, from)
      .filter((to) => getMoveCost(map, to, side) <= map.drops[side])
      .forEach((to) => actions.push({ kind: BotActionKind.MOVE, from, to, value: 0, label: `step to ${say(to)}` }));

    // One action per far donut: a board with four of them offers three jumps from any one.
    getPortalTargets(map, from, side)
      .filter((to) => canUsePortal(map, to, side))
      .forEach((to) => actions.push({ kind: BotActionKind.PORTAL, from, to, value: 0, label: `jump to ${say(to)}` }));
  });

  map.tiles.forEach((tile, index) => {
    if (!isSeen(tile, side)) return;
    const position = getPosition(index);

    // Our own tub only — the other side's sells to the other side, and its fields are priced
    // against a jar we do not hold.
    if (tile.object === SIDE_BATHTUB[side])
      getSpawnTargets(map, position).forEach((to) =>
        actions.push({ kind: BotActionKind.BUY, from: position, to, value: 0, label: "buy a unicorn" }),
      );

    if (getBuild(tile.object) && canBuild(map, position, side))
      actions.push({ kind: BotActionKind.BUILD, from: position, value: 0, label: `build on ${say(position)}` });
  });

  return actions;
}

function say({ x, y }: Position): string {
  return `${x},${y}`;
}

/**
 * Where the rainbows a glower standing on `position` accounts for are — as positions rather
 * than a count, because a rainbow beside a lollipop tree is worth more than one that is not.
 * `lit` picks which question is being asked: the ones shining there right now, which walking
 * away would put out, or the ones that are not there yet and would appear if something walked in.
 *
 * Only fountains the player has found are counted, which is the fair-play rule — the game
 * itself would light a rainbow off a fogged fountain, but the bot has no business planning
 * for one it cannot see. The lit count is an over-estimate where two unicorns are lighting
 * the same rainbow between them, which is rare enough to leave alone.
 */
function getRainbows(map: GameMap, { x, y }: Position, lit: boolean, side: Side): Position[] {
  const rainbows: Position[] = [];

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const fountain = getTile(map, { x: x + dx, y: y + dy });
      if ((!dx && !dy) || !isSeen(fountain, side) || fountain!.object !== GameObjectType.FOUNTAIN) continue;

      const position = { x: x + 2 * dx, y: y + 2 * dy };
      const target = getTile(map, position);
      if (!target) continue;

      // Only ours count as lit, and only a genuinely *empty* tile counts as lightable — which
      // is where the whole contest over a fountain lands in the value model without a word
      // about the opponent. A side of a fountain already holding somebody else's rainbow is
      // occupied ground: walking there buys nothing, so the bot goes elsewhere.
      if (lit ? target.object === SIDE_RAINBOW[side] : target.object === undefined && target.living === undefined) rainbows.push(position);
    }
  }

  return rainbows;
}

/** How much of this side's own fog a character standing here would lift — its own tile included. */
function countFog(map: GameMap, { x, y }: Position, side: Side): number {
  let count = 0;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const tile = getTile(map, { x: x + dx, y: y + dy });
      if (tile && !isSeen(tile, side)) count++;
    }
  }

  return count;
}

/**
 * Whether a fountain here could ever carry a rainbow: somewhere to stand on one side of it
 * and an empty tile directly opposite. A rebuilt fountain with neither is worth nothing, and
 * the bot has to be able to see that before it spends six drops finding out.
 */
function hasRainbowSpot(map: GameMap, { x, y }: Position): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const target = getTile(map, { x: x + dx, y: y + dy });
      if ((!dx && !dy) || !target) continue;

      if (target.object === undefined && target.living === undefined && canStand(map, { x: x - dx, y: y - dy })) return true;
    }
  }

  return false;
}

/**
 * Whether a unicorn could stand on this tile — asked of the tile itself rather than of a
 * step onto it, which is what the game's getMoveTargets answers. Read off the game's own
 * table, so a new object that blocks movement is accounted for here without being mentioned.
 */
function canStand(map: GameMap, position: Position): boolean {
  const tile = getTile(map, position);

  return !!tile && tile.living === undefined && (tile.object === undefined || !OBJECT_CONFIG[tile.object].blocksMove);
}

/**
 * How many sweets a turn a lollipop tree grown here would earn — one per rainbow beside it,
 * which is the game's own rule. A fountain beside it with no rainbow on this side yet counts
 * for one: the light is not there, but it is the light this seedling is being offered for,
 * and a bot that would not grow a tree until the rainbow already existed would never grow one
 * next to rubble it was about to rebuild.
 *
 * Deliberately the smaller of the two guesses where both apply — a tree already catching two
 * rainbows is worth two, not two plus its fountains — because the fountain term is a promise
 * and the rainbow term is a fact.
 */
function countFeeding(map: GameMap, { x, y }: Position, side: Side): number {
  let rainbows = 0;
  let fountains = 0;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const object = getTile(map, { x: x + dx, y: y + dy })?.object;
      if (!dx && !dy) continue;
      // Ours only: the tree is neutral and would happily earn off the other side's light, but
      // it would be earning for *them*. A seedling whose only neighbour is a dark rainbow is
      // a tree that pays somebody else, which is worth nothing to grow.
      if (object === SIDE_RAINBOW[side]) rainbows++;
      else if (object === GameObjectType.FOUNTAIN || object === GameObjectType.FOUNTAIN_SITE) fountains++;
    }
  }

  return rainbows || Math.min(fountains, 1);
}

/**
 * What it costs to reach every tile on the board from `start`, counted in water drops —
 * which is the honest unit, since drops are what steps are paid in and what the board pays
 * out. A flower is a free edge, the portal is an edge of its own worth PORTAL_COST, and
 * everything else costs a drop.
 *
 * `first` is what makes the result actionable: for every tile it holds the very first step
 * of the cheapest way there, so a goal picked forty drops away still comes back as one tap.
 * `viaPortal` says whether that first step is a jump rather than a step, because the two are
 * different actions at the interface even though they are the same edge here.
 *
 * A plain scan for the cheapest open tile rather than a heap: the board tops out at 625
 * tiles and this is a dev tool.
 */
function getReach(map: GameMap, start: Position, side: Side) {
  const size = MAP_SIZE * MAP_SIZE;
  const cost = Array<number>(size).fill(Infinity);
  const first = Array<number>(size).fill(-1);
  const viaPortal = Array<boolean>(size).fill(false);
  const done = Array<boolean>(size).fill(false);
  const startIndex = getIndex(start);

  cost[startIndex] = 0;

  for (;;) {
    let current = -1;

    for (let index = 0; index < size; index++) {
      if (!done[index] && cost[index] < (current < 0 ? Infinity : cost[current])) current = index;
    }

    if (current < 0) break;
    done[current] = true;

    const position = getPosition(current);
    const step = (target: Position, price: number, isPortal: boolean) => {
      const index = getIndex(target);
      if (cost[current] + price >= cost[index]) return;

      cost[index] = cost[current] + price;
      // the first step of the way here is this one if we are still standing at the start,
      // and otherwise whatever the first step of the way to `current` was
      first[index] = current === startIndex ? index : first[current];
      viaPortal[index] = current === startIndex ? isPortal : viaPortal[current];
    };

    getMoveTargets(map, position).forEach((target) => step(target, getMoveCost(map, target, side), false));

    // Every donut is an edge like any other, so a goal on the far side of the board comes out
    // cheap the moment the bot is standing on one — which is exactly what they are for. With
    // three or four of them the edges chain, and the search walks a route through the network
    // for nothing: this runs at every tile it settles, not only at the start.
    getPortalTargets(map, position, side).forEach((target) => {
      if (getTile(map, target)!.living === undefined) step(target, PORTAL_COST, true);
    });
  }

  return { cost, first, viaPortal };
}

/**
 * The scoring bot. Every candidate is priced in score points and the best one wins; if the
 * best one is not worth having, the turn ends instead. A move is worth what is waiting at
 * the end of it, faded by how far off that is (DISTANCE_DISCOUNT), less everything the
 * unicorn gives up by leaving where it stands — so setting off across the board and staying
 * put are compared as the two things they are, and a unicorn holding a rainbow up needs a
 * good reason to stop.
 */
function getBestAction(map: GameMap, [explore, economy]: [explore: number, economy: number], side: Side): BotAction {
  // Every payout still to come. endTurn pays on every turn but the last, so this is exactly
  // how many times a stream of income will actually be paid.
  const turnsLeft = TURN_LIMIT - map.turn;
  // What one more rainbow or one more unicorn adds to the score as the board stands, which
  // the game now states directly: each is worth one point per percent of the board uncovered.
  // The same number as before the score was rewritten — the two forms agree exactly — so
  // every tuning constant below is still in the units it was tuned in.
  const thingValue = getExploration(map, side);
  /**
   * What one drop is actually worth to this side right now — DROP_VALUE while the purse is one
   * the herd can still walk off, and less and less as it piles up past that. See
   * SPENDABLE_PER_UNICORN.
   *
   * This is the whole of the fix for a bot that would post its one unicorn on a bare rainbow and
   * stand there for eleven turns with fifty drops in hand. Holding that post is worth every turn
   * of water it will ever pay, charged in full against walking away from it (LEAVING_WEIGHT), so
   * nothing on the board could ever beat it — while the drops it was paid sat there buying
   * nothing. Now the pile itself is what makes the post cheap to leave, the unicorn walks, the
   * purse empties, and water is worth holding a post for again. It corrects itself, in both
   * directions, without a dial to set.
   *
   * Read off the turn's snapshot rather than the live purse, like everything else judged against
   * money here: a value that fell as a unicorn spent its own drops walking would be a value that
   * changes under the deciding unicorn's feet, which is how the pacing bugs start.
   */
  const dropWorth = DROP_VALUE * Math.min(1, (SPENDABLE_PER_UNICORN * income[side].herd) / Math.max(1, income[side].drops));
  // What a rainbow is worth to a *newcomer*: it scores, and it pays a drop a turn. A grown
  // unicorn's is worth more, which is what getRainbowsValue takes a level for — this is the
  // level-1 reading, and the one thing that reads it directly is a fountain site, whose light
  // is whoever's happens to reach it later rather than anybody's in particular.
  const rainbowValue = thingValue + turnsLeft * dropWorth;
  const unicornValue = thingValue + UNICORN_POTENTIAL;
  // What a price actually costs the run, which is not what it costs the purse: money left
  // over at the end is money that scored nothing. See CURRENCY_HORIZON.
  const spendability = Math.min(1, turnsLeft / CURRENCY_HORIZON);
  const dropPrice = dropWorth * spendability;
  const candyPrice = CANDY_VALUE * spendability;
  // A unicorn is both halves of the game at once: another pair of eyes and another light.
  // So it is bought on the average of the two weights rather than under either of them.
  const unicornWeight = (explore + economy) / 2;
  // What an unopened present is worth: its three outcomes at their odds, priced in what this
  // board's presents actually hold. It used to be a flat 70, which was fine while the contents
  // were flat too — now a 25x25 present carries five times a 5x5 one and the bot has to know.
  const chestValue = CHEST_ODDS * (CHEST_DROPS * dropWorth + CHEST_CANDY * CANDY_VALUE + unicornValue);

  /**
   * What a set of rainbows cast by a `level` unicorn is worth. Every one of them scores, and
   * pays its level in drops a turn, and pays a lollipop tree beside it the same again in sweets —
   * so which side of a fountain gets lit is a real choice, and a grown unicorn holding a post is
   * worth several times a newcomer holding the same one. A bot pricing them all alike could see
   * neither. That is the whole reason the rainbows are carried around as positions.
   *
   * The score half does not scale: a rainbow is one thing built however big it is, which is what
   * the game's own score says.
   *
   * Water *or* sweets, never both — see getRainbowDrops, which is the rule this mirrors. A bot
   * counting both would light the tree side for the pair of them and then wonder where the purse
   * went, so which side of a fountain gets lit is a choice here in the same way it is on the
   * board: sweets if a tree is beside it, water if not.
   */
  const getRainbowsValue = (rainbows: Position[], level: number) =>
    rainbows.reduce((total, rainbow) => {
      const trees = countTreesBeside(map, rainbow, side);
      const perTurn = trees ? trees * CANDY_VALUE : dropWorth;

      return total + thingValue + level * turnsLeft * perTurn;
    }, 0);

  /**
   * What raising a site is worth, already carrying its own strategy weight — the tub is the
   * reason for that: filling it takes the clouds off its own square (see build()), which is
   * an *exploring* gain sitting inside an economy building, and the two halves cannot share
   * one multiplier applied by the caller.
   */
  const getBuildValue = (objectType: GameObjectType, position: Position) => {
    if (objectType === GameObjectType.TUB_SITE)
      return economy * (turnsLeft * BASE_INCOME * dropWorth + TUB_UNICORN_VALUE) + explore * countFog(map, position, side) * TILE_VALUE;
    if (objectType === GameObjectType.FOUNTAIN_SITE) return economy * (hasRainbowSpot(map, position) ? rainbowValue : 0);

    // A lollipop tree: one sweet a turn per rainbow it catches, so a spot that would catch two
    // is worth twice a spot that would catch one, and a spot with no light at all is worth
    // nothing at any price.
    return economy * turnsLeft * CANDY_VALUE * countFeeding(map, position, side);
  };

  /**
   * Whether the purse and the jar will have covered a price `turns` turns from now, at what
   * the board was earning when this turn began. It is what keeps the bot from walking across
   * the map to a building it could never pay for, and from standing next to one waiting for
   * money that is not coming — and it reads `income` rather than the live counters on purpose,
   * because the live ones answer differently depending on where the unicorn asking is standing.
   * See `income`.
   */
  const isAffordable = (dropCost: number, candyCost: number, turns: number) =>
    income[side].drops + income[side].dropIncome * turns >= dropCost && income[side].candy + income[side].candyIncome * turns >= candyCost;

  const candidates: BotAction[] = [];

  // What the bot is saving up for: the drops of a building it is already standing next to and
  // can only just not afford. While that is on, its drops are spoken for — see below.
  let reserve = 0;

  map.tiles.forEach((tile, index) => {
    if (!isSeen(tile, side)) return;
    const position = getPosition(index);
    const build = getBuild(tile.object);

    if (build) {
      const [built, dropCost, candyCost] = build;
      const gain = getBuildValue(tile.object!, position); // already weighted — see getBuildValue
      const value = gain - dropCost * dropPrice - candyCost * candyPrice;

      if (canBuild(map, position, side)) {
        if (value > 0)
          candidates.push({
            kind: BotActionKind.BUILD,
            from: position,
            value,
            label: `build ${OBJECT_CONFIG[built].emoji} at ${say(position)}`,
          });
      } else if (
        // Not affordable yet, but a unicorn is already in place and the income will cover it
        // before the bot's patience runs out — so hold on to the drops instead of walking
        // them away. Only the drops: a building waiting on sweets is not delayed by steps.
        value > 0 &&
        dropCost > reserve &&
        hasUnicornNeighbour(map, position, side) &&
        isAffordable(dropCost, candyCost, RESERVE_PATIENCE)
      ) {
        reserve = dropCost;
      }
    }

    if (tile.object === SIDE_BATHTUB[side]) {
      const price = getUnicornPrice(map, side);

      getSpawnTargets(map, position).forEach((to) => {
        // Where the newcomer is put matters as much as buying it: a field with fog around it
        // or a fountain beside it is worth more than the next one along.
        const gain =
          unicornWeight * unicornValue +
          explore * countFog(map, to, side) * TILE_VALUE +
          economy * getRainbowsValue(getRainbows(map, to, false, side), 1); // a newcomer starts at level 1
        const value = gain - price * candyPrice;

        if (value > 0)
          candidates.push({ kind: BotActionKind.BUY, from: position, to, value, label: `buy a unicorn onto ${say(to)} for ${price}` });
      });
    }
  });

  /**
   * What the board gets out of a unicorn *standing* on this tile: the rainbows it casts and
   * the build sites its presence unlocks. `lit` picks which rainbows are meant — the ones
   * already shining, which is the question asked of the tile a unicorn is on now, or the
   * ones not there yet, which is the question asked of a tile it might walk to.
   *
   * The same function answers both, and that is the point: a move is worth the standing
   * value of where it goes less the standing value of where it came from, so a unicorn only
   * ever leaves a post for a better one. `ignore` is that unicorn's own tile, left out of
   * "does this site already have somebody beside it" — without it a site goes worthless the
   * moment its unicorn arrives, and the bot turns straight round and paces back and forth
   * for the rest of the run.
   *
   * `level` is how grown the unicorn in question is — the one standing here, or the one that
   * would walk here — because what a post is worth now depends on who is holding it. It is the
   * mover's own level in both halves of a move, which is what keeps the comparison honest: the
   * same unicorn is being priced in the tile it leaves and the tile it goes to.
   */
  const getStandingValue = (position: Position, lit: boolean, ignore: Position, level: number) => {
    let value = economy * getRainbowsValue(getRainbows(map, position, lit, side), level);

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const site = { x: position.x + dx, y: position.y + dy };
        const build = getBuild(getTile(map, site)?.object);

        if ((!dx && !dy) || !build || !isSeen(getTile(map, site), side) || hasUnicornNeighbour(map, site, side, ignore)) continue;
        // Only sites the run can still pay for. One it cannot is not worth walking to, and
        // is certainly not worth standing next to for the rest of the game.
        if (isAffordable(build[1], build[2], turnsLeft)) value += getBuildValue(getTile(map, site)!.object!, site);
      }
    }

    return value; // both halves already carry their own weight
  };

  /** What walking to a tile is worth: the fog it lifts, what is lying on it, what it posts a unicorn to. */
  const getGoalGain = (position: Position, from: Position) => {
    const tile = getTile(map, position)!;
    let gain =
      explore * countFog(map, position, side) * TILE_VALUE + getStandingValue(position, false, from, getUnicornLevel(getTile(map, from)!));

    // A present is worth walking to whichever bot is playing: it is drops, sweets or a whole
    // unicorn, and every one of those is worth having.
    if (isSeen(tile, side) && tile.object === GameObjectType.CHEST) gain += unicornWeight * chestValue;

    return gain;
  };

  getUnicorns(map, side).forEach((from) => {
    const { cost, first, viaPortal } = getReach(map, from, side);
    const fromIndex = getIndex(from);
    const committed = goals.get(fromIndex); // where this one was already headed, if anywhere
    const walked = trails.get(fromIndex); // and everywhere it has been since the turn began
    // What walking away costs: the rainbows this unicorn is holding up go out behind it and
    // the site it is standing beside loses the hands that were going to raise it. Charged
    // against every goal alike, which is what keeps a posted unicorn at its post.
    const leaving = LEAVING_WEIGHT * getStandingValue(from, true, from, getUnicornLevel(getTile(map, from)!));
    // The best this unicorn could do, and the step that carries on with what it was already
    // doing. Only one of the two is ever offered — see the choice below.
    let best: BotAction | undefined;
    let planned: BotAction | undefined;
    let ties = 0; // how many candidates share `best`'s value, for pickTie

    map.tiles.forEach((_, index) => {
      // Not the tile it is on, not one it has already stood on this turn, nothing out of reach.
      if (index === fromIndex || walked?.includes(index) || !isFinite(cost[index])) return;

      const to = getPosition(first[index]);
      const isPortal = viaPortal[index];
      const stepCost = isPortal ? PORTAL_COST : getMoveCost(map, to, side);

      // The step has to be one the interface would actually offer: paid for, and — for a
      // jump — with nobody standing on the far donut.
      if (stepCost > map.drops[side] || (isPortal && !canUsePortal(map, to, side))) return;
      // And the walk has to be one the purse can actually finish. A goal further off than
      // there are drops to reach it is not a plan, it is a wish — and it was the source of
      // the bot's silliest habit: with an empty purse the only affordable step is a free one
      // over a flower, so it would shuffle on and off the flower "on its way" to something it
      // could not have reached in a hundred turns. Anything out of reach is simply not
      // considered; next turn the board pays out and it may well be in reach then.
      if (cost[index] > map.drops[side]) return;
      // Drops that are spoken for by a building are not available for walking — but only the
      // ones that are actually needed. What this used to say was "while anything is being
      // saved for, no step may cost anything", which froze a unicorn standing beside a site
      // it could already afford the water for and was only waiting on sweets for: it had
      // forty drops, could not spend one of them, and shuffled on and off the flower next to
      // it until the turn ended. A step is fine as long as it leaves the building's water in
      // the purse; a free one over a flower is fine regardless.
      if (stepCost && map.drops[side] - stepCost < reserve) return;

      const value = getGoalGain(getPosition(index), from) * DISTANCE_DISCOUNT ** cost[index] - leaving;

      if (value <= MIN_ACTION_VALUE) return;

      const candidate: BotAction = {
        kind: isPortal ? BotActionKind.PORTAL : BotActionKind.MOVE,
        from,
        to,
        goal: index,
        value,
        label:
          `${isPortal ? "jump" : "step"} ${say(from)} → ${say(to)}, heading for ${say(getPosition(index))} ` +
          `(${cost[index]}💧 away${index === committed ? ", as planned" : ""})`,
      };

      if (index === committed) planned = candidate;

      // Ties go to nobody in particular — see `pickTie`. Two tiles worth exactly the same is the
      // commonest thing on an early board, where most of what a step is worth is the fog it
      // lifts and every direction out of a corner lifts the same amount.
      if (!best || value > best.value) {
        best = candidate;
        ties = 1;
      } else if (value === best.value && pickTie(++ties)) best = candidate;
    });

    // One offer per unicorn, and it is the plan already under way unless something is a good
    // deal better. Carrying on has to be a decision rather than a bonus on a score, because
    // what it is up against is not a rival plan but the unicorn's own last position: a post
    // it steps off is empty again, and an empty post one step away is a prize like any other,
    // so it gets tempted straight back onto the tile it has just decided to leave. That is a
    // loop no weighting settles, since both halves of it are correct in isolation.
    const move = planned && (!best || best.value < planned.value * COMMITMENT_BREAK) ? planned : best;

    if (move) candidates.push(move);
  });

  let best: BotAction | undefined;
  let bestTies = 0;

  candidates.forEach((action) => {
    if (!best || action.value > best.value) {
      best = action;
      bestTies = 1;
    } else if (action.value === best.value && pickTie(++bestTies)) best = action;
  });

  // Nothing worth doing: bank the drops and let the board pay out. It is also the only way a
  // turn can ever end, so a bot that finds nothing to do still plays the run to its end.
  return best && best.value >= MIN_ACTION_VALUE
    ? best
    : { kind: BotActionKind.END_TURN, value: 0, label: "end turn — nothing worth doing" };
}
