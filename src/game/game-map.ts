import { random, setSeed } from "../utils/random-utils";
import { getRandomItem } from "../utils/array-utils";
import {
  ChestLoot,
  GameObjectType,
  getSide,
  OBJECT_CONFIG,
  PLAYER,
  RIVAL,
  Side,
  SIDE_BATHTUB,
  SIDE_RAINBOW,
  SIDE_UNICORN,
} from "./game-objects";
import { HAS_OPPONENT } from "../env-utils";

/**
 * The sides there are to iterate over in *this build*. Written against the compile-time flag
 * rather than as a constant pair, so a build without the opponent folds it to a one-element
 * list: every per-side loop below then runs once and costs what the single-sided version used
 * to, instead of doing everything twice for a player who does not exist.
 */
const SIDES: Side[] = HAS_OPPONENT ? [PLAYER, RIVAL] : [PLAYER];

// PLACEHOLDER: the boards on offer, easiest first — which is also bottom-first on the launch
// screen, one stripe of the rainbow each. Odd numbers so a board has a true middle, and the
// steps widen as they go: the difference between a 5 and a 7 is felt as keenly at that end as
// the difference between a 21 and a 25 is at the other.
// Everything about a board is derived from this one number (see setMapSize), so the list can
// grow or shrink freely — the launch screen sizes itself to however many there are.
export const MAP_SIZES = [5, 7, 9, 13, 17, 21, 25];

// Everything below is derived from the chosen board and re-derived by setMapSize whenever a
// run starts. They are exported as `let` on purpose: an ES module binding is live, so a
// consumer that imported MAP_SIZE sees the new value without anything being passed around.
// The cost of the choice is that these no longer constant-fold — they used to reduce to
// plain numbers at build time, which is why the `+ 0.5 | 0` rounding is written this way
// and stays that way: it is still cheaper at runtime than Math.round.
export let MAP_SIZE = MAP_SIZES[0];
export let FOUNTAIN_COUNT = 0; // all of them hidden in the fog — there are none in the open any more
export let TREE_COUNT = 0; // the other kind of light source, and the only way onto the board of sweets
export let CUSTARD_COUNT = 0; // springboards scattered over the meadow — see getMoveCost
export let CHEST_COUNT = 0; // what the fog is worth walking into
// What one of them holds. Derived from the board like the counts above rather than fixed, so a
// present stays worth the walk on a board where the walk is twenty tiles — see setMapSize.
export let CHEST_DROPS = 0;
export let CHEST_CANDY = 0;
export let DONUT_COUNT = 0; // the portal network: a pair at least, or nothing at all
export let SITE_COUNT = 0; // build sites, of each of the three kinds
export let TURN_LIMIT = 0; // the whole run — as many turns as the board is wide, bar the tutorial

export const VISION_RADIUS = 1; // Chebyshev: radius 1 = the surrounding 3x3

/**
 * PLACEHOLDER feature ladder: the board width at which each thing first turns up. The boards
 * are the levels, so the ladder is written in widths rather than in level numbers — MAP_SIZES
 * can gain or lose entries without a single number here moving.
 *
 * What this leaves on the smallest board is the tutorial: a unicorn, a scatter of custards, one
 * fountain to line it up against, one present, and the bathtub that pays for the walking. Four
 * rules, and every one of them is still true on the 25x25.
 */
const TREE_SIZE = 7; // and with the trees comes candy, which is what gives the tub its second job
/**
 * PLACEHOLDER: how often a light source is allowed to stand on the ring of a source of the
 * *other* kind — a lollipop on a fountain's eight tiles, or the other way round.
 *
 * A ring is the four lines a source can cast along, so anything owning the ground there costs it
 * a pairing, and everything else keeps off both rings entirely (see crowdsSource). The two kinds
 * of source are the one exception, because what they cost each other they also give back: the
 * tile beside both of them is the one tile on the board where a single unicorn lights a rainbow
 * of each currency at once. Half the time, so a board carries a few of those without the two
 * kinds ending up welded together in pairs.
 */
const SHARES_RING = 0.5;
/**
 * The tutorial's run, which is the one board whose turns are not its width. The ceiling — 100%
 * uncovered, the two unicorns the board can hold, the two rainbows its one fountain can hold —
 * is 400 on every seed, and nothing on the board compounds, so the run is over the moment it is
 * reached: adding a second fountain or a second present raises that ceiling and gets there
 * *sooner*, not later. The turn count is therefore the turn the ceiling falls on, and nothing else.
 *
 * Five was three turns of playing and two of watching. Three was one, measured on the level's
 * own seed: perfect play is five steps and finishes in the middle of turn 2 with a drop still in
 * hand, and the game's own bot — which gets 368 of the 400 — spends the whole of turn 3 doing
 * nothing at all, having no legal step left that is worth more than the rainbow it would walk
 * out of. Two, then, and the level ends where it was already over.
 *
 * What the cut costs is slack, and it costs less of it than it did: of every position the board
 * can be left in, 0.7% score 400 over three turns against 0.7% over two, and 7.4% reach 300
 * against 6.2%. It was 0.7 against 0.4 while a present put its unicorn down on a random
 * neighbour — making that placement the opener's own (see openChest) is what closed the gap,
 * because what the ceiling now needs is play rather than luck with where a newcomer landed.
 *
 * It is deliberately the one exception on the ladder rather than a second list beside MAP_SIZES:
 * every other board is still as many turns as it is wide, because from the 7x7 up there are
 * trees, and an economy that compounds is what gives a later turn something an earlier one
 * could not do.
 */
const TUTORIAL_TURNS = 2;
const DONUT_SIZE = 9;
const DONUT_DENSITY = 6; // tiles of width per donut — see setMapSize
const SITE_SIZE = 13;
/**
 * PLACEHOLDER: the board width at which the opponent turns up — the top three rungs of the
 * ladder. A rival is only a race if there is ground to race over: on a 13x13 two herds would be
 * treading on each other from the opening turn, and the run is too short for either economy to
 * become something the other can watch getting away from them. The 17x17 is where both of those
 * stop being true, which is also where the boards start being ones a player has to plan rather
 * than simply walk.
 */
const RIVAL_SIZE = 17;
// Whether the board being played has an opponent on it. Derived from the width like everything
// else, so it follows the ladder rather than being a second list of levels — and gated on the
// build flag, so the whole feature folds away with it.
export let HAS_RIVAL = false;
/**
 * The opponent switched off for a measurement — `npm run sweep` and `npm run bot --solo`. It
 * exists for the same reason setUsesBoardWeights does: a tool that quietly measures a
 * different game than the one it says it is measuring is worse than no tool. The sweep turns
 * a bot's weights against the *board*, and a second player on two rungs of the ladder and not
 * the other five is noise in exactly the comparison it is making.
 *
 * Free in a build without the feature: HAS_OPPONENT folds to false, the `&&` short-circuits
 * and the setter goes out with the tree-shaking.
 */
let rivalEnabled = true;

export function setRivalEnabled(enabled: boolean) {
  rivalEnabled = enabled;
}

// The tutorial board, which is simply the first rung of the ladder. Kept as a flag rather than
// re-derived at each use so that "this is the tutorial" is one idea in one place.
let isTutorial = false;

/**
 * Sizes the world. The counts are given as "one per this many tiles", so a bigger board
 * gets proportionally busier instead of emptier — the divisors are what the hand-tuned 9x9
 * worked out to. Turns scale with the width rather than the area: income compounds over a
 * run, so the ground a player can cover grows roughly with the square of the turns, which
 * is what keeps the share of the map they get to see about the same on every board.
 *
 * On top of that, the feature ladder above zeroes whole kinds of thing out on the early
 * boards. A count of 0 is all it takes: every placement loop is bounded by its count, and the
 * two things that are not loops — the middle tub site and the portal pair — read the count as
 * the condition they are placed under.
 */
