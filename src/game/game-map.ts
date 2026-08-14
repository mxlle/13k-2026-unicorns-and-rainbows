import { getRandomInt } from "../utils/random-utils";
import { GameObjectType, OBJECT_CONFIG } from "./game-objects";

// Tunables — all meant to become per-level values later.
export const MAP_SIZE = 9;
export const VISION_RADIUS = 1; // Chebyshev: radius 1 = the surrounding 3x3
export const FOUNTAIN_COUNT = 3; // hidden ones, on top of the two flanking the sun
export const UNICORN_COUNT = 3; // one at the start position, the others hidden in the fog
export const RAINBOW_GOAL = 5; // rainbows that have to shine at the same time to win
export const MOVE_COST = 1; // water drops per step
export const SUN_POSITION: Position = { x: 0, y: 0 };
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

export function createGameMap(): GameMap {
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
  for (let i = 0; i < FOUNTAIN_COUNT; i++) getFreeTile(map, 1).object = GameObjectType.FOUNTAIN;
  for (let i = 1; i < UNICORN_COUNT; i++) getFreeTile(map).living = GameObjectType.UNICORN;

  updateRainbows(map);

  return map;
}

/** A random still-hidden, empty tile. `margin` keeps that many tiles of distance to the border. */
function getFreeTile(map: GameMap, margin = 0): Tile {
  let tile: Tile;
  do {
    const size = MAP_SIZE - 2 * margin;
    tile = getTile(map, { x: margin + getRandomInt(size), y: margin + getRandomInt(size) })!;
  } while (tile.isRevealed || tile.object !== undefined || tile.living !== undefined);

  return tile;
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
 */
export function updateRainbows(map: GameMap) {
  map.tiles.forEach((tile) => {
    if (tile.object === GameObjectType.RAINBOW) tile.object = undefined;
  });

  map.rainbowCount = 0;
  map.beams = [];

  map.tiles.forEach((tile, index) => {
    if (!glows(tile.living) && !glows(tile.object)) return;
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
