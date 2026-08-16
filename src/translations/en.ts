import { TranslationKey } from "./translationKey";

// For texts that should be shorter in the competition build, use per-entry
// ternaries on the HAS_SHORT_TEXTS flag (env-utils.ts) — the unused variant is
// tree-shaken: [TranslationKey.START]: HAS_SHORT_TEXTS ? "Go" : "Start game",
export const enTranslations: Record<TranslationKey, string> = {
  [TranslationKey.CONTINUE]: "Continue",
  // The end-of-run text shares the info panel's "Name|Description" shape. The score is
  // appended to the description by the component, so the line ends ready for a number.
  [TranslationKey.WON]: "Time is up!|Your final score:",
  [TranslationKey.END_TURN]: "End turn",
  [TranslationKey.NEW_GAME]: "New game",
  [TranslationKey.PLAY]: "Play now",
  // PLACEHOLDER wording — "Name|Description", split at the pipe by the info panel.
  // Plain, short words: many players will not be native speakers. The 🦄⛲🌈 pattern
  // carries the line-up rule without language, and repeats, so it costs almost nothing.
  [TranslationKey.INFO_UNICORN]: "Unicorn|It shines. Line it up like this: 🦄⛲🌈",
  [TranslationKey.INFO_RAINBOW]: "Rainbow|One 💧 every turn, and it scores while it shines.",
  [TranslationKey.INFO_FOUNTAIN]: "Fountain|Light comes out the other side as a rainbow: 🦄⛲🌈",
  // The two halves of what the tub is, kept apart because the tutorial board only has the
  // first: the flat income it pays wherever it stands, and — once there are trees on the board
  // to make sweets — the fields it can put a new unicorn on. The info panel joins them.
  // The number repeats BASE_INCOME by hand — change them together. The price is not a number
  // here on purpose: it is the size of the herd, so it moves every time one is bought.
  [TranslationKey.INFO_BATHTUB]: "Bathtub|It makes 2 💧 a turn.",
  [TranslationKey.INFO_BATHTUB_SELL]: "A new unicorn beside it costs one 🍬 per unicorn you have.",
  [TranslationKey.INFO_HINT]: "|Tap anything on the map to find out what it does.",
  // No turn count in the text — the turn bar shows it, and it stays right when TURN_LIMIT moves.
  // The shape of the sentence is the shape of the score: two things add up, and the cloud you
  // have cleared multiplies them. It is also the line held over the breakdown when the score is
  // opened, so the words and the arithmetic under them say the same thing.
  [TranslationKey.INFO_GOAL]: "|Build up before the turns run out. Every 🌈 and 🦄 scores 1 point per % of ☁️ you cleared.",
  [TranslationKey.INFO_FOG]: "Cloud|You cannot see here yet. Walk a unicorn closer.",
  [TranslationKey.INFO_EMPTY]: "Meadow|Free space. A rainbow can appear here.",
  [TranslationKey.INFO_TREE]: "Lollipop tree|It makes one 🍬 a turn per 🌈 next to it. No rainbow can appear here.",
  // The whole price rather than the surcharge — "one more than a step" is arithmetic the
  // player has to do at exactly the moment they are counting drops. The number repeats
  // PORTAL_COST by hand, the same way the tub's line repeats BASE_INCOME: change them together.
  [TranslationKey.INFO_DONUT]: "Donut|A portal. Tap another 🍩 to jump there for 2 💧.",
  // Says both halves of the trade: the free step, and the rainbow spot it takes up.
  [TranslationKey.INFO_FLOWER]: "Flower|Stepping on it is free. But no rainbow can appear here.",
  // Says what it is for without saying what is in it: the three outcomes, and the one action.
  [TranslationKey.INFO_CHEST]: "Present|Step on it to open. Inside is 💧, 🍬 or a new 🦄.",
  // The three build sites. No price in the text: the button carries it, and it is the button
  // that would go out of date if the numbers moved.
  [TranslationKey.INFO_TUB_SITE]: "Empty tub|A unicorn beside it can fill it up.",
  [TranslationKey.INFO_FOUNTAIN_SITE]: "Rubble|A unicorn beside it can rebuild the fountain.",
  [TranslationKey.INFO_TREE_SITE]: "Seedling|A unicorn beside it can grow it into a 🍭 tree.",
};
