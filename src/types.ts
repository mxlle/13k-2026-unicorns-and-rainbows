import { defineEnum } from "./utils/enums";

export type Direction = defineEnum<typeof Direction>;
export const Direction = defineEnum({
  UP: 0,
  DOWN: 1,
  LEFT: 2,
  RIGHT: 3,
});

// literal member list, NOT Object.values(Direction) — that would pin the whole
// enum object into the bundle (see CLAUDE.md rule 1)
export const ALL_DIRECTIONS: Direction[] = [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT];

export function isDirection(move: unknown): move is Direction {
  return ALL_DIRECTIONS.includes(move as Direction);
}

export type ComponentDefinition<UpdateOptions = unknown, R = void> = [
  hostElement: HTMLElement,
  updateFunction?: (options?: UpdateOptions) => R,
];
