import {
  BASE_INCOME,
  build,
  buyUnicorn,
  canBuild,
  canUsePortal,
  endTurn,
  GameMap,
  getBuild,
  getCandyPrice,
  getExploration,
  getIndex,
  getMoveCost,
  getMoveTargets,
  getPortalTarget,
  getPosition,
  getScoreParts,
  getSpawnTargets,
  getTile,
  isRunOver,
  MAP_SIZE,
  moveCharacter,
  openChest,
  PORTAL_COST,
  Position,
  revealAround,
  TURN_LIMIT,
  updateRainbows,
} from "../game/game-map";
import { GameObjectType, OBJECT_CONFIG } from "../game/game-objects";

/**
 * A bot that plays the game, for balancing rather than for shipping. It lives under src/dev
 * and is only ever reached from behind HAS_DEV_TOOLS, so it is dropped from every build that
 * is not the dev server — which is also why nothing in here is byte-golfed: clarity and being
 * easy to re-tune are worth more than compression to a file that never leaves the machine.
 *
 * It plays *fairly*: every judgement below is made from what the player can see. The one
 * exception is which tiles can be stepped onto, and that is not an exception at all — a
 * fogged tile hiding a fountain is not offered as a step by the interface either, so a
 * player reading the highlights knows exactly as much as the bot does here.
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
 * Every number in the tuning block is a placeholder in the CLAUDE.md sense — the point of
 * the tool is that they get turned. What they encode is what the bot *believes* the game is
 * worth, so a bot that plays badly is as interesting a result as one that plays well.
 */

// The four bots on offer. A plain object rather than defineEnum: this file never reaches a
// production build, and a defineEnum enum would have to be registered in vite.config.ts,
// which would pull a dev-only module into the build config for nothing.
export const BotStrategy = { RANDOM: 0, EXPLORE: 1, ECONOMY: 2, MIXED: 3 } as const;
export type BotStrategy = (typeof BotStrategy)[keyof typeof BotStrategy];

export const BOT_STRATEGIES: BotStrategy[] = [BotStrategy.RANDOM, BotStrategy.EXPLORE, BotStrategy.ECONOMY, BotStrategy.MIXED];
// Indexed by strategy: the face the toggle wears and the name it goes by in the log.
export const BOT_STRATEGY_EMOJIS = ["🎲", "🧭", "💰", "⚖️"];
export const BOT_STRATEGY_NAMES = ["random", "explore", "economy", "mixed"];

/**
 * How much each half of the game a strategy cares about, as a multiplier on that half's
 * gains: [exploring, economy]. They are not normalised and do not have to add up to
 * anything — what matters is their ratio to each other and their size against the tuning
 * constants below. Random ignores both: it does not score anything at all.
 */
const STRATEGY_WEIGHTS: [explore: number, economy: number][] = [
  [0, 0], // RANDOM — unused
  [1, 0.25], // EXPLORE
  [0.25, 1], // ECONOMY
  // Leaning towards the fog rather than balanced, and that is a finding rather than a taste:
  // swept with `npm run bot -- --strategy=mixed --seeds=20`, every step up from 0.6 scored
  // better than the last on nearly every board, peaking around 1.0 and falling off a cliff by
  // 1.5. Which is the score formula showing through — what is built is multiplied by how much
  // of the board has been seen, so seeing more is worth more than it costs, right up until
  // there is nobody left doing any building.
  [0.8, 0.6], // MIXED
];

// PLACEHOLDER tuning. Everything is in "score points", the unit the game's own score is in,
// so that a rainbow and a mouthful of fog can be weighed against each other at all.
// What one newly uncovered tile is worth. The honest figure is builtScore/tiles — exploring
// multiplies what has been built — but that is 0 on the opening turn, which would leave a
// bot with nothing to do on the very turn it has to start walking. A flat value instead.
const TILE_VALUE = 12;
// One water drop in hand — roughly one step, and a step is worth a fraction of a reveal.
// It is also the exchange rate income is valued at: a rainbow pays one drop a turn.
const DROP_VALUE = 4;
// One sweet in the jar. Worth more than a drop because it buys unicorns, which score.
const CANDY_VALUE = 12;
// An unopened present, before it is known what is in it: two fifths of a pile of drops, two
// fifths of a pile of sweets, a fifth of a unicorn — plus the tile it is standing on.
const CHEST_VALUE = 70;
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
let lastTurn = 0;
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
let income = { drops: 0, candy: 0, dropIncome: 0, candyIncome: 0 };

