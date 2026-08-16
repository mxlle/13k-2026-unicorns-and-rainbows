import { setSeed } from "../utils/random-utils";
import { getRandomItem } from "../utils/array-utils";
import { ChestLoot, GameObjectType, ObjectCategory, OBJECT_CONFIG } from "./game-objects";

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
export let TREE_COUNT = 0; // free-roaming, on top of the one growing next to every fountain
export let FLOWER_COUNT = 0; // free stepping stones scattered over the meadow
export let CHEST_COUNT = 0; // what the fog is worth walking into
export let DONUT_COUNT = 0; // the portal: a pair, or nothing at all
export let SITE_COUNT = 0; // build sites, of each of the three kinds
export let TURN_LIMIT = 0; // the whole run — as many turns as the board is wide
export let MIN_PORTAL_DISTANCE = 0; // along both axes, so the pair sits diagonally across the board

export const VISION_RADIUS = 1; // Chebyshev: radius 1 = the surrounding 3x3

/**
 * PLACEHOLDER feature ladder: the board width at which each thing first turns up. The boards
 * are the levels, so the ladder is written in widths rather than in level numbers — MAP_SIZES
 * can gain or lose entries without a single number here moving.
 *
 * What this leaves on the smallest board is the tutorial: a unicorn, a scatter of flowers, one
 * fountain to line it up against, one present, and the bathtub that pays for the walking. Four
 * rules, and every one of them is still true on the 25x25.
 */
const TREE_SIZE = 7; // and with the trees comes candy, which is what gives the tub its second job
const DONUT_SIZE = 9;
const SITE_SIZE = 13;

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
 * three things that are not loops — the middle tub site, the portal pair and the tree beside
 * each fountain — read the count as the condition they are placed under.
 */