function setMapSize(size: number) {
  const tiles = size * size;
  MAP_SIZE = size;
  isTutorial = size === MAP_SIZES[0];
  FOUNTAIN_COUNT = (tiles / 27 + 0.5) | 0;
  TREE_COUNT = size < TREE_SIZE ? 0 : FOUNTAIN_COUNT;
  CUSTARD_COUNT = (tiles / 12 + 0.5) | 0;
  // Rarer than anything else on the board. Floored at one, because the smallest board rounds
  // down to none and its single present is the whole point of it.
  CHEST_COUNT = (tiles / CHEST_DENSITY + 0.5) | 0 || 1;
  // What is inside grows with the board rather than staying put, which is what keeps a present
  // worth walking to on the biggest one — see CHEST_DENSITY for why the count alone was not
  // enough. The two currencies climb at different rates on purpose: sweets buy unicorns and
  // are what a run is actually short of, while drops are the currency a well-built board ends
  // up with a pile of, so a present that paid a full width in water was topping up the one
  // counter nobody empties. Half the width, rounded up, is the smaller share of a smaller need.
  CHEST_DROPS = (size + 1) >> 1;
  CHEST_CANDY = (size / 2.5 + 0.5) | 0;
  // PLACEHOLDER: one donut per DONUT_DENSITY tiles of width, which comes out as 2 on the 9x9
  // and the 13x13, 3 on the 17x17 and 4 on the boards above it. Linear in the width rather
  // than the area, the same as the sites and the turns: what a portal is worth is how much of
  // the walking it saves, and the walking grows with the width.
  DONUT_COUNT = size < DONUT_SIZE ? 0 : (size / DONUT_DENSITY + 0.5) | 0;
  // Linear in the width rather than the area, the same as TURN_LIMIT and for the same reason:
  // what should stay steady across the boards is how many sites a run has the turns to reach,
  // not how many are on the map. Works out at 2 of each kind on the 13x13, 3 on the 21x21.
  SITE_COUNT = size < SITE_SIZE ? 0 : (size / 7 + 0.5) | 0;
  TURN_LIMIT = isTutorial ? TUTORIAL_TURNS : size;
  HAS_RIVAL = HAS_OPPONENT && rivalEnabled && size >= RIVAL_SIZE;
}

/**
 * How far a thing has to keep from the nearest other thing of its own kind. It is derived
 * from how many of them there are rather than being one number for the whole board: a fixed
 * distance means something quite different to sixteen fountains on a 21x21 and to two on a
 * 7x7, and it was the fixed number that let the big boards grow fountain deserts — a run
 * could open with an eleven-tile walk before the economy could start at all.
 *
 * `sqrt(tiles / count)` is the spacing a perfectly even lattice of `count` things would have.
 * SPREAD is the fraction of that actually demanded, and it is the whole knob: at 1 the board
 * would come out a grid, and at 0 it is the old free-for-all. Below 1 the rule only forbids
 * clumping and leaves everything else to chance, which is what keeps a board from looking
 * laid out — two fountains may still turn up as neighbours-but-one, just not in a heap.
 */
const SPREAD = 0.7;

function getSpacing(count: number): number {
  return (Math.sqrt((MAP_SIZE * MAP_SIZE) / count) * SPREAD + 0.5) | 0;
}

// PLACEHOLDER score weight. The score is what the board is worth right now, not a total
// banked over the run — it is recomputed from scratch whenever anything moves, shown all
// through the run, and whatever it reads when the last turn closes is the final score.
//
// A rainbow shining and a unicorn found are worth one point apiece for every percent of the
// board no longer under cloud. So it is a product rather than a sum: exploring is worth
// nothing on its own — an empty board fully uncovered still scores nothing — and building is
// worth only as much of itself as the player has bothered to look at. Neither half of the run
// can be skipped for the other, which two added terms would have allowed.
//
// It used to be written as "count × 100, then × percent / 100", and the two forms agree
// exactly — both factors are whole numbers, so nothing rounds. The short one is what the
// breakdown panel can show its working in: every point on the board belongs to a rainbow or a
// unicorn, and clearing fog is what raises what one of them is worth. The long one made the
// panel print a subtotal the fog then took a bite out of, which is the opposite of the truth.
//
// Lollipop trees do not score. They still earn the candy that buys unicorns, so a tree is
// worth growing for what it leads to rather than for being there.
export const MOVE_COST = 1; // water drops per step
export const PORTAL_COST = MOVE_COST + 1; // a jump between the two donuts costs one drop more than a step
// PLACEHOLDER: what one bathtub pays into the purse every turn, come what may. It is the
// floor under the economy — with it, a run can never seize up, which is why there is no
// losing any more. Every tub on the board pays it, so a second one doubles the base.
export const BASE_INCOME = 2;
// PLACEHOLDER: how a unicorn grows up. One that spends GROWTH_PER_LEVEL turns shining gains a
// level, up to MAX_UNICORN_LEVEL, and its rainbows come out that much bigger: a level-3
// unicorn's rainbow pays three drops a turn instead of one, and feeds a lollipop tree beside it
// three sweets instead of one.
//
// It is aimed at the end of a long run, which had gone quiet: a unicorn costs the herd's size,
// so a flat income stops buying anything and there is nothing left to spend a turn on. Growth
// on the unicorn rather than on the tree is what keeps the two currencies together while it
// fixes that — the rainbow is where water and sweets both come from, so a bigger one lifts the
// purse and the jar at once, and the walking a run wants to pay for stays payable.
//
// Shining, not merely living: it grows on the turns it is actually lined up 🦄⛲🌈, which is
// the act the whole game is about. See growUnicorns.
// Exported with the ceiling for the info panel, which draws the whole ladder as a bar.
export const GROWTH_PER_LEVEL = 3; // turns spent shining per level-up
const MAX_UNICORN_LEVEL = 3; // its rainbow is worth 1 at the start and 3 once it is fully grown
// The counter's ceiling, since it counts shining turns rather than levels — two level-ups' worth.
export const MAX_GROWTH = (MAX_UNICORN_LEVEL - 1) * GROWTH_PER_LEVEL;
// PLACEHOLDER: how much board there is per present. Lowered from 60, which is a couple more on
// every board from the 9x9 up — but the count was never the weak part. Tripling the presents on
// the 25x25 was measured at 8%, because a present's *contents* were flat: five drops against a
// thirty-a-turn income is a sixth of a turn, and two sweets against a twenty-sweet unicorn is a
// rounding error. Four fifths of the loot table had quietly stopped mattering. So the contents
// scale with the board now — see setMapSize — and this is the smaller half of the fix.
const CHEST_DENSITY = 45;
// What is inside, rolled from this list — one entry each, so the three outcomes are equally
// likely. A unicorn used to come up half as often as either pile on the grounds that it is
// worth far more, which had it right about the worth and wrong about what that should buy:
// the piles are the two outcomes that stop mattering as a run grows, and the unicorn is the
// only one that never does. Evening the odds puts the weight on the outcome that keeps its
// value, rather than on the two that need scaling to hold theirs.
const LOOT_TABLE = [ChestLoot.DROPS, ChestLoot.CANDY, ChestLoot.UNICORN];
// PLACEHOLDER build prices. The shape is settled even where the numbers are not: a building is
// paid for in the currency it goes on to produce — a fountain in water, a lollipop tree in
// sweets — and the tub, which produces both, is paid for in both.
//
// Swept against controls: a price is felt in its *candy* half and barely in its water, because
// sweets buy unicorns and unicorns are what everything else scales off. The tub went 4💧4🍬 →
// 6💧2🍬 for +3%. Water-only (8💧0🍬) was worth +5% and turned down, not missed: it would make
// the tub a second fountain, and the rule above is worth more than the two points.
//
// Indexed by site type less the first site, which is why the three sites are consecutive
// members at the end of the enum: it makes this a three-entry array rather than a lookup with
// holes in it where the real objects are.
const BUILD_TABLE: [built: GameObjectType, drops: number, candy: number][] = [
  [GameObjectType.BATHTUB, 6, 2],
  [GameObjectType.FOUNTAIN, 6, 0],
  [GameObjectType.TREE, 0, 4],
];
// PLACEHOLDER: the range a "give me any map" seed is drawn from. Short enough to stay
// readable, which matters once maps are handpicked by their number.
const SEED_RANGE = 1e6;
const TUB_POSITION: Position = { x: 0, y: 0 }; // the starting base, in the corner
const UNICORN_START: Position = { x: 1, y: 1 }; // the tub's diagonal neighbour

export interface Position {
  x: number;
  y: number;
}

