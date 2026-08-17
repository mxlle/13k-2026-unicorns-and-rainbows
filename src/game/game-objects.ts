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
  BATHTUB: 3,
  TREE: 4,
  DONUT: 5,
  FLOWER: 6,
  CHEST: 7,
  // The three build sites. They must stay consecutive: the build table is indexed by "site
  // type less the first site", which is what makes it a three-entry array instead of a lookup
  // with holes in it where the real objects are. Anything numbered past them falls off the end
  // of that table and comes back undefined, which is exactly what the dark things below want.
  TUB_SITE: 8,
  FOUNTAIN_SITE: 9,
  TREE_SITE: 10,
  // The opponent's own things, and they must stay last. Which side owns a thing is read off
  // the enum — "at or past the first dark one" (see getSide) — so a side is a comparison
  // rather than a field carried by every tile on the board. It is also why there is no
  // DARK_TREE or DARK_FOUNTAIN: those are scenery both sides use, and only the three things
  // that can *belong* to somebody are doubled.
  DARK_UNICORN: 11,
  DARK_RAINBOW: 12,
  DARK_BATHTUB: 13,
});

/**
 * Who a thing belongs to. Two sides: the player, and the opponent that turns up on the big
 * boards. It is a number rather than a defineEnum enum because it indexes the tables below
 * and every per-side count on the map — arithmetic, not a set of names.
 */
export type Side = 0 | 1;
export const PLAYER: Side = 0;
export const RIVAL: Side = 1;

/** Whose thing this is — the whole of ownership, and it costs no storage anywhere. */
export function getSide(objectType: GameObjectType): Side {
  return objectType >= GameObjectType.DARK_UNICORN ? RIVAL : PLAYER;
}

// The three doubled things, indexed by side: "a unicorn of this side", "a rainbow of this
// side", "a bathtub of this side". Everything that used to name one of them by its type now
// looks it up here instead, which is what keeps the two sides one piece of code.
export const SIDE_UNICORN: GameObjectType[] = [GameObjectType.UNICORN, GameObjectType.DARK_UNICORN];
export const SIDE_RAINBOW: GameObjectType[] = [GameObjectType.RAINBOW, GameObjectType.DARK_RAINBOW];
export const SIDE_BATHTUB: GameObjectType[] = [GameObjectType.BATHTUB, GameObjectType.DARK_BATHTUB];

// What a chest turns out to have been holding. DROPS and CANDY are deliberately numbered to
// match the two currency indices the interface already sorts everything by — the emoji that
// flies, the counter it lands in, the counter that pops — so a loot value doubles as a
// currency and no lookup is needed to turn one into the other.
export type ChestLoot = defineEnum<typeof ChestLoot>;
export const ChestLoot = defineEnum({
  DROPS: 0,
  CANDY: 1,
  UNICORN: 2,
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
  // The base: it pays a flat income every turn and is where new unicorns come from. It
  // gives off no light of its own — the corner it stands in is a purse, not a puzzle.
  [GameObjectType.BATHTUB]: {
    emoji: "🛁",
    category: ObjectCategory.STATIC,
    blocksMove: true,
    blocksVision: false,
    glows: false,
    info: TranslationKey.INFO_BATHTUB,
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
  // PLACEHOLDER art: there is no chest emoji, so the present stands in for one — it says
  // "something is inside" without saying what, which is the whole of it.
  // Walk-through, because stepping on is how it is opened. It owns the ground layer only
  // until then: an opened chest leaves plain meadow behind, rainbows and all.
  [GameObjectType.CHEST]: {
    emoji: "🎁",
    category: ObjectCategory.STATIC,
    blocksMove: false,
    blocksVision: false,
    glows: false,
    info: TranslationKey.INFO_CHEST,
  },
  // PLACEHOLDER art for the three build sites: an unfinished version of the thing each one
  // becomes, drawn small (see .site in the stylesheet) so it reads as a promise rather than a
  // thing. All three block movement, exactly as the buildings they turn into do — tried
  // walk-through and it played worse. Two things follow from that and canBuild leans on both:
  // the unicorn doing the work stands beside the site, and nothing can ever be standing on the
  // tile at the moment a building appears on it.
  // They also own the ground layer, so no rainbow can land on one until it is built.
  [GameObjectType.TUB_SITE]: {
    emoji: "🪣",
    category: ObjectCategory.STATIC,
    blocksMove: true,
    blocksVision: false,
    glows: false,
    info: TranslationKey.INFO_TUB_SITE,
  },
  [GameObjectType.FOUNTAIN_SITE]: {
    emoji: "🪨",
    category: ObjectCategory.STATIC,
    blocksMove: true,
    blocksVision: false,
    glows: false,
    info: TranslationKey.INFO_FOUNTAIN_SITE,
  },
  [GameObjectType.TREE_SITE]: {
    emoji: "🌱",
    category: ObjectCategory.STATIC,
    blocksMove: true,
    blocksVision: false,
    glows: false,
    info: TranslationKey.INFO_TREE_SITE,
  },
  // Walk-through like the donut, and the only tile that is free to step onto. It still
  // owns the ground layer, so the free path it offers costs a rainbow spot in return.
  [GameObjectType.FLOWER]: {
    emoji: "🌺",
    category: ObjectCategory.STATIC,
    blocksMove: false,
    blocksVision: false,
    glows: false,
    info: TranslationKey.INFO_FLOWER,
  },
  // The opponent's three. They are the player's three in every respect that the rules read —
  // the dark unicorn glows and blocks exactly as a unicorn does, the dark rainbow lies on the
  // ground exactly as a rainbow does — and differ only in who they score for and in being
  // drawn inverted (see .dark in the stylesheet). PLACEHOLDER art: the same emoji through a
  // CSS `invert`, which costs no bytes and reads as the negative of the thing it is racing.
  [GameObjectType.DARK_UNICORN]: {
    emoji: "🦄",
    category: ObjectCategory.LIVING,
    blocksMove: true,
    blocksVision: false,
    glows: true,
    info: TranslationKey.INFO_RIVAL,
  },
  [GameObjectType.DARK_RAINBOW]: {
    emoji: "🌈",
    category: ObjectCategory.GOAL,
    blocksMove: false,
    blocksVision: false,
    glows: false,
    info: TranslationKey.INFO_DARK_RAINBOW,
  },
  [GameObjectType.DARK_BATHTUB]: {
    emoji: "🛁",
    category: ObjectCategory.STATIC,
    blocksMove: true,
    blocksVision: false,
    glows: false,
    info: TranslationKey.INFO_BATHTUB,
  },
};
