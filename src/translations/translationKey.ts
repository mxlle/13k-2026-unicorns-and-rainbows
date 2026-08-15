import { defineEnum } from "../utils/enums";

// Only keys that are actually read ship — unused keys still cost bytes because
// the translation maps are kept whole. Delete keys when their last usage goes.
export type TranslationKey = defineEnum<typeof TranslationKey>;
export const TranslationKey = defineEnum({
  CONTINUE: 0,
  WON: 1,
  LOST: 2,
  END_TURN: 3,
  // Object info, one key per object type: "Name|One-line description". One string
  // instead of two keys per object — the component splits it at the pipe.
  INFO_UNICORN: 4,
  INFO_RAINBOW: 5,
  INFO_FOUNTAIN: 6,
  INFO_SUN: 7,
  INFO_HINT: 8, // shown in the info panel while nothing is selected — no name, hence the leading "|"
  INFO_FOG: 9,
  INFO_EMPTY: 10,
  NEW_GAME: 11,
  INFO_GOAL: 12, // what the run is about, in place of INFO_HINT on the opening turn — no name either
  INFO_TREE: 13,
});