export interface Tile {
  /**
   * Which sides have seen this tile, one bit each — see isSeen. A bitmask rather than a
   * boolean because the two sides explore separately: the opponent walking through the fog
   * lifts it for the opponent alone, and exploration is the score's own multiplier, so a
   * shared cloud layer would have each side handing the other its multiplier for free.
   * Zero means nobody has been here, which is also what "free to place something on" reads.
   */
  seen: number;
  // Two layers: living things walk over whatever lies on the ground and are drawn
  // on top of it, so a rainbow stays put when the unicorn steps onto its tile.
  object?: GameObjectType; // ground layer — GOAL / STATIC
  living?: GameObjectType; // entity layer — LIVING
  // What the chest on this tile is holding, on the handful of tiles that have one. Rolled
  // when the board is built rather than when the chest is opened, so a seed determines its
  // prizes as completely as it determines where they are.
  loot?: ChestLoot;
  /**
   * How many shining turns the unicorn standing here has behind it. It belongs to the unicorn
   * and not to the tile, so it travels with it — see moveCharacter, which is the only place a
   * unicorn ever changes tiles. Absent means none, which is what a newcomer and every tile
   * with nobody on it read as.
   *
   * One counter rather than a level and a progress pair: the level is this divided by
   * GROWTH_PER_LEVEL (see getUnicornLevel) and the remainder is how far along the next one is
   * (see getUnicornProgress). A turn spent dark leaves it alone — growth pauses, it never runs
   * backwards.
   */
  growth?: number;
  /**
   * How big the rainbow lying here is — the level of the unicorn whose light made it, which is
   * how much it pays a turn in whichever currency it pays. Written as the rainbow is cast (see
   * updateRainbows) and only ever read of a tile that holds one, so it cannot go stale: every
   * rainbow there is was lit in the same pass that stamped this.
   *
   * A field of its own rather than the caster's `growth`, because the two can be on one tile: a
   * unicorn may walk onto a tile a rainbow was lying on, and its own growth goes with it.
   */
  light?: number;
  /**
   * Which currency the rainbow lying here pays: sweets when the light that made it came through
   * a lollipop, water when it came through a fountain. The same guarantee as `light` and written
   * in the same breath — a rainbow is stamped with what it is worth and what it is worth it in
   * at the moment it is cast, so nothing downstream has to go looking for the source again.
   */
  candy?: boolean;
}

/**
 * The unicorn standing here, in levels: 1 while it is young, up to MAX_UNICORN_LEVEL once it
 * has shone long enough. Read off the tile so that everything the level touches — what the
 * rainbow pays, the sweets it feeds a tree, how the light is drawn, what the info panel says —
 * is counted off the one number and cannot drift.
 *
 * Undefined growth divides to NaN and `| 0` turns that into 0, so a newcomer — and any tile
 * with nobody standing on it — reads as level 1 without a default being spelled out.
 */
export function getUnicornLevel(tile: Tile): number {
  return 1 + ((tile.growth! / GROWTH_PER_LEVEL) | 0);
}

/**
 * The raw counter, 0 to MAX_GROWTH, with a newcomer's undefined read as 0. For the info panel,
 * which draws the whole ladder off it so that a level-up can be seen coming rather than only
 * arriving; everything else reads the level (getUnicornLevel) and never the turns behind it.
 */
export function getGrowth(tile: Tile): number {
  return tile.growth || 0;
}

/**
 * Whether `side` has this tile out from under its own clouds. Every fog rule in the game goes
 * through here, and every one of them now has to say whose eyes are asking — which is the
 * whole cost of the two sides exploring separately, spread thinly over the whole file.
 * Undefined-tolerant like getTile, so a look off the edge of the board answers "no".
 */
export function isSeen(tile: Tile | undefined, side: Side): boolean {
  return !!tile && !!(tile.seen & (1 << side));
}

/** A ray of light leaving a glowing tile towards the fountain one step away in (dx, dy). */
export interface Beam extends Position {
  dx: number;
  dy: number;
  isLit: boolean; // the light got through and made a rainbow, instead of dying in the fountain
  // Whether this light bent through a lollipop rather than through a fountain, which is the one
  // thing that decides both its colour and the currency at the far end of it. Stamped from the
  // source rather than read back off the rainbow, so an *unlit* beam carries it too: light dying
  // inside a lollipop is drawn pink, and what a line-up would pay can be read before it pays.
  isCandy: boolean;
  side: Side; // whose light it is — the renderer draws the opponent's inverted, like its rainbows
  // How many parallel lines this beam is drawn as: the level of the unicorn whose light it is,
  // which is exactly what the rainbow at the end of it pays. So a grown unicorn's light comes
  // out three lines wide, and what it is worth can be counted off the board.
  // A beam that died in its source never sets it: an unlit one pays nothing to count.
  lines?: number;
}

/**
 * Everything the two sides keep separately, as arrays indexed by side. On a board with no
 * opponent the second entry is simply never read — nothing places a dark unicorn, so nothing
 * ever earns or scores into it.
 */
export interface GameMap {
  tiles: Tile[]; // flat, row-major: index = y * MAP_SIZE + x
  rainbowCounts: number[]; // rainbows shining right now, per side — recomputed after every move
  beams: Beam[]; // what the light is doing, recomputed alongside the rainbows
  drops: number[]; // water drops in the purse; they buy steps and are banked across turns
  candy: number[]; // sweets in the jar; they buy unicorns and are banked the same way
  dropIncome: number[]; // the bathtubs' flat pay plus every rainbow paying water — recomputed with them
  candyIncome: number[]; // every rainbow cast through a lollipop — recomputed alongside them too
  turn: number; // the turn being played, 1 to TURN_LIMIT
}

export const MOVE_RADIUS = 1; // Chebyshev, like VISION_RADIUS: radius 1 = a step into any of the 8 neighbours

/** Flat tile index of a position — the bridge between the model and the tile elements. */
export function getIndex({ x, y }: Position): number {
  return y * MAP_SIZE + x;
}

export function getPosition(index: number): Position {
  return { x: index % MAP_SIZE, y: Math.floor(index / MAP_SIZE) };
}

// Bounds-checked so a step off the left edge doesn't wrap into the row above.
export function getTile(map: GameMap, position: Position): Tile | undefined {
  const { x, y } = position;
  return x < 0 || y < 0 || x >= MAP_SIZE || y >= MAP_SIZE ? undefined : map.tiles[getIndex(position)];
}

/** A fresh map to play — the one roll that stays truly random, since it picks the seed itself. */
export function createSeed(): number {
  return Math.floor(Math.random() * SEED_RANGE);
}

/**
 * A corner position as that side sees it: the player's own, or the opponent's turned through
 * half a circle about the middle of the board. It is what makes "the opposite side" one line
 * rather than a second set of coordinates to keep in step with the first.
 */
function mirror({ x, y }: Position, side: Side): Position {
  return side ? { x: MAP_SIZE - 1 - x, y: MAP_SIZE - 1 - y } : { x, y };
}

/**
 * Builds the board for `seed`. Every roll below comes from the seeded generator, so the
 * same seed always produces the same map: replaying one costs nothing but calling this
 * again, and a handpicked level is just a number. Note that this ties the maps to the
 * generation code — changing anything about the order or count of the rolls reshuffles
 * every seed, so a curated level list can only be pinned down once this is settled.
 */
