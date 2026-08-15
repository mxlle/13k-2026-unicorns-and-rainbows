import { defineEnum } from "../utils/enums";
import { TranslationKey } from "../translations/translationKey";

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
  SUN: 3,
  TREE: 4,
  DONUT: 5,
});

interface GameObjectConfig {
  emoji: string;
  category: ObjectCategory;
  blocksMove: boolean;
  blocksVision: boolean;
  glows: boolean; // a light source: casts a rainbow through a fountain it stands next to
  info: TranslationKey; // "Name|Description" for the info popup
}

// One row per object type — enum-keyed lookup instead of branching (CLAUDE.md).
export const OBJECT_CONFIG: Record<GameObjectType, GameObjectConfig> = {
  [GameObjectType.UNICORN]: {
    emoji: "🦄",
    category: ObjectCategory.LIVING,
    blocksMove: true,
    blocksVision: false,
    glows: true,
    info: TranslationKey.INFO_UNICORN,
  },
  [GameObjectType.RAINBOW]: {
    emoji: "🌈",
    category: ObjectCategory.GOAL,
    blocksMove: false,
    blocksVision: false,
    glows: false,
    info: TranslationKey.INFO_RAINBOW,
  },
  [GameObjectType.FOUNTAIN]: {
    emoji: "⛲",
    category: ObjectCategory.STATIC,
    blocksMove: true,
    blocksVision: false,
    glows: false,
    info: TranslationKey.INFO_FOUNTAIN,
  },
  [GameObjectType.SUN]: {
    emoji: "☀️",
    category: ObjectCategory.STATIC,
    blocksMove: true,
    blocksVision: false,
    glows: true,
    info: TranslationKey.INFO_SUN,
  },
  // Candyland scenery that is also an obstacle: the glyph is drawn tilted at 45°,
  // the stylesheet stands it upright (see .tile > span in game-map.module.scss).
  [GameObjectType.TREE]: {
    emoji: "🍭",
    category: ObjectCategory.STATIC,
    blocksMove: true,
    blocksVision: false,
    glows: false,
    info: TranslationKey.INFO_TREE,
  },
  // Half of the portal pair — walk-through, so a character can stand on it and jump.
  // It still owns the ground layer, so a rainbow can never land on a donut.
  [GameObjectType.DONUT]: {
    emoji: "🍩",
    category: ObjectCategory.STATIC,
    blocksMove: false,
    blocksVision: false,
    glows: false,
    info: TranslationKey.INFO_DONUT,
  },
};