export function resetBot(seed: number) {
  botState = ((Math.imul(seed, 2654435761) >>> 0) % (MODULUS - 1)) + 1;
  goals.clear(); // a new board, and nobody on it is on their way anywhere
  trails.clear();
  lastTurn = 0; // so the first decision of the run reads the board's income afresh
}

function botRandom(): number {
  botState = (botState * 16807) % MODULUS;

  return botState / MODULUS;
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(botRandom() * items.length)];
}

/**
 * What the bot would do next, or undefined once the run is over. Nothing is applied here —
 * the caller carries the action out through the same paths a tap goes through, so the bot
 * can only ever do things a player could have done, and it sees the same animations.
 */
export function getBotAction(map: GameMap, strategy: BotStrategy): BotAction | undefined {
  if (isRunOver(map)) return undefined;

  // A new turn: the board has paid out, everybody may think again about where they have been,
  // and what the board earns is read afresh.
  if (map.turn !== lastTurn) {
    lastTurn = map.turn;
    trails.clear();
    income = { drops: map.drops, candy: map.candy, dropIncome: map.dropIncome, candyIncome: map.candyIncome };
  }

  const action = strategy === BotStrategy.RANDOM ? pickRandom(getLegalActions(map)) : getBestAction(map, STRATEGY_WEIGHTS[strategy]);
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
export function applyBotAction(map: GameMap, action: BotAction) {
  if (action.kind === BotActionKind.END_TURN) return endTurn(map);
  if (action.kind === BotActionKind.BUILD) return build(map, action.from!);
  if (action.kind === BotActionKind.BUY) return buyUnicorn(map, action.to!);

  map.drops -= action.kind === BotActionKind.PORTAL ? PORTAL_COST : getMoveCost(map, action.to!);
  moveCharacter(map, action.from!, action.to!);
  openChest(map, action.to!); // before the fog and the light: a present can hold a unicorn
  revealAround(map, action.to!);
  updateRainbows(map);
}

/** Where the herd is — only the ones out in the open, which today is all of them. */
function getUnicorns(map: GameMap): Position[] {
  const positions: Position[] = [];

  map.tiles.forEach((tile, index) => {
    if (tile.isRevealed && tile.living === GameObjectType.UNICORN) positions.push(getPosition(index));
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
function hasUnicornNeighbour(map: GameMap, { x, y }: Position, ignore?: Position): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const position = { x: x + dx, y: y + dy };
      const isIgnored = ignore && ignore.x === position.x && ignore.y === position.y;

      if ((dx || dy) && !isIgnored && getTile(map, position)?.living !== undefined) return true;
    }
  }

  return false;
}

/**
 * Every legal action on the board right now, ending the turn included. It is the random
 * bot's whole decision — and the definition of "legal" the scoring bot is held to, since
 * every candidate it invents has to be one of these.
 */
function getLegalActions(map: GameMap): BotAction[] {
  const actions: BotAction[] = [{ kind: BotActionKind.END_TURN, value: 0, label: "end turn" }];

  getUnicorns(map).forEach((from) => {
    getMoveTargets(map, from)
      .filter((to) => getMoveCost(map, to) <= map.drops)
      .forEach((to) => actions.push({ kind: BotActionKind.MOVE, from, to, value: 0, label: `step to ${say(to)}` }));

    const portal = getPortalTarget(map, from);
    if (portal && canUsePortal(map, portal))
      actions.push({ kind: BotActionKind.PORTAL, from, to: portal, value: 0, label: "take the portal" });
  });

  map.tiles.forEach((tile, index) => {
    if (!tile.isRevealed) return;
    const position = getPosition(index);

    if (tile.object === GameObjectType.BATHTUB)
      getSpawnTargets(map, position).forEach((to) =>
        actions.push({ kind: BotActionKind.BUY, from: position, to, value: 0, label: "buy a unicorn" }),
      );

    if (getBuild(tile.object) && canBuild(map, position))
      actions.push({ kind: BotActionKind.BUILD, from: position, value: 0, label: `build on ${say(position)}` });
  });

  return actions;
}

function say({ x, y }: Position): string {
  return `${x},${y}`;
}

/**
 * The rainbows a glower standing on `position` accounts for. `lit` picks which question is
 * being asked: the ones shining there right now, which walking away would put out, or the
 * ones that are not there yet and would appear if something walked in.
 *
 * Only fountains the player has found are counted, which is the fair-play rule — the game
 * itself would light a rainbow off a fogged fountain, but the bot has no business planning
 * for one it cannot see. The lit count is an over-estimate where two unicorns are lighting
 * the same rainbow between them, which is rare enough to leave alone.
 */
function countRainbows(map: GameMap, { x, y }: Position, lit: boolean): number {
  let count = 0;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const fountain = getTile(map, { x: x + dx, y: y + dy });
      if ((!dx && !dy) || !fountain?.isRevealed || fountain.object !== GameObjectType.FOUNTAIN) continue;

      const target = getTile(map, { x: x + 2 * dx, y: y + 2 * dy });
      if (!target) continue;
      if (lit ? target.object === GameObjectType.RAINBOW : target.object === undefined && target.living === undefined) count++;
    }
  }

  return count;
}