function setMapSize(size: number) {
  const tiles = size * size;
  MAP_SIZE = size;
  isTutorial = size === MAP_SIZES[0];
  FOUNTAIN_COUNT = (tiles / 27 + 0.5) | 0;
  TREE_COUNT = size < TREE_SIZE ? 0 : FOUNTAIN_COUNT;
  FLOWER_COUNT = (tiles / 12 + 0.5) | 0;
  // Rarer than anything else on the board, and the divisor is picked to land inside the
  // hand-set targets: 1 on the 7x7, 3 on the 13x13, 7 on the 21x21. Floored at one, because
  // the smallest board rounds down to none and its single present is the whole point of it.
  CHEST_COUNT = (tiles / 60 + 0.5) | 0 || 1;
  DONUT_COUNT = size < DONUT_SIZE ? 0 : 2;
  // Linear in the width rather than the area, the same as TURN_LIMIT and for the same reason:
  // what should stay steady across the boards is how many sites a run has the turns to reach,
  // not how many are on the map. Works out at 2 of each kind on the 13x13, 3 on the 21x21.
  SITE_COUNT = size < SITE_SIZE ? 0 : (size / 7 + 0.5) | 0;
  TURN_LIMIT = size;
  // Half the width, on both axes. Absolute distances stop meaning anything once the board
  // can be three times wider: four tiles apart is across the map at 7 and a stroll at 21.
  MIN_PORTAL_DISTANCE = size >> 1;
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
// It is a product rather than a sum: what the board has built is worth a hundred apiece, and
// the share of the board no longer under cloud multiplies the lot. Exploring is therefore
// worth nothing on its own — an empty board fully uncovered still scores nothing — and
// building is worth only as much of itself as the player has bothered to look at. Neither
// half of the run can be skipped for the other, which two added terms would have allowed.
const SCORE_PER_ECONOMY = 100; // per rainbow shining, per unicorn found
// Lollipop trees no longer score. They still earn the candy that buys unicorns, so a tree is
// worth growing for what it leads to rather than for being there.
export const MOVE_COST = 1; // water drops per step
export const PORTAL_COST = MOVE_COST + 1; // a jump between the two donuts costs one drop more than a step
// PLACEHOLDER: what one bathtub pays into the purse every turn, come what may. It is the
// floor under the economy — with it, a run can never seize up, which is why there is no
// losing any more. Every tub on the board pays it, so a second one doubles the base.
export const BASE_INCOME = 2;
// PLACEHOLDER chest contents. Flat rather than scaled by the turn, which makes them worth
// most in the opening — five drops is two and a half turns' income while the tub is the whole
// economy, and barely half a turn's once the rainbows are up. That decay is the point: the
// slow part of a run is the start, and this is what shortens it.
export const CHEST_DROPS = 5;
export const CHEST_CANDY = 2;
// What is inside, rolled from this list: writing the two common outcomes twice is the whole
// weighting — 40% drops, 40% candy, 20% a unicorn. A unicorn is worth far more than either
// pile, so it comes up half as often as they do.
const LOOT_TABLE = [ChestLoot.DROPS, ChestLoot.DROPS, ChestLoot.CANDY, ChestLoot.CANDY, ChestLoot.UNICORN];
// PLACEHOLDER build prices. The shape is settled even where the numbers are not: a building is
// paid for in the currency it goes on to produce — a fountain in water, a lollipop tree in
// sweets — and the tub, which produces both, is paid for in both, equally.
// Indexed by site type less the first site, which is why the three sites are consecutive
// members at the end of the enum: it makes this a three-entry array rather than a lookup with
// holes in it where the real objects are.
const BUILD_TABLE: [built: GameObjectType, drops: number, candy: number][] = [
  [GameObjectType.BATHTUB, 4, 4],
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
  isRevealed: boolean;
  // Two layers: living things walk over whatever lies on the ground and are drawn
  // on top of it, so a rainbow stays put when the unicorn steps onto its tile.
  object?: GameObjectType; // ground layer — GOAL / STATIC
  living?: GameObjectType; // entity layer — LIVING
  // What the chest on this tile is holding, on the handful of tiles that have one. Rolled
  // when the board is built rather than when the chest is opened, so a seed determines its
  // prizes as completely as it determines where they are.
  loot?: ChestLoot;
}

/** A ray of light leaving a glowing tile towards the fountain one step away in (dx, dy). */
export interface Beam extends Position {
  dx: number;
  dy: number;
  isLit: boolean; // the light got through and made a rainbow, instead of dying in the fountain
  // The pink kind, which is not light at all: a rainbow feeding the lollipop tree beside it.
  // Never lit — it spans the one tile between the two, the same reach as a beam that stopped
  // inside a fountain, so the two share the width the renderer works out from isLit.
  isCandy: boolean;
}

export interface GameMap {
  tiles: Tile[]; // flat, row-major: index = y * MAP_SIZE + x
  rainbowCount: number; // rainbows shining right now — recomputed after every move
  beams: Beam[]; // what the light is doing, recomputed alongside the rainbows
  drops: number; // water drops in the purse; they buy steps and are banked across turns
  candy: number; // sweets in the jar; they buy unicorns and are banked the same way
  dropIncome: number; // the bathtubs' flat pay plus every rainbow shining — recomputed with them
  candyIncome: number; // lollipop trees earning right now — recomputed alongside the rainbows
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
    tiles: Array.from({ length: MAP_SIZE * MAP_SIZE }, () => ({ isRevealed: false })),
    rainbowCount: 0,
    beams: [],
    drops: 0,
    candy: 0,
    dropIncome: 0,
    candyIncome: 0,
    turn: 1,
  };

  // The base: it pays BASE_INCOME every turn without needing anything set up around it,
  // and it is where new unicorns come from. That is the whole opening — no worked example
  // of the light rule in the corner any more; the player meets that out in the fog.
  getTile(map, TUB_POSITION)!.object = GameObjectType.BATHTUB;

  getTile(map, UNICORN_START)!.living = GameObjectType.UNICORN;
  revealAround(map, UNICORN_START);

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

  // Fountains keep one tile of distance to the border, so every side of a fountain has an
  // opposite tile to cast a rainbow onto, and their share of the board from each other.
  for (let i = 0; i < FOUNTAIN_COUNT; i++) {
    const position = placeObject(map, GameObjectType.FOUNTAIN, FOUNTAIN_COUNT, 1);
    // A lollipop tree grows next to every fountain, taking one of its eight rainbow
    // slots away — once the board is one that has trees at all.
    const spots = TREE_COUNT && position ? getFreeNeighbours(map, position) : [];
    if (spots.length) getTile(map, getRandomItem(spots))!.object = GameObjectType.TREE;
  }

  // The portal pair: placed early, because its rule is the hardest on the board to satisfy.
  // The two ends keep MIN_PORTAL_DISTANCE along *both* axes, so they never share a row or a
  // column — a jump that only slides sideways reads as a move rather than a portal, however
  // many tiles it covers.
  // The first end is drawn only from tiles that still have a legal partner free. Picking it
  // blindly can strand the second end with nowhere to go — a donut in the middle of the
  // board has only the four corners to pair with — and placeObject would then drop the rule
  // rather than the donut, which is how a portal ends up leading to the tile next door.
  // Taking the first end off the board cannot invalidate the partner it was chosen for, so
  // the second placement always finds its spot and the rule never has to be relaxed.
  // A portal is a pair or it is nothing, so the whole block is gated rather than a loop count.
  if (DONUT_COUNT) {
    const spots = getFreePositions(map, 0);
    const pairable = spots.filter((a) => spots.some((b) => getAxisDistance(a, b) >= MIN_PORTAL_DISTANCE));
    getTile(map, getRandomItem(pairable.length ? pairable : spots))!.object = GameObjectType.DONUT;
    placeObject(map, GameObjectType.DONUT, DONUT_COUNT, 0, MIN_PORTAL_DISTANCE);
  }

  // No unicorns are placed here: the one at the start position is the whole herd a run
  // begins with, and every other one is bought from a tub. Nothing waits in the fog.
  // Twice TREE_COUNT: one tree already grew beside every fountain, and the spacing is
  // worked out from how many end up on the board, not from how many this loop places.
  for (let i = 0; i < TREE_COUNT; i++) placeObject(map, GameObjectType.TREE, TREE_COUNT * 2);
  for (let i = 0; i < FLOWER_COUNT; i++) placeObject(map, GameObjectType.FLOWER, FLOWER_COUNT);

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

  // The rubble keeps a fountain's own margin: a fountain on the border has sides with no tile
  // opposite to cast a rainbow onto, and a rebuilt one is no different from a found one.
  // Before the seedlings, which are placed against it.
  for (let i = 0; i < SITE_COUNT; i++) placeObject(map, GameObjectType.FOUNTAIN_SITE, SITE_COUNT, 1);

  // Seedlings go only where the tree they become would have something to feed on. A tree earns
  // off a rainbow and a rainbow lands beside a fountain, so a seedling anywhere else is an
  // offer that could never pay for itself — and an offer the player has to learn to turn down
  // is worse than no offer at all.
  for (let i = 0; i < SITE_COUNT; i++) {
    const spots = getSeedlingSpots(map);
    if (spots.length) getTile(map, getRandomItem(spots))!.object = GameObjectType.TREE_SITE;
  }

  updateRainbows(map);
  map.drops = map.dropIncome; // the opening purse is one turn's income — the tub's, since nothing shines yet

  return map;
}

