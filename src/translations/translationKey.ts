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
  // Back to the launch screen from a finished run. It used to be NEW_GAME ("New game"), which
  // stopped being the truth the moment a second button beside it started a new game for real —
  // this one picks a level, and now says so.
  LEVELS: 10,
  INFO_GOAL: 11, // what the run is about, in place of INFO_HINT on the opening turn — no name either
  INFO_TREE: 12,
  INFO_DONUT: 13,
  // 14 was JUMP, the portal's own button in the info panel. The far donuts are tiles to tap
  // now, so the button went and the numbers below closed up behind it — they have to stay
  // contiguous for the enum-keyed translation maps to compact into arrays (see vite.config.ts).
  INFO_CUSTARD: 14,
  INFO_CHEST: 15,
  INFO_TUB_SITE: 16,
  INFO_FOUNTAIN_SITE: 17,
  INFO_TREE_SITE: 18,
  PLAY: 19, // confirms the board picked on the launch screen and starts the run
  // The tub's second job, appended to INFO_BATHTUB only on boards that have candy to pay with.
  // A sentence rather than a key of its own so the first half is written once.
  INFO_BATHTUB_SELL: 20,
  // The opponent. Every one of these is written as a HAS_OPPONENT ternary in the translation
  // maps, so the key survives into a build without the feature but the text does not — an
  // unused key costs a comma, an unused sentence costs its whole length.
  INFO_RIVAL: 21,
  INFO_DARK_RAINBOW: 22,
  // How the run ends once there is somebody to lose to. WON above is still the ending of a
  // board with no opponent on it: the turns ran out, and that is all there is to say.
  WON_RACE: 23,
  LOST_RACE: 24,
  // The unicorn's second half, swapped in for INFO_UNICORN's description once the player has
  // actually found a fountain — no name of its own, the way INFO_BATHTUB_SELL has none. A swap
  // rather than an append: the two sentences together outrun the height the info panel reserves
  // for its longest description (see $info-height in game-map.module.scss), and this is that
  // longest description.
  INFO_UNICORN_SHINE: 25,
  // The board just played, again from the top — offered beside the way out when a run ends.
  // It is the same map and not another deal of it: a run is a plan, and the second go at a plan
  // is the whole of what there is to learn from the first.
  RETRY: 26,
  // The resting line in place of INFO_HINT once the turn is provably spent — no name of its
  // own would do here, so this one has a name half: it is a prompt rather than a caption.
  INFO_STUCK: 27,
  // The same line on the closing turn, where there is no income coming and ending the turn
  // ends the run. A key of its own rather than a ternary: the maps only compact when every
  // value in them is a literal (see vite.config.ts).
  INFO_STUCK_LAST: 28,
});
