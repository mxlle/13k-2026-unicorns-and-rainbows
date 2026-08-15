import { getRandomInt, setSeed } from "../utils/random-utils";
import { getRandomItem } from "../utils/array-utils";
import { GameObjectType, OBJECT_CONFIG } from "./game-objects";

// Tunables — all meant to become per-level values later.
export const MAP_SIZE = 9;
export const VISION_RADIUS = 1; // Chebyshev: radius 1 = the surrounding 3x3
export const FOUNTAIN_COUNT = 3; // hidden ones, on top of the two flanking the sun
export const TREE_COUNT = 3; // free-roaming ones, on top of the one growing next to every hidden fountain
export const UNICORN_COUNT = 3; // one at the start position, the others hidden in the fog
export const RAINBOW_GOAL = 5; // rainbows that have to shine at the same time to win
export const MOVE_COST = 1; // water drops per step
export const PORTAL_COST = MOVE_COST + 1; // a jump between the two donuts costs one drop more than a step
export const MIN_PORTAL_DISTANCE = 4; // Chebyshev, so the pair is always at least half the board apart
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
  // on an already-revealed tile — it all starts hidden under the clouds.
  // Fountains keep one tile of distance to the border, so every side of a fountain
  // has an opposite tile to cast a rainbow onto.
  for (let i = 0; i < FOUNTAIN_COUNT; i++) {
    const position = getFreePosition(map, 1);
    getTile(map, position)!.object = GameObjectType.FOUNTAIN;
    // A lollipop tree grows next to every hidden fountain, taking one of its eight
    // rainbow slots away. The two fountains flanking the sun stay clear, so the
    // opening income can never be blocked in.
    const spots = getFreeNeighbours(map, position);
    if (spots.length) getTile(map, getRandomItem(spots))!.object = GameObjectType.TREE;
  }
  for (let i = 1; i < UNICORN_COUNT; i++) getTile(map, getFreePosition(map))!.living = GameObjectType.UNICORN;
  for (let i = 0; i < TREE_COUNT; i++) getTile(map, getFreePosition(map))!.object = GameObjectType.TREE;

  // The portal pair. Both ends land on free tiles, so a character can never start on one,
  // and they are kept far apart — a jump costs more than a step and has to be worth it.
  const entry = getFreePosition(map);
  getTile(map, entry)!.object = GameObjectType.DONUT; // taken first, so the far end cannot land on it
  let exit: Position;
  do exit = getFreePosition(map);
  while (Math.max(Math.abs(exit.x - entry.x), Math.abs(exit.y - entry.y)) < MIN_PORTAL_DISTANCE);
  getTile(map, exit)!.object = GameObjectType.DONUT;

  updateRainbows(map);

  return map;
}

/** Nothing on it and still under the fog — where something new may be placed. */
function isFree(tile: Tile | undefined): boolean {
  return !!tile && !tile.isRevealed && tile.object === undefined && tile.living === undefined;
}

/** A random free tile's position. `margin` keeps that many tiles of distance to the border. */
function getFreePosition(map: GameMap, margin = 0): Position {
  let position: Position;
  do {
    const size = MAP_SIZE - 2 * margin;
    position = { x: margin + getRandomInt(size), y: margin + getRandomInt(size) };
  } while (!isFree(getTile(map, position)));

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

/** Steps the character on `from` onto `to` — `to` must come from getMoveTargets. */
export function moveCharacter(map: GameMap, from: Position, to: Position) {
  const fromTile = getTile(map, from)!;
  getTile(map, to)!.living = fromTile.living;
  fromTile.living = undefined;
}

/** Income at the start of a turn: one water drop per shining rainbow. Unspent drops stay in the purse. */
export function startTurn(map: GameMap) {
  map.drops += map.rainbowCount;
  map.turn++;
}

export function isWon(map: GameMap): boolean {
  return map.rainbowCount >= RAINBOW_GOAL;
}

/** No drops and no rainbows left to earn any: nothing can ever move again. */
export function isLost(map: GameMap): boolean {
  return map.drops < MOVE_COST;
}
