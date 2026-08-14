import { defineEnum } from "../utils/enums";

// What a thing *is* — purely semantic. The behavioural bits (blocksMove /
// blocksVision) are separate flags below, so a future "living but harmless" or
// "static but walk-through" object doesn't need a new category.
export type ObjectCategory = defineEnum<typeof ObjectCategory>;
export const ObjectCategory = defineEnum({
  LIVING: 0, // acts on its own — the unicorn today, creatures later
  GOAL: 1, // what winning is about — the rainbows
  STATIC: 2, // scenery that just sits there — rocks, trees, water later
});

export type GameObjectType = defineEnum<typeof GameObjectType>;
export const GameObjectType = defineEnum({
  UNICORN: 0,
  RAINBOW: 1,
  FOUNTAIN: 2,
});

interface GameObjectConfig {
  emoji: string;
  category: ObjectCategory;
  blocksMove: boolean;
  blocksVision: boolean;
}

// One row per object type — enum-keyed lookup instead of branching (CLAUDE.md).
export const OBJECT_CONFIG: Record<GameObjectType, GameObjectConfig> = {
  [GameObjectType.UNICORN]: { emoji: "🦄", category: ObjectCategory.LIVING, blocksMove: true, blocksVision: false },
  [GameObjectType.RAINBOW]: { emoji: "🌈", category: ObjectCategory.GOAL, blocksMove: false, blocksVision: false },
  [GameObjectType.FOUNTAIN]: { emoji: "⛲", category: ObjectCategory.STATIC, blocksMove: true, blocksVision: false },
};