/** Nothing on it and still under the fog — where something new may be placed. */
function isFree(tile: Tile | undefined): boolean {
  return !!tile && !tile.isRevealed && tile.object === undefined && tile.living === undefined;
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
 * `margin` is the distance it keeps from the border, and `axisSpacing` demands that much
 * along *both* axes — the rule that stops the donut pair from lining up in one row or column.
 * Which layer it lands on follows from its category, so a unicorn walks over the ground and a
 * fountain becomes part of it.
 *
 * The spacing is stepped down rather than dropped when nothing satisfies it: the last few
 * things onto a filling board still get placed as far apart as that board still allows,
 * instead of falling back to no rule and landing in the first heap they find. It is also what
 * makes generation total — the loop is bounded by the spacing, so it can never spin looking
 * for a spot that is not there. `axisSpacing` is never relaxed, because it never has to be:
 * the donut pair is placed onto an empty board where its rule is always satisfiable.
 */
function placeObject(map: GameMap, objectType: GameObjectType, count = 1, margin = 0, axisSpacing = 0): Position | undefined {
  const free = getFreePositions(map, margin);
  const taken = getPositionsOf(map, objectType);
  let candidates = free;

  for (let spacing = getSpacing(count); spacing > 1; spacing--) {
    const spaced = free.filter((position) =>
      taken.every((other) => getDistance(position, other) >= spacing && getAxisDistance(position, other) >= axisSpacing),
    );

    if (spaced.length) {
      candidates = spaced;
      break;
    }
  }

  if (!candidates.length) return undefined;

  const position = getRandomItem(candidates);
  const tile = getTile(map, position)!;

  if (OBJECT_CONFIG[objectType].category === ObjectCategory.LIVING) tile.living = objectType;
  else tile.object = objectType;

  return position;
}

/**
 * The free tiles beside a fountain, or beside rubble that may yet become one — the only places
 * a seedling is worth offering, since a lollipop tree pays only off a rainbow and a rainbow
 * only ever lands beside a fountain. Rubble counts: the player who rebuilds it has every
 * reason to grow the tree next to it, and the two together are a plan rather than two offers.
 */
function getSeedlingSpots(map: GameMap): Position[] {
  return getFreePositions(map, 0).filter(({ x, y }) => {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const object = getTile(map, { x: x + dx, y: y + dy })?.object;
        if ((dx || dy) && (object === GameObjectType.FOUNTAIN || object === GameObjectType.FOUNTAIN_SITE)) return true;
      }
    }

    return false;
  });
}