export function createGameMap(seed: number, size = MAP_SIZE): GameMap {
  setMapSize(size); // before anything reads MAP_SIZE, which is most of what follows
  setSeed(seed);

  const map: GameMap = {
    tiles: Array.from({ length: MAP_SIZE * MAP_SIZE }, () => ({ seen: 0 })),
    rainbowCounts: [0, 0],
    beams: [],
    drops: [0, 0],
    candy: [0, 0],
    dropIncome: [0, 0],
    candyIncome: [0, 0],
    turn: 1,
  };

  // The bases, one per side: a tub in a corner that pays BASE_INCOME every turn without
  // needing anything set up around it and is where that side's new unicorns come from, and
  // one unicorn on its diagonal neighbour. That is the whole opening — no worked example of
  // the light rule in the corner any more; both of them meet that out in the fog.
  //
  // The opponent's corner is the player's mirrored through the middle of the board, which is
  // the longest walk there is between them: they open as far apart as the board allows and
  // meet in the middle, where the tub site every board is guaranteed happens to be.
  // Both are placed — and both open their own vision — before anything else goes down, so
  // that nothing can spawn on a tile either side has already looked at.
  (HAS_RIVAL ? SIDES : [PLAYER]).forEach((side) => {
    const tub = mirror(TUB_POSITION, side);
    const start = mirror(UNICORN_START, side);

    getTile(map, tub)!.object = SIDE_BATHTUB[side];
    getTile(map, start)!.living = SIDE_UNICORN[side];
    revealAround(map, start, side);
  });

  // Everything is placed after the starting vision is applied, so nothing can spawn
  // on an already-revealed tile — it all starts hidden under the clouds. The order runs
  // from the fussiest placement to the most relaxed: whatever has the most rules to
  // satisfy gets the emptiest board to find room on.

  // Fussiest of all, because it is not a roll at all: one tub site on the middle tile, which
  // is what the odd board sizes are for (see MAP_SIZES). It makes a second unicorn source out
  // in the board something every run has rather than something a seed might give you, and it
  // gives a player somewhere to head for from the opening turn. First, so nothing else can
  // take the tile — and only from the board that build sites start on, so the early levels
  // have nothing to raise anywhere.
  const middle = MAP_SIZE >> 1;
  if (SITE_COUNT) getTile(map, { x: middle, y: middle })!.object = GameObjectType.TUB_SITE;

  // The light, both kinds of it, and they are placed alike because they *are* alike: a fountain
  // and a lollipop differ in nothing but the currency at the end of the line-up. One tile of
  // distance to the border, so every side of a source has an opposite tile to cast a rainbow
  // onto, and their share of the board from the others of their own kind — the two kinds keep
  // off each other through their rings instead (see crowdsSource), which is what lets a pair of
  // them turn up close enough to share a unicorn.
  // Fussiest first, so the sources get the emptiest board there is to find room on.
  for (let i = 0; i < FOUNTAIN_COUNT; i++) placeObject(map, GameObjectType.FOUNTAIN, FOUNTAIN_COUNT, 1);
  for (let i = 0; i < TREE_COUNT; i++) placeObject(map, GameObjectType.TREE, TREE_COUNT, 1);

  // The portal network: placed early, because its rule is the hardest on the board to satisfy.
  // The donuts keep their distance along *both* axes rather than as the crow flies, so no two
  // of them share a row or a column — a jump that only slides sideways reads as a move rather
  // than a portal, however many tiles it covers. That is the whole of `diagonal` below, and
  // the spacing it demands is the ordinary one: for a pair it works out at half the width,
  // exactly what the rule used to be written as, and it tightens on its own as the bigger
  // boards get their third and fourth donut.
  // The first one is drawn only from tiles that still have a legal partner free. Picking it
  // blindly can strand the next with nowhere to go — a donut in the middle of the board has
  // only the four corners to pair with — and placeObject would then relax the rule rather than
  // drop the donut, which is how a portal ends up leading to the tile next door.
  if (DONUT_COUNT) {
    const spacing = getSpacing(DONUT_COUNT);
    const spots = getPlaceableSpots(map, GameObjectType.DONUT, 0);
    const pairable = spots.filter((a) => spots.some((b) => getAxisDistance(a, b) >= spacing));
    getTile(map, getRandomItem(pairable.length ? pairable : spots))!.object = GameObjectType.DONUT;
    // From 1: the one above is on the board already, and the rest space themselves off it.
    for (let i = 1; i < DONUT_COUNT; i++) placeObject(map, GameObjectType.DONUT, DONUT_COUNT, 0, true);
  }

  // No unicorns are placed here: the one at the start position is the whole herd a run
  // begins with, and every other one is bought from a tub. Nothing waits in the fog.
  for (let i = 0; i < CUSTARD_COUNT; i++) placeObject(map, GameObjectType.CUSTARD, CUSTARD_COUNT);

  // Chests and build sites last, and they can only land under the fog like everything else —
  // which is the rule that makes them a reward for exploring rather than a handout in the
  // corner. It is also what a site is for: a run has two reasons to walk into the fog now.
  for (let i = 0; i < CHEST_COUNT; i++) {
    const position = placeObject(map, GameObjectType.CHEST, CHEST_COUNT);
    // The tutorial's one present always holds a unicorn. There are no trees on that board and
    // so no sweets to spend, and its five turns are too few for a pile of drops to turn into
    // anything — where a second unicorn is a second pair of eyes and a second light, straight
    // away. It is also the one prize that teaches something rather than topping a counter up.
    if (position) getTile(map, position)!.loot = isTutorial ? ChestLoot.UNICORN : getRandomItem(LOOT_TABLE);
  }

  // From 1: the middle tile already has the tub site every board is guaranteed, and these are
  // the extras the bigger boards carry. They keep off the border, so a second unicorn source
  // is always somewhere a run can work around rather than pinned against an edge.
  for (let i = 1; i < SITE_COUNT; i++) placeObject(map, GameObjectType.TUB_SITE, SITE_COUNT, 1);

  // The two site kinds keep a source's own margin, because that is what they become: a source on
  // the border has sides with no tile opposite to cast a rainbow onto, and a raised one is no
  // different from a found one. They are placed alike for the same reason their buildings are —
  // rubble is a fountain that has not happened yet, a seedling a lollipop that has not.
  for (let i = 0; i < SITE_COUNT; i++) placeObject(map, GameObjectType.FOUNTAIN_SITE, SITE_COUNT, 1);
  for (let i = 0; i < SITE_COUNT; i++) placeObject(map, GameObjectType.TREE_SITE, SITE_COUNT, 1);

  updateRainbows(map);
  // The opening purse is one turn's income — the tub's, since nothing shines yet. Both sides
  // open with their own, which on a mirrored board is the same number twice.
  map.drops = [...map.dropIncome];

  return map;
}

/**
 * Nothing on it and nobody has seen it — where something new may be placed. "Nobody" rather
 * than "the player": a chest under the opponent's opening vision would be one it could open
 * on its first step, which is the same handout the rule exists to prevent.
 */
function isFree(tile: Tile | undefined): boolean {
  return !!tile && !tile.seen && tile.object === undefined && tile.living === undefined;
}

/** Chebyshev distance: one step in this game — diagonals included — is a distance of 1. */
function getDistance(a: Position, b: Position): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/**
 * The smaller of the two axis distances. Where Chebyshev asks "how far apart are they",
 * this asks "are they apart in *both* directions" — a pair sharing a row or a column
 * scores 0 here however far apart it is.
 */
function getAxisDistance(a: Position, b: Position): number {
  return Math.min(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/**
 * Every free tile, `margin` keeping that many tiles of distance to the border.
 * Collected as a list and then picked from, rather than by throwing darts until one lands
 * on a free tile: once placements have to keep their distance from each other a dart can
 * miss arbitrarily often, and on a tight board it might never land at all.
 */
function getFreePositions(map: GameMap, margin: number): Position[] {
  const positions: Position[] = [];

  for (let y = margin; y < MAP_SIZE - margin; y++) {
    for (let x = margin; x < MAP_SIZE - margin; x++) {
      if (isFree(getTile(map, { x, y }))) positions.push({ x, y });
    }
  }

  return positions;
}

/** Where everything of one kind already stands — both layers, so it works for characters too. */
function getPositionsOf(map: GameMap, objectType: GameObjectType): Position[] {
  const positions: Position[] = [];

  map.tiles.forEach((tile, index) => {
    if (tile.object === objectType || tile.living === objectType) positions.push(getPosition(index));
  });

  return positions;
}

/**
 * Puts one `objectType` on a free tile and reports where it landed. `count` is how many of
 * this kind the board is getting, which is what the spacing is worked out from (see SPREAD);
 * `margin` is the distance it keeps from the border, and `diagonal` asks for that spacing
 * along *both* axes instead of as the crow flies — the rule that stops the donuts from lining
 * up in one row or column. Everything placed here lands on the ground layer: nothing living
 * is ever placed by the generator — the herd is one unicorn per side at the start and every
 * other one is bought from a tub.
 *
 * The spacing is stepped down rather than dropped when nothing satisfies it: the last few
 * things onto a filling board still get placed as far apart as that board still allows,
 * instead of falling back to no rule and landing in the first heap they find. It is also what
 * makes generation total — the loop is bounded by the spacing, so it can never spin looking
 * for a spot that is not there. The diagonal rule steps down with it, which is what lets a
 * board carry four donuts: demanding half the width of every pair of them is impossible, and
 * it is the step-down rather than a second constant that finds what such a board does allow.
 */
function placeObject(map: GameMap, objectType: GameObjectType, count = 1, margin = 0, diagonal = false): Position | undefined {
  const free = getPlaceableSpots(map, objectType, margin);
  const taken = getPositionsOf(map, objectType);
  let candidates = free;

  for (let spacing = getSpacing(count); spacing > 1; spacing--) {
    const spaced = free.filter((position) =>
      taken.every((other) => (diagonal ? getAxisDistance : getDistance)(position, other) >= spacing),
    );

    if (spaced.length) {
      candidates = spaced;
      break;
    }
  }

  if (!candidates.length) return undefined;

  const position = getRandomItem(candidates);
  const tile = getTile(map, position)!;

  tile.object = objectType;

  return position;
}

/**
 * A lollipop, or the seedling that becomes one — and below it, either of those or a fountain or
 * its rubble. A site counts as the thing it will be for every purpose that is about where light
 * will come out: a raised source is no different from a found one, so anything that gives a
 * source room has to give a site the same room, or the room is gone by the time it is raised.
 */
function isSweet(objectType: GameObjectType | undefined): boolean {
  return objectType === GameObjectType.TREE || objectType === GameObjectType.TREE_SITE;
}

function isLightish(objectType: GameObjectType | undefined): boolean {
  return objectType === GameObjectType.FOUNTAIN || objectType === GameObjectType.FOUNTAIN_SITE || isSweet(objectType);
}

/**
 * Whether putting `objectType` here would crowd a light source out of its own light.
 *
 * A source's eight neighbours are not ordinary tiles: they pair up into the four lines its light
 * can travel along, and each line needs a tile to stand a unicorn on at one end and empty ground
 * to land a rainbow on at the other. So anything that owns the ground layer and lands on that
 * ring does not merely sit near the source — it costs it a whole pairing, and a source ringed by
 * scenery is a source that cannot be used at all. That was being decided by the roll of the
 * dice, and this is what decides it on purpose instead.
 *
 * Read from both sides, because a ring can be crowded either way round:
 *  - a source arriving wants a ring that is empty ground to begin with;
 *  - anything else arriving must keep off every ring.
 *
 * `sharesRing` is the one exception, rolled once per placement (see SHARES_RING and
 * getPlaceableSpots): a source that has won that flip may stand on the ring of a source of the
 * *other* kind, which is how a board comes by the tile that lights one rainbow of each currency.
 *
 * It is only ever advice: getPlaceableSpots falls back to the unfiltered board when nothing
 * satisfies this, the same way the spacing rule steps down rather than dropping a placement.
 */
function crowdsSource(map: GameMap, { x, y }: Position, objectType: GameObjectType, sharesRing: boolean): boolean {
  const isLight = isLightish(objectType);

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const object = getTile(map, { x: x + dx, y: y + dy })?.object;

      if (!dx && !dy) continue;
      // The shared ring, and it is one rule read from both ends at once: this tile is on that
      // source's ring exactly as that source is on this one's, so allowing it here allows it
      // there. Only ever between a watery source and a sweet one.
      if (sharesRing && isLightish(object) && isSweet(object) !== isSweet(objectType)) continue;

      // A source arriving: whatever else is already on the ring is what it would have to work
      // around, so it goes somewhere emptier instead.
      if (isLight) {
        if (object !== undefined) return true;
        continue;
      }

      if (isLightish(object)) return true;
    }
  }

  return false;
}

