import { setSeed } from "../utils/random-utils";
import { getRandomItem } from "../utils/array-utils";
import { GameObjectType, ObjectCategory, OBJECT_CONFIG } from "./game-objects";

// PLACEHOLDER: the boards on offer. Odd numbers so a board has a true middle, and spaced
// far enough apart that picking one is a real choice rather than a nudge.
export const MAP_SIZES = [7, 13, 21];

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
export let TURN_LIMIT = 0; // the whole run — as many turns as the board is wide
export let MIN_PORTAL_DISTANCE = 0; // along both axes, so the pair sits diagonally across the board

export const VISION_RADIUS = 1; // Chebyshev: radius 1 = the surrounding 3x3

/**
 * Sizes the world. The counts are given as "one per this many tiles", so a bigger board
 * gets proportionally busier instead of emptier — the divisors are what the hand-tuned 9x9
 * worked out to. Turns scale with the width rather than the area: income compounds over a
 * run, so the ground a player can cover grows roughly with the square of the turns, which
 * is what keeps the share of the map they get to see about the same on every board.
 */
function setMapSize(size: number) {
  const tiles = size * size;
  MAP_SIZE = size;
  FOUNTAIN_COUNT = TREE_COUNT = (tiles / 27 + 0.5) | 0;
  FLOWER_COUNT = (tiles / 12 + 0.5) | 0;
  TURN_LIMIT = size;
  // Half the width, on both axes. Absolute distances stop meaning anything once the board
  // can be three times wider: four tiles apart is across the map at 7 and a stroll at 21.
  MIN_PORTAL_DISTANCE = size >> 1;
}

// PLACEHOLDER: the minimum Chebyshev distance between two things of the same kind, which
// is what spreads them over the board instead of letting them clump. 2 means "never
// adjacent": no fountain pairs sharing each other's rainbow spots, and no chains of
// flowers turning into a free-movement highway. One value for every kind for now — per
// kind is a matter of passing a different number to placeObject.
const SPACING = 2;

// PLACEHOLDER score weights. The score is what the board is worth right now, not a total
// banked over the run — it is recomputed from scratch whenever anything moves, shown all
// through the run, and whatever it reads when the last turn closes is the final score.
// The weighting exists because the terms are on very different scales: a good board has
// fifty-odd revealed tiles against a handful of rainbows, so counting both at one apiece
// would make the run about walking rather than building.
const SCORE_PER_ECONOMY = 5; // per rainbow, per unicorn found, per earning tree
const SCORE_PER_REVEALED = 1; // per tile no longer under cloud
export const MOVE_COST = 1; // water drops per step
export const PORTAL_COST = MOVE_COST + 1; // a jump between the two donuts costs one drop more than a step
// PLACEHOLDER: what one bathtub pays into the purse every turn, come what may. It is the
// floor under the economy — with it, a run can never seize up, which is why there is no
// losing any more. Every tub on the board pays it, so a second one doubles the base.
export const BASE_INCOME = 2;
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

  // Fountains keep one tile of distance to the border, so every side of a fountain has an
  // opposite tile to cast a rainbow onto, and SPACING from each other.
  for (let i = 0; i < FOUNTAIN_COUNT; i++) {
    const position = placeObject(map, GameObjectType.FOUNTAIN, SPACING, 1);
    // A lollipop tree grows next to every fountain, taking one of its eight rainbow
    // slots away.
    const spots = position ? getFreeNeighbours(map, position) : [];
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
  const spots = getFreePositions(map, 0);
  const pairable = spots.filter((a) => spots.some((b) => getAxisDistance(a, b) >= MIN_PORTAL_DISTANCE));
  getTile(map, getRandomItem(pairable.length ? pairable : spots))!.object = GameObjectType.DONUT;
  placeObject(map, GameObjectType.DONUT, 0, 0, MIN_PORTAL_DISTANCE);

  // No unicorns are placed here: the one at the start position is the whole herd a run
  // begins with, and every other one is bought from a tub. Nothing waits in the fog.
  for (let i = 0; i < TREE_COUNT; i++) placeObject(map, GameObjectType.TREE, SPACING);
  for (let i = 0; i < FLOWER_COUNT; i++) placeObject(map, GameObjectType.FLOWER, SPACING);

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
 * Puts one `objectType` on a free tile and reports where it landed. `spacing` is the
 * distance it keeps from others of its own kind, `margin` the distance it keeps from the
 * border, and `axisSpacing` demands that much along *both* axes — the rule that stops the
 * donut pair from lining up in one row or column. Which layer it lands on follows from its
 * category, so a unicorn walks over the ground and a fountain becomes part of it.
 *
 * If no tile satisfies the spacing, the spacing is dropped rather than the object: a board
 * too tight for the rule still gets its full count, just packed closer together. That is
 * also what makes generation total — it can never loop looking for a spot that is not there.
 */
function placeObject(map: GameMap, objectType: GameObjectType, spacing = 0, margin = 0, axisSpacing = 0): Position | undefined {
  const free = getFreePositions(map, margin);
  const taken = getPositionsOf(map, objectType);
  const spaced = free.filter((position) =>
    taken.every((other) => getDistance(position, other) >= spacing && getAxisDistance(position, other) >= axisSpacing),
  );
  const candidates = spaced.length ? spaced : free;

  if (!candidates.length) return undefined;

  const position = getRandomItem(candidates);
  const tile = getTile(map, position)!;

  if (OBJECT_CONFIG[objectType].category === ObjectCategory.LIVING) tile.living = objectType;
  else tile.object = objectType;

  return position;
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
 * What the board is worth as it stands: the economy — rainbows shining, unicorns found,
 * lollipop trees earning — plus every tile no longer under cloud. Nothing is banked, so
 * this is live all through the run and its reading when the last turn closes is the final
 * score. Because it is a snapshot rather than a total, the closing turn counts as much as
 * the opening one, and a rainbow that goes out takes its points with it.
 * The herd is counted the same way the fog rules count a glower: only what is out in the open.
 * Nothing hides in the fog any more, so today that is every unicorn there is.
 *
 * Returned in parts rather than as one number so the end-of-run panel can show its working,
 * and so the breakdown can never disagree with the total: getScore adds these up.
 */
export function getScoreParts(map: GameMap): [count: number, weight: number][] {
  const revealed = map.tiles.filter((tile) => tile.isRevealed).length;
  const herd = map.tiles.filter((tile) => tile.isRevealed && tile.living === GameObjectType.UNICORN).length;

  // The end-of-run panel lists these in this order and pairs them with emoji by index —
  // see SCORE_EMOJIS in the component. Keep the two lists in step.
  return [
    [map.rainbowCount, SCORE_PER_ECONOMY],
    [herd, SCORE_PER_ECONOMY],
    [map.candyIncome, SCORE_PER_ECONOMY],
    [revealed, SCORE_PER_REVEALED],
  ];
}

/** The parts added up — the number itself, which is all the header needs. */
export function getScore(map: GameMap): number {
  return getScoreParts(map).reduce((total, [count, weight]) => total + count * weight, 0);
}

/**
 * Ends the turn and collects what the board earns: drops to move with, candy to buy with.
 * Collecting at the end rather than the start is what keeps the final turn worth playing —
 * whatever the player sets up on turn 20 is still paid for before the run closes.
 */
export function endTurn(map: GameMap) {
  map.drops += map.dropIncome;
  map.candy += map.candyIncome;
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