/** The free tiles of the surrounding 3x3 — the spots where a fountain's tree may grow. */
function getFreeNeighbours(map: GameMap, { x, y }: Position): Position[] {
  const free: Position[] = [];

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const position = { x: x + dx, y: y + dy };
      if ((dx || dy) && isFree(getTile(map, position))) free.push(position);
    }
  }

  return free;
}

/** Uncovers the vision square around a position. Revealed tiles stay revealed. */
export function revealAround(map: GameMap, { x, y }: Position) {
  for (let dy = -VISION_RADIUS; dy <= VISION_RADIUS; dy++) {
    for (let dx = -VISION_RADIUS; dx <= VISION_RADIUS; dx++) {
      const position = { x: x + dx, y: y + dy };
      const tile = getTile(map, position);

      if (tile && !tile.isRevealed) {
        tile.isRevealed = true;
        // a character coming out of the fog opens its own vision right away — and may
        // in turn uncover the next one (the recursion ends, tiles only ever un-fog once)
        if (tile.living !== undefined) revealAround(map, position);
      }
    }
  }
}

function glows(objectType: GameObjectType | undefined): boolean {
  return objectType !== undefined && OBJECT_CONFIG[objectType].glows;
}

/**
 * Rainbows are pure light, not scenery: the glow of a unicorn (or of the sun) refracts
 * through a fountain it stands next to and lands on the tile directly opposite.
 * Recomputed from scratch after every move, so a rainbow fades the moment its unicorn
 * walks away. A tile that is off the map or already taken swallows the light — that
 * angle produces no rainbow, only an unlit beam that stops inside the fountain.
 * A glower still under the fog stays dark: its light only starts once it is revealed.
 */