/**
 * The free tiles this kind of thing may actually be put on: `margin` clear of the border, and
 * clear of the sources' light — see crowdsSource, whose rule this is the one place that applies.
 * The whole board comes back rather than nothing at all when the rule cannot be met, so a
 * filling board still places what it is asked to, as close to the rule as it can.
 *
 * The shared-ring flip is rolled here, once per placement rather than once per candidate tile:
 * this is a thing being placed asking where it may go, and "may I share a ring this time" is a
 * question about that thing and not about each tile it is looking at.
 *
 * Not rolled at all on a board with no lollipops on it, and that is not a saving — a draw that
 * nothing can act on still moves the seeded generator on, and the tutorial is a board whose deal
 * has been measured to the last tile (see TUTORIAL_TURNS). A flip with no second kind of source
 * to share a ring with would have rebuilt it for nothing.
 */
function getPlaceableSpots(map: GameMap, objectType: GameObjectType, margin: number): Position[] {
  const free = getFreePositions(map, margin);
  const sharesRing = !!TREE_COUNT && isLightish(objectType) && random() < SHARES_RING;
  const clear = free.filter((position) => !crowdsSource(map, position, objectType, sharesRing));

  return clear.length ? clear : free;
}

/**
 * Uncovers the vision square around a position, for one side. Revealed tiles stay revealed,
 * and each side's clouds are lifted only by its own walking.
 *
 * The recursion is what makes a herd one pair of eyes: a unicorn of the *same* side found
 * under the fog opens its own vision too, so a newcomer put down out of sight still sees
 * what it is standing in. A character of the other side is a thing that has been spotted and
 * nothing more — walking up to the opponent shows you the opponent, not the board around it,
 * or its herd would be handing you the exploration multiplier it walked out to earn.
 */
export function revealAround(map: GameMap, { x, y }: Position, side: Side) {
  const bit = 1 << side;

  for (let dy = -VISION_RADIUS; dy <= VISION_RADIUS; dy++) {
    for (let dx = -VISION_RADIUS; dx <= VISION_RADIUS; dx++) {
      const position = { x: x + dx, y: y + dy };
      const tile = getTile(map, position);

      if (tile && !(tile.seen & bit)) {
        tile.seen |= bit;
        // one of our own coming out of the fog opens its own vision right away — and may
        // in turn uncover the next one (the recursion ends, tiles only ever un-fog once)
        if (tile.living !== undefined && getSide(tile.living) === side) revealAround(map, position, side);
      }
    }
  }
}

function glows(objectType: GameObjectType | undefined): boolean {
  return objectType !== undefined && OBJECT_CONFIG[objectType].glows;
}

/**
 * The two things a unicorn's light bends through. They are one kind of thing in every respect
 * the rules read — same line-up, same reach, same empty tile needed opposite — and differ only
 * in what comes out at the far end, which is the whole of the game's economy: 🦄⛲🌈 pays water,
 * 🦄🍭🌈 pays sweets.
 */
function refracts(objectType: GameObjectType | undefined): boolean {
  return objectType === GameObjectType.FOUNTAIN || objectType === GameObjectType.TREE;
}

/**
 * Rainbows are pure light, not scenery: the glow of a unicorn (or of the sun) refracts
 * through the light source it stands next to — a fountain or a lollipop, see refracts — and
 * lands on the tile directly opposite. Which of the two it passed through decides what the
 * rainbow pays, and nothing else does.
 * Recomputed from scratch after every move, so a rainbow fades the moment its unicorn
 * walks away. A tile that is off the map or already taken swallows the light — that
 * angle produces no rainbow, only an unlit beam that stops inside the fountain.
 * A glower still under the fog stays dark: its light only starts once it is revealed.
 */
