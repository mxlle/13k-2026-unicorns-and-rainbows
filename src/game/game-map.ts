import { Direction } from "../types";
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
  unicornPosition: Position;
  revealedGoalCount: number;
}

const MOVE_DELTA: Record<Direction, Position> = {
  [Direction.UP]: { x: 0, y: -1 },
  [Direction.DOWN]: { x: 0, y: 1 },
  [Direction.LEFT]: { x: -1, y: 0 },
  [Direction.RIGHT]: { x: 1, y: 0 },
};

// Bounds-checked so a step off the left edge doesn't wrap into the row above.
export function getTile(map: GameMap, { x, y }: Position): Tile | undefined {
  return x < 0 || y < 0 || x >= MAP_SIZE || y >= MAP_SIZE ? undefined : map.tiles[y * MAP_SIZE + x];
}

export function createGameMap(): GameMap {
  const map: GameMap = {
    tiles: Array.from({ length: MAP_SIZE * MAP_SIZE }, () => ({ isRevealed: false })),
    unicornPosition: { ...UNICORN_START },
    revealedGoalCount: 0,
  };

  getTile(map, map.unicornPosition)!.living = GameObjectType.UNICORN;
  revealAroundUnicorn(map);

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

/** Uncovers the vision square around the unicorn. Revealed tiles stay revealed. Returns how many goals were newly uncovered. */
export function revealAroundUnicorn(map: GameMap): number {
  const { x, y } = map.unicornPosition;
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

/** One step onto an orthogonally adjacent tile. Returns false if the move was blocked or off the map. */
export function moveUnicorn(map: GameMap, direction: Direction): boolean {
  const delta = MOVE_DELTA[direction];
  const target: Position = { x: map.unicornPosition.x + delta.x, y: map.unicornPosition.y + delta.y };
  const targetTile = getTile(map, target);

  if (!targetTile || blocksMove(targetTile.object) || blocksMove(targetTile.living)) return false;

  getTile(map, map.unicornPosition)!.living = undefined;
  targetTile.living = GameObjectType.UNICORN;
  map.unicornPosition = target;

  return true;
}

export function isWon(map: GameMap): boolean {
  return map.revealedGoalCount === RAINBOW_COUNT;
}