export function updateRainbows(map: GameMap) {
  map.tiles.forEach((tile) => {
    if (tile.object === GameObjectType.RAINBOW) tile.object = undefined;
  });

  map.rainbowCount = 0;
  map.beams = [];

  map.tiles.forEach((tile, index) => {
    if (!tile.isRevealed || (!glows(tile.living) && !glows(tile.object))) return;
    const { x, y } = getPosition(index);

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        // the fountain sits one step away, the rainbow one further along the same line
        if ((!dx && !dy) || getTile(map, { x: x + dx, y: y + dy })?.object !== GameObjectType.FOUNTAIN) continue;
        const target = getTile(map, { x: x + 2 * dx, y: y + 2 * dy });
        const isLit = !!target && target.object === undefined && target.living === undefined;

        if (isLit) {
          target.object = GameObjectType.RAINBOW;
          target.isRevealed = true; // its own light lifts the fog over it
          map.rainbowCount++;
        }

        map.beams.push({ x, y, dx, dy, isLit, isCandy: false });
      }
    }
  });

  // What the purse takes next turn: every rainbow shining, plus the flat pay of every
  // bathtub on the board. Counted from the tiles rather than kept as a number of its own,
  // so a tub built mid-run starts paying without anything having to be told about it.
  map.dropIncome = map.rainbowCount + BASE_INCOME * map.tiles.filter((tile) => tile.object === GameObjectType.BATHTUB).length;

  // The second income, counted once the rainbows are in place: a lollipop tree standing
  // next to one turns the light into sweets. One candy per earning tree, however many
  // rainbows happen to surround it — a tree either pays out or it does not.
  // Only trees the player has found earn: an unseen one paying into the jar would give
  // its position away, the same reason a fogged glower casts no light.
  // Each one also gets a pink beam from the rainbow that feeds it, drawn in the same pass so
  // the line the player sees and the candy the jar is paid are counted from the same pairing.
  map.candyIncome = 0;

  map.tiles.forEach((_, index) => {
    const position = getPosition(index);
    const rainbow = getFeedingRainbow(map, position);

    if (!rainbow) return;

    map.candyIncome++;
    map.beams.push({ ...rainbow, dx: position.x - rainbow.x, dy: position.y - rainbow.y, isLit: false, isCandy: true });
  });
}

/**
 * The rainbow making a lollipop tree earn, or undefined if this tile is not a tree, is one
 * the player has not found, or has no rainbow beside it. One rainbow rather than all of
 * them: the tree pays a single candy however many surround it, so a single beam is what
 * says so — the pairing is what earns, not the count.
 */
function getFeedingRainbow(map: GameMap, { x, y }: Position): Position | undefined {
  const tile = getTile(map, { x, y })!;

  if (!tile.isRevealed || tile.object !== GameObjectType.TREE) return undefined;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const position = { x: x + dx, y: y + dy };
      if ((dx || dy) && getTile(map, position)?.object === GameObjectType.RAINBOW) return position;
    }
  }

  return undefined;
}

/**
 * Whether a tile is a lollipop tree that is earning right now — one candy's worth of the
 * income above. The board draws its trees from this too, so what the player sees glowing
 * and what the jar is paid cannot drift apart.
 */