export function updateRainbows(map: GameMap) {
  map.tiles.forEach((tile) => {
    if (tile.object === GameObjectType.RAINBOW || tile.object === GameObjectType.DARK_RAINBOW) tile.object = undefined;
  });

  map.rainbowCounts = [0, 0];
  map.beams = [];

  map.tiles.forEach((tile, index) => {
    // Whose light this is follows from what is standing here, so the rainbow it casts is
    // stamped with a side without anything being passed in. A glower still under its *own*
    // clouds stays dark, which is the same rule as before now that "the fog" has two of them:
    // what the opponent has not found yet does not shine for the opponent either.
    const glower = glows(tile.living) ? tile.living : glows(tile.object) ? tile.object : undefined;
    if (glower === undefined) return;
    const side = getSide(glower);
    if (!isSeen(tile, side)) return;
    const { x, y } = getPosition(index);
    // How grown the thing shining is, which is the whole of what a level does: it is stamped
    // onto every rainbow this light makes, and everything downstream — the drops, the sweets a
    // tree is fed, how wide the light is drawn — is read back off that. See getUnicornLevel.
    const level = getUnicornLevel(tile);

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        // the source sits one step away, the rainbow one further along the same line
        const source = getTile(map, { x: x + dx, y: y + dy })?.object;
        if ((!dx && !dy) || !refracts(source)) continue;
        // Which currency this line-up is for. Decided once here, from the one tile that says it,
        // and stamped on both the beam and the rainbow it makes.
        const isCandy = source === GameObjectType.TREE;
        const position = { x: x + 2 * dx, y: y + 2 * dy };
        const target = getTile(map, position);
        // An occupied tile swallows the light, and that is the whole of the contest over a
        // source: the first rainbow onto a tile holds it, and the other side's light dies in
        // the source until whoever is holding it walks away. Nothing new had to be written
        // for that — a rainbow has always needed empty ground, and the other side's rainbow is
        // ground like any other. Two glowers can never want the *same* tile off the same
        // source (the target is fixed by where the glower stands), so the only collisions
        // are two different sources casting onto one tile, which row-major order settles.
        const isLit = !!target && target.object === undefined && target.living === undefined;

        if (isLit) {
          target.object = SIDE_RAINBOW[side];
          target.seen |= 1 << side; // its own light lifts its own side's fog over it
          target.light = level; // how big this rainbow is, for everything that reads it later
          target.candy = isCandy; // and which of the two counters it pays into
          map.rainbowCounts[side]++;
        }

        // Only a rainbow that got there is drawn at the level's full width: an unlit beam is
        // light that came to nothing, and three lines of nothing would read as three times as
        // much of it. The count stays the rainbow's worth throughout.
        //
        // And it is drawn in the colour of what it is carrying: the water blue of the purse, or
        // the candy red of the jar. That colour is the tile in the middle of the line-up and
        // nothing else, so which of the two things a unicorn is doing can be read off the board
        // at a glance — including where the light died, which is where a player was one tile off.
        map.beams.push({
          x,
          y,
          dx,
          dy,
          isLit,
          isCandy,
          side,
          lines: isLit ? level : 1,
        });
      }
    }
  });

  // What each side takes next turn: every rainbow it has shining, plus the flat pay of every
  // bathtub it owns. Counted from the tiles rather than kept as a number of its own, so a tub
  // built mid-run starts paying without anything having to be told about it — and a tub site
  // raised by the opponent starts paying the opponent for exactly the same reason.
  //
  // **The rainbow is the earner, and the source it came through only says what it earns in.**
  // Which one that was is already on the tile (see Tile.candy), so this pass asks nothing about
  // the board around a rainbow: getRainbowIncome reads the stamp, and it is the one place the
  // question is answered.
  //
  // Rainbows are summed by their `light` rather than counted, which is the one place a grown
  // unicorn's water actually arrives; `rainbowCounts` stays a count, because the score is about
  // how much is built and not about how big it is.
  //
  // A second pass, after the first has put every rainbow on the board: the bathtubs are counted
  // in the same sweep, and a tub is not something the first pass knows about.
  //
  // A lollipop is neutral scenery, exactly like the fountain beside it: it bends whoever's light
  // reaches it. So one lollipop can be casting a rainbow for each side at once, off opposite
  // sides of itself, and there is nothing to own or to take.
  map.dropIncome = [0, 0];
  map.candyIncome = [0, 0];

  map.tiles.forEach((tile, index) => {
    const position = getPosition(index);

    SIDES.forEach((side) => {
      if (tile.object === SIDE_BATHTUB[side]) map.dropIncome[side] += BASE_INCOME;
      if (tile.object !== SIDE_RAINBOW[side]) return;

      const [currency, amount] = getRainbowIncome(map, position);
      (currency ? map.candyIncome : map.dropIncome)[side] += amount;
    });
  });
}

/**
 * What the rainbow on this tile pays next turn: which of the two currencies, and how much of it.
 * The currency is the index the interface already sorts everything by — 0 water, 1 sweets; the
 * same numbering ChestLoot is deliberately built on.
 *
 * **A rainbow earns either water or sweets, never both**, and what decides it is the tile the
 * light bent through on the way here: a fountain pays into the purse, a lollipop into the jar.
 * Both were decided when the rainbow was cast and are lying on the tile, so this is a read and
 * not a search — which is also what makes the rule sayable in one line to a player: line the
 * unicorn up with the thing you want.
 *
 * The one place that question is answered, so the income the counter promises, what flies out of
 * the tile at the end of the turn, the colour the light is drawn in and what the tile says it is
 * making cannot come apart.
 */
export function getRainbowIncome(map: GameMap, position: Position): [currency: number, amount: number] {
  const tile = getTile(map, position)!;

  return [tile.candy ? 1 : 0, tile.light!];
}

function blocksMove(objectType: GameObjectType | undefined): boolean {
  return objectType !== undefined && OBJECT_CONFIG[objectType].blocksMove;
}

/** The neighbouring tiles a character standing on `from` may step onto — diagonals included, on the map and not blocked. */
export function getMoveTargets(map: GameMap, { x, y }: Position): Position[] {
  const targets: Position[] = [];

  for (let dy = -MOVE_RADIUS; dy <= MOVE_RADIUS; dy++) {
    for (let dx = -MOVE_RADIUS; dx <= MOVE_RADIUS; dx++) {
      const target = { x: x + dx, y: y + dy };
      const tile = getTile(map, target);
      if ((dx || dy) && tile && !blocksMove(tile.object) && !blocksMove(tile.living)) targets.push(target);
    }
  }

  return targets;
}

/**
 * Where a character standing on `from` can jump to: every other donut it has found, or an
 * empty list if it is not standing on a donut at all — which is what lets the interface ask
 * on every selection without checking first.
 *
 * Found ones only, and that is the fog rule rather than a portal rule: the far ends are
 * offered as tiles to tap now, and a highlighted cloud would announce what is hiding under it.
 * In practice it costs nothing, because arriving on a donut is what uncovers the rest of them
 * (see moveCharacter) — the one case it rules out is a unicorn bought straight onto a donut on
 * a board where nobody has walked one yet.
 */
export function getPortalTargets(map: GameMap, from: Position, side: Side): Position[] {
  const fromIndex = getIndex(from);
  const targets: Position[] = [];

  if (map.tiles[fromIndex].object === GameObjectType.DONUT) {
    map.tiles.forEach((tile, index) => {
      if (index !== fromIndex && isSeen(tile, side) && tile.object === GameObjectType.DONUT) targets.push(getPosition(index));
    });
  }

  return targets;
}

/**
 * A jump is on only if it is paid for and nobody else is standing on the far donut — "nobody"
 * of either side, since a tile holds one character whoever it belongs to. So a donut the
 * opponent is sitting on is a portal exit shut off, which is a thing worth doing on purpose.
 */
export function canUsePortal(map: GameMap, target: Position, side: Side): boolean {
  return map.drops[side] >= PORTAL_COST && getTile(map, target)!.living === undefined;
}

/**
 * What a step off `from` costs. A character standing on a custard steps anywhere it likes for
 * nothing; everybody else pays a drop. The cost is a property of where the walk *starts*, which
 * is the whole of what a custard is: reaching one costs the usual drop, and what it buys is the
 * next step in any of eight directions. So a custard is a springboard rather than a cheap tile —
 * worth walking to for where it lets you go, and worth nothing at all to stand on at the whistle.
 *
 * A single special case rather than a cost column in OBJECT_CONFIG: one branch is cheaper
 * than a field repeated across every row, and only one kind of tile differs.
 *
 * The fog rule stays, even though a character has by definition seen the tile it is standing on:
 * the bot's route search prices steps off tiles it has not reached yet (see getPath), and a
 * discount taken on a custard its side has not found would be a route planned on knowledge that
 * side does not have.
 */
export function getMoveCost(map: GameMap, from: Position, side: Side): number {
  const tile = getTile(map, from)!;

  return isSeen(tile, side) && tile.object === GameObjectType.CUSTARD ? 0 : MOVE_COST;
}

/**
 * Whether there is anything at all this side could still do this turn — a step it can pay for
 * (a free one off a custard counts), a jump, a unicorn it can buy, or a site it can raise.
 * The whole of what a tap can do, asked of the whole board at once, which is why it is here
 * rather than in the interface: it is the same four offers select() lights up, and the two
 * would go out of step if they were written twice.
 *
 * Both nudges towards ending the turn hang off it — the pulse on the button and the line in
 * the info panel — so it has to be exact in the direction of *silence*: it says "nothing" only
 * when there is provably nothing, and a jar of sweets with no tub field free is that case as
 * surely as an empty purse is.
 *
 * Only what this side has found. A tile under its own clouds is skipped whatever is on it, for
 * the same reason the fog rules skip a hidden glower: counting a unicorn the player has not met
 * would silently disarm the nudge on account of something they cannot act with.
 */
export function canAct(map: GameMap, side: Side): boolean {
  return map.tiles.some((tile, index) => {
    if (!isSeen(tile, side)) return false;
    const position = getPosition(index);

    // One tile is at most one of these three: somebody's unicorn is standing on it, or a tub of
    // this side's is built on it, or it is ground that might be a site. Ordered by how often
    // the answer is yes, so the common case is the first test rather than the last.
    // What a step costs is a question about the tile the unicorn is on, not about the tile it is
    // going to, so it is asked once and the targets only have to exist.
    return tile.living === SIDE_UNICORN[side]
      ? (getMoveCost(map, position, side) <= map.drops[side] && !!getMoveTargets(map, position).length) ||
          getPortalTargets(map, position, side).some((target) => canUsePortal(map, target, side))
      : tile.object === SIDE_BATHTUB[side]
        ? // getSpawnTargets comes back empty unless the jar can pay, so this is the price and the
          // room for a newcomer in one question
          !!getSpawnTargets(map, position).length
        : canBuild(map, position, side);
  });
}

