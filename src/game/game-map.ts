import { setSeed } from "../utils/random-utils";
import { getRandomItem } from "../utils/array-utils";
import { GameObjectType, ObjectCategory, OBJECT_CONFIG } from "./game-objects";

// Tunables — all meant to become per-level values later.
export const MAP_SIZE = 9;
const TILE_COUNT = MAP_SIZE * MAP_SIZE;
export const VISION_RADIUS = 1; // Chebyshev: radius 1 = the surrounding 3x3

// How much of each thing a board carries, written as "one per this many tiles" so that a
// bigger map gets proportionally busier instead of emptier. The numbers in the comments
// are what the 9x9 board works out to — the counts it was hand-tuned with.
// The `+ 0.5 | 0` is rounding written so it constant-folds: MAP_SIZE is a compile-time
// constant, so terser reduces each of these to a plain number and they cost nothing at
// runtime. A Math.round call would survive into the bundle instead.
export const FOUNTAIN_COUNT = (TILE_COUNT / 27 + 0.5) | 0; // 3 — hidden ones, on top of the two flanking the sun
export const TREE_COUNT = (TILE_COUNT / 27 + 0.5) | 0; // 3 — free-roaming, on top of the one growing next to every hidden fountain
export const UNICORN_COUNT = (TILE_COUNT / 27 + 0.5) | 0; // 3 — one at the start position, the others hidden in the fog
export const FLOWER_COUNT = (TILE_COUNT / 12 + 0.5) | 0; // 7 — free stepping stones scattered over the meadow

// PLACEHOLDER: the minimum Chebyshev distance between two things of the same kind, which
// is what spreads them over the board instead of letting them clump. 2 means "never
// adjacent": no fountain pairs sharing each other's rainbow spots, and no chains of
// flowers turning into a free-movement highway. One value for every kind for now — per
// kind is a matter of passing a different number to placeObject.
const SPACING = 2;

export const RAINBOW_GOAL = 5; // rainbows that have to shine at the same time to win
// PLACEHOLDER: sweets for a new unicorn. Flat for now — with income compounding once the
// herd grows, a price that climbs per unicorn is the usual lever if runs snowball.
export const CANDY_PRICE = 3;
export const MOVE_COST = 1; // water drops per step
export const PORTAL_COST = MOVE_COST + 1; // a jump between the two donuts costs one drop more than a step
export const MIN_PORTAL_DISTANCE = 4; // along both axes, so the pair is always diagonally across the board from each other
export const SUN_POSITION: Position = { x: 0, y: 0 };
// PLACEHOLDER: the range a "give me any map" seed is drawn from. Short enough to stay
// readable, which matters once maps are handpicked by their number.
const SEED_RANGE = 1e6;
export const UNICORN_START: Position = { x: 1, y: 1 }; // the sun's diagonal neighbour

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
}