export function isEarningTree(map: GameMap, position: Position): boolean {
  return !!getFeedingRainbow(map, position);
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
 * The far end of the portal for a character standing on `from` — undefined if it is not
 * standing on a donut. The target may still be under the fog: the jump is offered as an
 * action rather than a highlighted tile precisely so it does not give its place away.
 */
export function getPortalTarget(map: GameMap, from: Position): Position | undefined {
  const fromIndex = getIndex(from);
  if (map.tiles[fromIndex].object !== GameObjectType.DONUT) return undefined;
  const index = map.tiles.findIndex((tile, i) => i !== fromIndex && tile.object === GameObjectType.DONUT);

  return index < 0 ? undefined : getPosition(index);
}

/** A jump is on only if it is paid for and nobody else is standing on the far donut. */
export function canUsePortal(map: GameMap, target: Position): boolean {
  return map.drops >= PORTAL_COST && getTile(map, target)!.living === undefined;
}

/**
 * What stepping onto `to` costs. A flower is free — the one way to move without paying,
 * which is what turns a scattering of them into something worth routing through.
 * A single special case rather than a cost column in OBJECT_CONFIG: one branch is cheaper
 * than a field repeated across every row, and only one kind of tile differs.
 *
 * Only a flower the player can actually see is free, and that is a fog rule rather than a
 * pricing one: a free step is offered, highlighted and counted as a way out of an empty
 * purse, so a discount on a tile still under a cloud would announce what is hiding there.
 * Stepping blindly costs the usual drop; from then on the flower is known, and free.
 */
export function getMoveCost(map: GameMap, to: Position): number {
  const tile = getTile(map, to)!;

  return tile.isRevealed && tile.object === GameObjectType.FLOWER ? 0 : MOVE_COST;
}

/**
 * Whether any character the player can see has a free step available — with an empty purse,
 * the only thing that can still happen. The "end your turn" nudge hangs off this, so that a
 * player standing next to a flower is not pushed on while there is still something to do.
 * Characters under the fog are left out on purpose: counting one would silently disarm the
 * nudge on account of a unicorn the player has not even found yet.
 */
export function hasFreeMove(map: GameMap): boolean {
  return map.tiles.some(
    (tile, index) =>
      tile.isRevealed && tile.living !== undefined && getMoveTargets(map, getPosition(index)).some((target) => !getMoveCost(map, target)),
  );
}

/** Steps the character on `from` onto `to` — `to` must come from getMoveTargets. */
export function moveCharacter(map: GameMap, from: Position, to: Position) {
  const fromTile = getTile(map, from)!;
  getTile(map, to)!.living = fromTile.living;
  fromTile.living = undefined;
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

/** Whether a character is standing anywhere in the surrounding 3x3 — someone has to do the work. */
function hasNeighbour(map: GameMap, { x, y }: Position): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if ((dx || dy) && getTile(map, { x: x + dx, y: y + dy })?.living !== undefined) return true;
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
export function canBuild(map: GameMap, position: Position): boolean {
  const build = getBuild(getTile(map, position)?.object);

  // There is no "and nothing is standing on it" here because a site blocks movement, so
  // nothing can be: no step, no purchase and no chest prize will put a character on one.
  // Should sites ever go walk-through again, that check has to come back with them — a
  // building cannot appear underneath a character.
  return !!build && map.drops >= build[1] && map.candy >= build[2] && hasNeighbour(map, position);
}

/**
 * Raises what the site on `position` is for — which must satisfy canBuild. The site is spent:
 * the building stands in its place, and there is nothing left to build there.
 *
 * Nothing has to be told that the board has changed. A new tub starts paying its flat income
 * because the income counts tub tiles, a rebuilt fountain can be lit the moment a unicorn is
 * beside it, and a grown tree earns as soon as a rainbow reaches it — all of it recomputed
 * from the tiles, which is what this one call does.
 */
export function build(map: GameMap, position: Position) {
  const [built, drops, candy] = getBuild(getTile(map, position)!.object)!;

  map.drops -= drops;
  map.candy -= candy;
  getTile(map, position)!.object = built;
  updateRainbows(map);
}

/**
 * Opens the chest a character has just stepped onto and reports what was inside, or undefined
 * if there was no chest there — which is what lets the caller run it on every step without
 * asking first. The chest is spent either way: the ground goes back to plain meadow, so the
 * tile can take a rainbow from then on.
 *
 * A unicorn needs somewhere to stand, and there is always somewhere: the tile the opener came
 * from is a neighbour of this one and it was vacated a moment ago, so the list is never empty
 * and the prize can never be lost for want of room. It lights its own surroundings on arrival,
 * the same as any character stepping out of the fog.
 *
 * Called before the rainbows are recomputed — a unicorn out of a chest may be standing next to
 * a fountain, and a chest lifted off a tile may have been in a rainbow's way.
 */
export function openChest(map: GameMap, position: Position): ChestLoot | undefined {
  const tile = getTile(map, position)!;
  const loot = tile.loot;

  if (loot === undefined) return undefined;

  tile.object = tile.loot = undefined;

  if (loot === ChestLoot.DROPS) map.drops += CHEST_DROPS;
  else if (loot === ChestLoot.CANDY) map.candy += CHEST_CANDY;
  else {
    const spot = getRandomItem(getMoveTargets(map, position));
    getTile(map, spot)!.living = GameObjectType.UNICORN;
    revealAround(map, spot);
  }

  return loot;
}

/**
 * What the board has built, in parts: rainbows shining and unicorns found, a hundred apiece.
 * Nothing is banked, so this is live all through the run and its reading when the last turn
 * closes is the final score. Because it is a snapshot rather than a total, the closing turn
 * counts as much as the opening one, and a rainbow that goes out takes its points with it.
 * The herd is counted the same way the fog rules count a glower: only what is out in the open.
 * Nothing hides in the fog any more, so today that is every unicorn there is.
 *
 * Returned in parts rather than as one number so the end-of-run panel can show its working,
 * and so the breakdown can never disagree with the total: getScore is built from these.
 */
export function getScoreParts(map: GameMap): [count: number, weight: number][] {
  const herd = map.tiles.filter((tile) => tile.isRevealed && tile.living === GameObjectType.UNICORN).length;

  // The end-of-run panel lists these in this order and pairs them with emoji by index —
  // see SCORE_EMOJIS in the component. Keep the two lists in step.
  return [
    [map.rainbowCount, SCORE_PER_ECONOMY],
    [herd, SCORE_PER_ECONOMY],
  ];
}

/**
 * How much of the board is no longer under cloud, as a whole percentage — the multiplier on
 * everything built. A percentage rather than a fraction so that the working the end-of-run
 * panel prints is the arithmetic actually done: rounding once here and once again on the
 * total would let the shown sum miss the shown answer by one.
 */
export function getExploration(map: GameMap): number {
  return ((map.tiles.filter((tile) => tile.isRevealed).length * 100) / map.tiles.length + 0.5) | 0;
}

/** The parts added up and then scaled by how much of the board has been seen. */
export function getScore(map: GameMap): number {
  const built = getScoreParts(map).reduce((total, [count, weight]) => total + count * weight, 0);

  return ((built * getExploration(map)) / 100 + 0.5) | 0;
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
export function endTurn(map: GameMap) {
  if (map.turn < TURN_LIMIT) {
    map.drops += map.dropIncome;
    map.candy += map.candyIncome;
  }

  map.turn++;
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
 */
export function getCandyPrice(map: GameMap): number {
  return map.tiles.filter((tile) => tile.living === GameObjectType.UNICORN).length;
}

/**
 * The fields a bathtub may put a new unicorn on: the neighbours a character could step onto,
 * which is exactly the right rule — a fountain or another unicorn is in the way, a flower or
 * a donut is not, and a rainbow lying there simply goes out under the newcomer. The list is
 * empty unless the jar can actually pay, so the board only ever lights fields that can be
 * taken up — the same rule under which a character's steps light up only if it can pay for
 * them.
 *
 * Which tub a field belongs to never has to be decided: every tub offers its own neighbours,
 * and a field between two of them is just offered twice.
 */
export function getSpawnTargets(map: GameMap, position: Position): Position[] {
  return map.candy >= getCandyPrice(map) ? getMoveTargets(map, position) : [];
}

/** Trades the jar of candy for a unicorn on `position` — which must come from getSpawnTargets. */
export function buyUnicorn(map: GameMap, position: Position) {
  map.candy -= getCandyPrice(map); // before the newcomer is on the board, so it does not price itself
  getTile(map, position)!.living = GameObjectType.UNICORN;
  // it stands beside a tub the player was looking at, so there is no fog for the newcomer
  // to lift — but it may light a fountain straight away
  updateRainbows(map);
}