/** How much of the fog a character standing here would lift — its own tile included. */
function countFog(map: GameMap, { x, y }: Position): number {
  let count = 0;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (getTile(map, { x: x + dx, y: y + dy })?.isRevealed === false) count++;
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

/** Whether a lollipop tree grown here would have light to feed on — now or once a fountain is lit. */
function isFeedable(map: GameMap, { x, y }: Position): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const object = getTile(map, { x: x + dx, y: y + dy })?.object;
      if ((dx || dy) && (object === GameObjectType.RAINBOW || object === GameObjectType.FOUNTAIN)) return true;
    }
  }

  return false;
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
function getReach(map: GameMap, start: Position) {
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

    getMoveTargets(map, position).forEach((target) => step(target, getMoveCost(map, target), false));

    // The portal is an edge like any other, so a goal on the far side of the board comes out
    // cheap the moment the bot is standing on a donut — which is exactly what it is for.
    const portal = getPortalTarget(map, position);
    if (portal && getTile(map, portal)!.living === undefined) step(portal, PORTAL_COST, true);
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
function getBestAction(map: GameMap, [explore, economy]: [explore: number, economy: number]): BotAction {
  // Every payout still to come. endTurn pays on every turn but the last, so this is exactly
  // how many times a stream of income will actually be paid.
  const turnsLeft = TURN_LIMIT - map.turn;
  // What one more rainbow or one more unicorn adds to the score as the board stands — the
  // game's own weight, scaled by how much of the board has been uncovered, because that is
  // what the score multiplies everything by.
  const thingValue = getScoreParts(map)[0][1] * (getExploration(map) / 100);
  const rainbowValue = thingValue + turnsLeft * DROP_VALUE; // it scores, and it pays a drop a turn
  const unicornValue = thingValue + UNICORN_POTENTIAL;
  // What a price actually costs the run, which is not what it costs the purse: money left
  // over at the end is money that scored nothing. See CURRENCY_HORIZON.
  const spendability = Math.min(1, turnsLeft / CURRENCY_HORIZON);
  const dropPrice = DROP_VALUE * spendability;
  const candyPrice = CANDY_VALUE * spendability;
  // A unicorn is both halves of the game at once: another pair of eyes and another light.
  // So it is bought on the average of the two weights rather than under either of them.
  const unicornWeight = (explore + economy) / 2;

  /**
   * What raising a site is worth, already carrying its own strategy weight — the tub is the
   * reason for that: filling it takes the clouds off its own square (see build()), which is
   * an *exploring* gain sitting inside an economy building, and the two halves cannot share
   * one multiplier applied by the caller.
   */
  const getBuildValue = (objectType: GameObjectType, position: Position) => {
    if (objectType === GameObjectType.TUB_SITE)
      return economy * (turnsLeft * BASE_INCOME * DROP_VALUE + TUB_UNICORN_VALUE) + explore * countFog(map, position) * TILE_VALUE;
    if (objectType === GameObjectType.FOUNTAIN_SITE) return economy * (hasRainbowSpot(map, position) ? rainbowValue : 0);

    return economy * (isFeedable(map, position) ? turnsLeft * CANDY_VALUE : 0); // a lollipop tree: one sweet a turn
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
    income.drops + income.dropIncome * turns >= dropCost && income.candy + income.candyIncome * turns >= candyCost;

  const candidates: BotAction[] = [];

  // What the bot is saving up for: the drops of a building it is already standing next to and
  // can only just not afford. While that is on, its drops are spoken for — see below.
  let reserve = 0;

  map.tiles.forEach((tile, index) => {
    if (!tile.isRevealed) return;
    const position = getPosition(index);
    const build = getBuild(tile.object);

    if (build) {
      const [built, dropCost, candyCost] = build;
      const gain = getBuildValue(tile.object!, position); // already weighted — see getBuildValue
      const value = gain - dropCost * dropPrice - candyCost * candyPrice;

      if (canBuild(map, position)) {
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
        hasUnicornNeighbour(map, position) &&
        isAffordable(dropCost, candyCost, RESERVE_PATIENCE)
      ) {
        reserve = dropCost;
      }
    }

    if (tile.object === GameObjectType.BATHTUB) {
      const price = getCandyPrice(map);

      getSpawnTargets(map, position).forEach((to) => {
        // Where the newcomer is put matters as much as buying it: a field with fog around it
        // or a fountain beside it is worth more than the next one along.
        const gain =
          unicornWeight * unicornValue + explore * countFog(map, to) * TILE_VALUE + economy * countRainbows(map, to, false) * rainbowValue;
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
   */
  const getStandingValue = (position: Position, lit: boolean, ignore: Position) => {
    let value = economy * countRainbows(map, position, lit) * rainbowValue;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const site = { x: position.x + dx, y: position.y + dy };
        const build = getBuild(getTile(map, site)?.object);

        if ((!dx && !dy) || !build || !getTile(map, site)!.isRevealed || hasUnicornNeighbour(map, site, ignore)) continue;
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
    let gain = explore * countFog(map, position) * TILE_VALUE + getStandingValue(position, false, from);

    // A present is worth walking to whichever bot is playing: it is drops, sweets or a whole
    // unicorn, and every one of those is worth having.
    if (tile.isRevealed && tile.object === GameObjectType.CHEST) gain += unicornWeight * CHEST_VALUE;

    return gain;
  };

  getUnicorns(map).forEach((from) => {
    const { cost, first, viaPortal } = getReach(map, from);
    const fromIndex = getIndex(from);
    const committed = goals.get(fromIndex); // where this one was already headed, if anywhere
    const walked = trails.get(fromIndex); // and everywhere it has been since the turn began
    // What walking away costs: the rainbows this unicorn is holding up go out behind it and
    // the site it is standing beside loses the hands that were going to raise it. Charged
    // against every goal alike, which is what keeps a posted unicorn at its post.
    const leaving = LEAVING_WEIGHT * getStandingValue(from, true, from);
    // The best this unicorn could do, and the step that carries on with what it was already
    // doing. Only one of the two is ever offered — see the choice below.
    let best: BotAction | undefined;
    let planned: BotAction | undefined;

    map.tiles.forEach((_, index) => {
      // Not the tile it is on, not one it has already stood on this turn, nothing out of reach.
      if (index === fromIndex || walked?.includes(index) || !isFinite(cost[index])) return;

      const to = getPosition(first[index]);
      const isPortal = viaPortal[index];
      const stepCost = isPortal ? PORTAL_COST : getMoveCost(map, to);

      // The step has to be one the interface would actually offer: paid for, and — for a
      // jump — with nobody standing on the far donut.
      if (stepCost > map.drops || (isPortal && !canUsePortal(map, to))) return;
      // And the walk has to be one the purse can actually finish. A goal further off than
      // there are drops to reach it is not a plan, it is a wish — and it was the source of
      // the bot's silliest habit: with an empty purse the only affordable step is a free one
      // over a flower, so it would shuffle on and off the flower "on its way" to something it
      // could not have reached in a hundred turns. Anything out of reach is simply not
      // considered; next turn the board pays out and it may well be in reach then.
      if (cost[index] > map.drops) return;
      // Drops that are spoken for by a building are not available for walking — but only the
      // ones that are actually needed. What this used to say was "while anything is being
      // saved for, no step may cost anything", which froze a unicorn standing beside a site
      // it could already afford the water for and was only waiting on sweets for: it had
      // forty drops, could not spend one of them, and shuffled on and off the flower next to
      // it until the turn ended. A step is fine as long as it leaves the building's water in
      // the purse; a free one over a flower is fine regardless.
      if (stepCost && map.drops - stepCost < reserve) return;

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
      if (!best || value > best.value) best = candidate;
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

  const best = candidates.reduce<BotAction | undefined>((best, action) => (!best || action.value > best.value ? action : best), undefined);

  // Nothing worth doing: bank the drops and let the board pay out. It is also the only way a
  // turn can ever end, so a bot that finds nothing to do still plays the run to its end.
  return best && best.value >= MIN_ACTION_VALUE
    ? best
    : { kind: BotActionKind.END_TURN, value: 0, label: "end turn — nothing worth doing" };
}
