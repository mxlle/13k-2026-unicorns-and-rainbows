import { getRandomInt } from "../utils/random-utils";
import { GameObjectType, ObjectCategory, OBJECT_CONFIG } from "./game-objects";

// Tunables — all meant to become per-level values later.
export const MAP_SIZE = 13;
export const VISION_RADIUS = 1; // Chebyshev: radius 1 = the surrounding 3x3
export const RAINBOW_COUNT = 3;
export const UNICORN_START: Position = { x: 0, y: 0 };

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

export interface GameMap {
  tiles: Tile[]; // flat, row-major: index = y * MAP_SIZE + x
  revealedGoalCount: number;
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
    revealedGoalCount: 0,
  };

  getTile(map, UNICORN_START)!.living = GameObjectType.UNICORN;
  revealAround(map, UNICORN_START);

  // Placed after the starting vision is applied, so a rainbow can never spawn on
  // an already-revealed tile — all three really do start hidden under clouds.
  for (let i = 0; i < RAINBOW_COUNT; i++) {
    let tile: Tile;
    do {
      tile = map.tiles[getRandomInt(map.tiles.length)];
    } while (tile.isRevealed || tile.object !== undefined);
    tile.object = GameObjectType.RAINBOW;
  }

  return map;
}

/** Uncovers the vision square around a position. Revealed tiles stay revealed. Returns how many goals were newly uncovered. */
export function revealAround(map: GameMap, { x, y }: Position): number {
  let newGoals = 0;

  for (let dy = -VISION_RADIUS; dy <= VISION_RADIUS; dy++) {
    for (let dx = -VISION_RADIUS; dx <= VISION_RADIUS; dx++) {
      const tile = getTile(map, { x: x + dx, y: y + dy });
      if (tile && !tile.isRevealed) {
        tile.isRevealed = true;
        if (tile.object !== undefined && OBJECT_CONFIG[tile.object].category === ObjectCategory.GOAL) newGoals++;
      }
    }
  }

  map.revealedGoalCount += newGoals;
  return newGoals;
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

export function isWon(map: GameMap): boolean {
  return map.revealedGoalCount === RAINBOW_COUNT;
}