export interface GameMap {
  tiles: Tile[]; // flat, row-major: index = y * MAP_SIZE + x
  rainbowCount: number; // rainbows shining right now — recomputed after every move
  beams: Beam[]; // what the light is doing, recomputed alongside the rainbows
  drops: number; // water drops in the purse; they buy steps and are banked across turns
  candy: number; // sweets in the jar; they buy unicorns and are banked the same way
  candyIncome: number; // lollipop trees earning right now — recomputed alongside the rainbows
  turn: number; // turns played so far, counted up as each income is collected
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
export function createGameMap(seed: number): GameMap {
  setSeed(seed);

  const map: GameMap = {
    tiles: Array.from({ length: MAP_SIZE * MAP_SIZE }, () => ({ isRevealed: false })),
    rainbowCount: 0,
    beams: [],
    drops: 0,
    candy: 0,
    candyIncome: 0,
    turn: 0,
  };

  // The sun is a light source that never moves. With a fountain on each of its two
  // open sides it keeps two rainbows lit in the corner — that is the starting income.
  getTile(map, SUN_POSITION)!.object = GameObjectType.SUN;
  getTile(map, { x: SUN_POSITION.x + 1, y: SUN_POSITION.y })!.object = GameObjectType.FOUNTAIN;
  getTile(map, { x: SUN_POSITION.x, y: SUN_POSITION.y + 1 })!.object = GameObjectType.FOUNTAIN;

  getTile(map, UNICORN_START)!.living = GameObjectType.UNICORN;
  revealAround(map, UNICORN_START);

  // Everything is placed after the starting vision is applied, so nothing can spawn
  // on an already-revealed tile — it all starts hidden under the clouds. The order runs
  // from the fussiest placement to the most relaxed: whatever has the most rules to
  // satisfy gets the emptiest board to find room on.

  // Fountains keep one tile of distance to the border, so every side of a fountain has an
  // opposite tile to cast a rainbow onto, and SPACING from each other — including from the
  // two already flanking the sun, which are on the board by now and counted like any other.
  for (let i = 0; i < FOUNTAIN_COUNT; i++) {
    const position = placeObject(map, GameObjectType.FOUNTAIN, SPACING, 1);
    // A lollipop tree grows next to every hidden fountain, taking one of its eight
    // rainbow slots away. The two fountains flanking the sun stay clear, so the
    // opening income can never be blocked in.
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

  for (let i = 1; i < UNICORN_COUNT; i++) placeObject(map, GameObjectType.UNICORN, SPACING);
  for (let i = 0; i < TREE_COUNT; i++) placeObject(map, GameObjectType.TREE, SPACING);
  for (let i = 0; i < FLOWER_COUNT; i++) placeObject(map, GameObjectType.FLOWER, SPACING);

  updateRainbows(map);

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

        map.beams.push({ x, y, dx, dy, isLit });
      }
    }
  });

  // The second income, counted once the rainbows are in place: a lollipop tree standing
  // next to one turns the light into sweets. One candy per earning tree, however many
  // rainbows happen to surround it — a tree either pays out or it does not.
  // Only trees the player has found earn: an unseen one paying into the jar would give
  // its position away, the same reason a fogged glower casts no light.
  map.candyIncome = map.tiles.filter((_, index) => isEarningTree(map, getPosition(index))).length;
}

/**
 * Whether a tile is a lollipop tree that is earning right now — one candy's worth of the
 * income above. The board draws its trees from this too, so what the player sees glowing
 * and what the jar is paid cannot drift apart.
 */
export function isEarningTree(map: GameMap, position: Position): boolean {
  const tile = getTile(map, position)!;

  return tile.isRevealed && tile.object === GameObjectType.TREE && hasRainbowNeighbour(map, position);
}

/** Whether any of the surrounding eight tiles is currently showing a rainbow. */
function hasRainbowNeighbour(map: GameMap, { x, y }: Position): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if ((dx || dy) && getTile(map, { x: x + dx, y: y + dy })?.object === GameObjectType.RAINBOW) return true;
    }
  }

  return false;
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
 * the only thing that can still happen. Both the loss check and the "end your turn" nudge
 * hang off this: without it a player standing next to a flower would be told the run was
 * over, and counting characters still under the fog would silently disarm that nudge on
 * account of a unicorn the player has not even found yet.
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
 * Income at the start of a turn: one water drop per shining rainbow, one candy per earning
 * lollipop tree. Neither is spent on collection — both bank across turns.
 */
export function startTurn(map: GameMap) {
  map.drops += map.rainbowCount;
  map.candy += map.candyIncome;
  map.turn++;
}

/**
 * Whether a new unicorn can be bought right now. Two conditions, and the second is the
 * interesting one: the start field has to be clear. It is the only place a bought unicorn
 * appears, so a rainbow lying on it — or a unicorn that has not walked off yet — puts the
 * purchase on hold rather than moving it somewhere else.
 */
export function canBuyUnicorn(map: GameMap): boolean {
  const tile = getTile(map, UNICORN_START)!;

  return map.candy >= CANDY_PRICE && tile.object === undefined && tile.living === undefined;
}

/** Trades the candy for a unicorn on the start field. Guarded by canBuyUnicorn. */
export function buyUnicorn(map: GameMap) {
  map.candy -= CANDY_PRICE;
  getTile(map, UNICORN_START)!.living = GameObjectType.UNICORN;
  // the start field and its surroundings have been revealed since the opening turn, so
  // there is no fog for the newcomer to lift — but it may light a fountain straight away
  updateRainbows(map);
}

export function isWon(map: GameMap): boolean {
  return map.rainbowCount >= RAINBOW_GOAL;
}

/** No drops and not even a free step left: nothing can move, so nothing can ever change. */
export function isLost(map: GameMap): boolean {
  return map.drops < MOVE_COST && !hasFreeMove(map);
}
