import { defineEnum } from "../utils/enums";

// Only keys that are actually read ship — unused keys still cost bytes because
// the translation maps are kept whole. Delete keys when their last usage goes.
export type TranslationKey = defineEnum<typeof TranslationKey>;
export const TranslationKey = defineEnum({
  CONTINUE: 0,
  WON: 1, // the only way a run ends: the turns run out. There is no losing.
  END_TURN: 2,
  // Object info, one key per object type: "Name|One-line description". One string
  // instead of two keys per object — the component splits it at the pipe.
  INFO_UNICORN: 3,
  INFO_RAINBOW: 4,
  INFO_FOUNTAIN: 5,
  INFO_BATHTUB: 6,
  INFO_HINT: 7, // shown in the info panel while nothing is selected — no name, hence the leading "|"
  INFO_FOG: 8,
  INFO_EMPTY: 9,
  BACK: 10, // out of a finished run and back to the launch screen, which is where a board is picked
  INFO_GOAL: 11, // what the run is about, in place of INFO_HINT on the opening turn — no name either
  INFO_TREE: 12,
  INFO_DONUT: 13,
  JUMP: 14, // the portal action offered in the info panel
  INFO_FLOWER: 15,
  INFO_CHEST: 16,
  INFO_TUB_SITE: 17,
  INFO_FOUNTAIN_SITE: 18,
  INFO_TREE_SITE: 19,
  PLAY: 20, // confirms the board picked on the launch screen and starts the run
});