/**
 * Steps the character on `from` onto `to` — `to` must come from getMoveTargets, or from
 * getPortalTargets for a jump.
 *
 * Arriving on a donut puts every other one on the map: the tile alone, with the cloud left
 * over everything around it. So the portal tells you where it goes rather than where you are
 * going, and a network of them is something the player can plan a route through — which is
 * the whole of what a third and fourth donut are for. The tiles beside them stay hidden,
 * so what has been given away is the exits, not the ground they open onto.
 */
export function moveCharacter(map: GameMap, from: Position, to: Position) {
  const fromTile = getTile(map, from)!;
  const toTile = getTile(map, to)!;
  toTile.living = fromTile.living;
  // How grown it is belongs to the unicorn, not to the ground it was standing on, so it comes
  // along — and is cleared behind it, or the tile would hand the next unicorn to walk over it a
  // level somebody else earned. Assigned rather than merged for the same reason: whatever the
  // destination remembers of an earlier occupant is not this one's.
  toTile.growth = fromTile.growth;
  fromTile.living = fromTile.growth = undefined;

  if (toTile.object === GameObjectType.DONUT) {
    // Only for the side that walked in. Whose walk it was is written on the character itself,
    // so nothing has to be passed in — and the network stays a thing each side has to find for
    // itself rather than a map the first arrival hands to both.
    const bit = 1 << getSide(toTile.living!);

    map.tiles.forEach((tile) => {
      if (tile.object === GameObjectType.DONUT) tile.seen |= bit;
    });
  }
}

/**
 * What the thing on this tile could be built into and what that costs, or undefined if it is
 * not a build site at all — which is what lets every caller ask without checking first.
 * The subtraction is the whole lookup: anything that is not one of the three sites lands
 * outside the table and comes back undefined.
 */
export function getBuild(objectType: GameObjectType | undefined): (typeof BUILD_TABLE)[number] | undefined {
  return objectType === undefined ? undefined : BUILD_TABLE[objectType - GameObjectType.TUB_SITE];
}

/**
 * Whether one of `side`'s own unicorns is standing anywhere in the surrounding 3x3 — someone
 * has to do the work, and it has to be someone of yours. The opponent standing beside a site
 * does not raise it for you: a site is a race to whoever gets a unicorn next to it and can
 * pay, and it is spent by whoever wins that.
 */
function hasNeighbour(map: GameMap, { x, y }: Position, side: Side): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if ((dx || dy) && getTile(map, { x: x + dx, y: y + dy })?.living === SIDE_UNICORN[side]) return true;
    }
  }

  return false;
}

/**
 * Whether the site on `position` can be raised right now: a unicorn has to be standing beside
 * it to do the work, and the purse and the jar have to cover it between them. Both halves live
 * here rather than in the interface, so what the button offers and what the build actually
 * takes can never come apart — the same reason getSpawnTargets owns the tub's price.
 */
export function canBuild(map: GameMap, position: Position, side: Side): boolean {
  const build = getBuild(getTile(map, position)?.object);

  // There is no "and nothing is standing on it" here because a site blocks movement, so
  // nothing can be: no step, no purchase and no chest prize will put a character on one.
  // Should sites ever go walk-through again, that check has to come back with them — a
  // building cannot appear underneath a character.
  return !!build && map.drops[side] >= build[1] && map.candy[side] >= build[2] && hasNeighbour(map, position, side);
}

/**
 * The sites in the surrounding 3x3 that `side` could raise right now — the build's answer to
 * getMoveTargets, and asked of the unicorn rather than of the site: what the thing the player
 * has picked up can do from where it is standing.
 *
 * Every one that comes back satisfies canBuild, so the price and "somebody is beside it" come
 * along for free — the neighbour canBuild is looking for is the very unicorn being asked. No
 * fog rule is needed either: VISION_RADIUS is 1, so a tile beside one of your unicorns has
 * been seen by that unicorn since the moment it arrived.
 *
 * Empty for anything that is not one of this side's unicorns, which is what lets the
 * interface ask it of whatever has been selected without checking what that is first.
 */
export function getBuildTargets(map: GameMap, { x, y }: Position, side: Side): Position[] {
  const sites: Position[] = [];

  if (getTile(map, { x, y })?.living === SIDE_UNICORN[side]) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const position = { x: x + dx, y: y + dy };
        if ((dx || dy) && canBuild(map, position, side)) sites.push(position);
      }
    }
  }

  return sites;
}

/**
 * Raises what the site on `position` is for — which must satisfy canBuild. The site is spent:
 * the building stands in its place, and there is nothing left to build there.
 *
 * Nothing has to be told that the board has changed. A new tub starts paying its flat income
 * because the income counts tub tiles, a rebuilt fountain can be lit the moment a unicorn is
 * beside it, and a grown tree earns as soon as a rainbow reaches it — all of it recomputed
 * from the tiles, which is what this one call does.
 *
 * A filled tub also lifts the fog around itself, and that is the one build that does. The
 * unicorn that raised it stands beside it and has seen only its own square, so up to five of
 * the tub's eight fields can still be under cloud — and those fields are what the tub is *for*.
 * A newcomer would then be put down blind, onto a tile the player cannot see. The tub is where
 * unicorns come from, so it gets to look at where it is putting them.
 */
export function build(map: GameMap, position: Position, side: Side) {
  const [built, drops, candy] = getBuild(getTile(map, position)!.object)!;

  map.drops[side] -= drops;
  map.candy[side] -= candy;
  // A fountain and a lollipop tree come out neutral — they are scenery either side can use,
  // and the light rule does not care who paid for it. A tub is the one build that belongs to
  // whoever raised it, because it is an income and a place to buy unicorns, and both of those
  // have to be somebody's. Which makes the middle tub site the sharpest thing on the board:
  // one of you gets a second base in the middle of the map, and the other does not.
  const isTub = built === GameObjectType.BATHTUB;
  getTile(map, position)!.object = isTub ? SIDE_BATHTUB[side] : built;
  if (isTub) revealAround(map, position, side);
  updateRainbows(map);
}

/**
 * Opens the chest a character has just stepped onto and reports what was inside, or undefined
 * if there was no chest there — which is what lets the caller run it on every step without
 * asking first. The chest is spent either way: the ground goes back to plain meadow, so the
 * tile can take a rainbow from then on.
 *
 * A unicorn comes out onto the tile the opener came from. It is vacated a step ago, so it is
 * always free and the prize can never be lost for want of room — and it is the tile the player
 * was looking at a moment before, which a random free neighbour was not: a newcomer put down on
 * one of eight tiles was the only thing in the game that happened where nobody was watching.
 * The reading it buys is "the one you were moving brought another one with it", and the two
 * tiles it happens on are the two the eye is already on.
 *
 * The origin is a neighbour whatever the step was: a jump lands on a donut, and a tile holds one
 * object, so a portal can never land on a present at all.
 *
 * Nothing is revealed around the newcomer, and that is not an omission: the opener has just been
 * standing there, so that square is out of its own side's cloud by definition — every way onto a
 * tile lifts the fog around it (see revealAround's callers).
 *
 * Called before the rainbows are recomputed — a unicorn out of a chest may be standing next to
 * a fountain, and a chest lifted off a tile may have been in a rainbow's way.
 */
export function openChest(map: GameMap, position: Position, side: Side, from: Position): ChestLoot | undefined {
  const tile = getTile(map, position)!;
  const loot = tile.loot;

  if (loot === undefined) return undefined;

  tile.object = tile.loot = undefined;

  if (loot === ChestLoot.DROPS) map.drops[side] += CHEST_DROPS;
  else if (loot === ChestLoot.CANDY) map.candy[side] += CHEST_CANDY;
  else getTile(map, from)!.living = SIDE_UNICORN[side];

  return loot;
}

/**
 * What the board has built, counted: rainbows shining and unicorns found. Nothing is banked,
 * so this is live all through the run and its reading when the last turn closes is the final
 * score. Because it is a snapshot rather than a total, the closing turn counts as much as the
 * opening one, and a rainbow that goes out takes its points with it.
 * The herd is counted the same way the fog rules count a glower: only what is out in the open.
 * Nothing hides in the fog any more, so today that is every unicorn there is.
 *
 * Returned in parts rather than as one number so the end-of-run panel can show its working,
 * and so the breakdown can never disagree with the total: getScore is built from these.
 *
 * The panel lists these in this order and pairs them with emoji by index — see SCORE_EMOJIS
 * in the component. Keep the two lists in step.
 */
export function getScoreParts(map: GameMap, side: Side): number[] {
  return [map.rainbowCounts[side], map.tiles.filter((tile) => tile.living === SIDE_UNICORN[side] && isSeen(tile, side)).length];
}

/**
 * How much of the board is no longer under cloud, as a whole percentage — which is also, to
 * the point, what one rainbow or one unicorn is worth. A whole number rather than a fraction
 * so that the working the panel prints is the arithmetic actually done: nothing rounds
 * anywhere, so the rows it shows always add up to the total it shows.
 */
export function getExploration(map: GameMap, side: Side): number {
  return ((map.tiles.filter((tile) => isSeen(tile, side)).length * 100) / map.tiles.length + 0.5) | 0;
}

/**
 * Everything built, each worth as many points as the board is percent uncovered — per side,
 * off that side's own clouds. So the two scores are the same arithmetic over two different
 * boards-as-known, and neither of you can lift the other's multiplier by exploring.
 */
export function getScore(map: GameMap, side: Side): number {
  return getScoreParts(map, side).reduce((total, count) => total + count, 0) * getExploration(map, side);
}

/**
 * Whether `side` still has a go to play this turn. Both sides do, all through the run, bar the
 * one exception: the rival does not play the closing turn.
 *
 * It is about where a run *ends* rather than about fairness. A turn is the player's go and then
 * the rival's, so with both sides playing to the whistle the last thing that ever happened was
 * the opponent moving — the result came up on somebody else's move, and a player's own closing
 * turn, the one the live score makes as valuable as the first, was answered before they could
 * see what it came to. Cutting the rival's last go rather than letting it open the turn keeps
 * the player moving first all run, which is the half of the arrangement worth keeping.
 *
 * The price is that the rival plays one go fewer than the player, and it is a real one — see
 * the 🌑 column in `npm run bot`. It is paid on purpose: the run ends on the player's move.
 *
 * Lives here rather than in the interface because the headless runs have to play the same game
 * the buttons do — the harness asks this too.
 */
export function hasGo(map: GameMap, side: Side): boolean {
  return side === PLAYER || map.turn < TURN_LIMIT;
}

/**
 * Ends the turn and collects what the board earns: drops to move with, candy to buy with.
 * Which is the same board, and so the same payment, whether it is called the end of this turn
 * or the start of the next — nothing happens in between. The one place the two differ is the
 * ends of the run, and both are settled here: the opening purse is seeded once by
 * createGameMap, and the closing turn pays out nothing at all.
 *
 * Nothing, because there would be nothing to do with it. Drops buy moves and sweets buy
 * unicorns, and there are no turns left to spend either in; neither is part of the score.
 * A final payout would be two counters going up for show, in front of a player waiting to see
 * their result. What keeps the last turn worth playing is not the money — it is that the score
 * is a live snapshot, so a rainbow lit on the closing turn counts as much as one lit on the
 * first.
 */
export function endTurn(map: GameMap, side: Side) {
  if (map.turn < TURN_LIMIT) {
    map.drops[side] += map.dropIncome[side];
    map.candy[side] += map.candyIncome[side];
  }
}

/**
 * Moves the clock on, once everybody with a go this turn has had it — which is both sides
 * every turn but the last, where the rival has none (see hasGo). Split out of endTurn because
 * with an opponent on the board a turn is now two goes — the player's, then the rival's — and
 * each of them is paid out as it closes while the turn number belongs to the pair of them.
 * Without an opponent the two calls sit side by side and mean exactly what the one used to.
 */
export function nextTurn(map: GameMap) {
  map.turn++;
  // Not past the whistle. The clock ticking one last time is what ends the run, and a herd
  // that grew on that tick would light a board nobody can play any more: a unicorn levelling
  // up widens its rainbow, so the last thing the player sees is beams multiplying underneath
  // a result that has already been counted. Growth belongs to turns that are going to be
  // played. Nothing else moves with it — the score counts rainbows rather than their size,
  // and the closing turn pays out nothing to earn with either (see endTurn).
  if (!isRunOver(map)) growUnicorns(map);
}

/**
 * Brings the herd up, once per turn rather than once per go: a unicorn shone or it did not for
 * the turn as a whole, and both sides have had their say by the time this runs. Both herds at
 * once and off the same rule, since it is the board's own light that decides it.
 *
 * Shining means at least one of its beams got through to a rainbow — read off `map.beams`, which
 * is the same list the income and the halos are drawn from, so what the player was shown glowing
 * all turn is exactly what grows. A unicorn under its own side's fog casts no light at all, so
 * it cannot grow either, for the same reason it cannot earn.
 *
 * A dark turn costs nothing: the counter simply does not move, so a unicorn can be sent off
 * across the board and pick up where it left off, and one that spends the rest of the run walking
 * simply stops climbing. It used to lose the progress towards the next level as well, which was a
 * punishment the player had no way of seeing — the rule is now the one the info panel states, a
 * level being so many turns spent shining, in total.
 */
function growUnicorns(map: GameMap) {
  const shining = new Set(map.beams.filter((beam) => beam.isLit).map(getIndex));

  map.tiles.forEach((tile, index) => {
    // only living things grow, and every one of them is a unicorn
    if (tile.living !== undefined && shining.has(index)) tile.growth = Math.min((tile.growth || 0) + 1, MAX_GROWTH);
  });

  // Both incomes are counted off the levels, so one gained just now leaves them out of date —
  // and nothing else would necessarily recount them: a player who ends the turn without moving
  // anything would go on being paid what the herd was worth before it grew up. Recounted
  // unconditionally rather than only when something grew, because it costs a fraction of what a
  // single step already costs and cannot then be wrong.
  updateRainbows(map);
}

/** The run has used up all its turns. */
export function isRunOver(map: GameMap): boolean {
  return map.turn > TURN_LIMIT;
}

/**
 * What the next unicorn costs: one sweet per unicorn already standing on the board. The herd
 * prices itself — the first newcomer is cheap, and every one after it costs what the herd has
 * grown to, which is the brake on an income that would otherwise compound away. It is counted
 * off the tiles rather than kept as a number, so it can never drift from the herd it prices.
 *
 * Sweets only, and that is a finding rather than an oversight. Charging drops as well was
 * tried, to drain the hundred-odd that a well-played big board has left over at the whistle,
 * and it cost 27-48% of the score on every board with an economy: drops buy steps, steps clear
 * fog, and fog is the score's own multiplier, so taxing the purse taxes exploring. The herd
 * came out *smaller* too, and the leftovers simply changed currency — unspent candy went from
 * 9.6 to 24.4 on the 25x25. The end-of-run purse is a last-few-turns artefact of nothing being
 * left in reach, not a currency sitting idle. Leave it alone.
 */
export function getUnicornPrice(map: GameMap, side: Side): number {
  return map.tiles.filter((tile) => tile.living === SIDE_UNICORN[side]).length;
}

/**
 * The fields a bathtub may put a new unicorn on: the neighbours a character could step onto,
 * which is exactly the right rule — a fountain or another unicorn is in the way, a custard or
 * a donut is not, and a rainbow lying there simply goes out under the newcomer. The list is
 * empty unless the jar can actually pay, so the board only ever lights fields that can be
 * taken up — the same rule under which a character's steps light up only if it can pay for
 * them.
 *
 * Which tub a field belongs to never has to be decided: every tub offers its own neighbours,
 * and a field between two of them is just offered twice.
 */
export function getSpawnTargets(map: GameMap, position: Position): Position[] {
  // Whose tub it is decides who is buying, so nothing has to be passed in — and a player
  // tapping the opponent's tub is offered nothing, because it is priced against a jar that
  // is not theirs and a herd that is not theirs either.
  const side = getSide(getTile(map, position)!.object!);

  return map.candy[side] >= getUnicornPrice(map, side) ? getMoveTargets(map, position) : [];
}

/** Trades the jar of candy for a unicorn on `position` — which must come from getSpawnTargets. */
export function buyUnicorn(map: GameMap, position: Position, side: Side) {
  map.candy[side] -= getUnicornPrice(map, side); // before the newcomer is on the board, so it does not price itself
  getTile(map, position)!.living = SIDE_UNICORN[side];
  // A newcomer opens its own square, exactly like one stepping out of a present or out of the
  // fog: the tub it came from has looked at its own fields, but the ring beyond them is still
  // cloud, and a unicorn standing in it can see.
  revealAround(map, position, side);
  updateRainbows(map); // and it may light a fountain straight away
}
