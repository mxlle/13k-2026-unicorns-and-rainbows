import { TranslationKey } from "./translationKey";

// For texts that should be shorter in the competition build, use per-entry
// ternaries on the HAS_SHORT_TEXTS flag (env-utils.ts) — the unused variant is
// tree-shaken: [TranslationKey.START]: HAS_SHORT_TEXTS ? "Go" : "Start game",
export const enTranslations: Record<TranslationKey, string> = {
  [TranslationKey.CONTINUE]: "Continue",
  // The end-of-run texts share the info panel's "Name|Description" shape. The score is
  // appended to the description by the component, so both lines end ready for a number.
  [TranslationKey.WON]: "Time is up!|Your final score:",
  [TranslationKey.LOST]: "Everything has stopped!|Nothing can move any more. Your score:",
  [TranslationKey.END_TURN]: "End turn",
  [TranslationKey.NEW_GAME]: "New game",
  // PLACEHOLDER wording — "Name|Description", split at the pipe by the info panel.
  // Plain, short words: many players will not be native speakers. The 🦄⛲🌈 pattern
  // carries the line-up rule without language, and repeats, so it costs almost nothing.
  [TranslationKey.INFO_UNICORN]: "Unicorn|It shines. Line it up like this: 🦄⛲🌈",
  [TranslationKey.INFO_RAINBOW]: "Rainbow|One 💧 every turn, and it scores while it shines.",
  [TranslationKey.INFO_FOUNTAIN]: "Fountain|Light comes out the other side as a rainbow: 🦄⛲🌈",
  [TranslationKey.INFO_SUN]: "Sun|It never moves, so its rainbows never go out: ☀️⛲🌈",
  [TranslationKey.INFO_HINT]: "|Tap anything on the map to find out what it does.",
  // no turn count in the text — the turn bar shows it, and it stays right when TURN_LIMIT moves
  [TranslationKey.INFO_GOAL]: "|Build up before the turns run out. Rainbows, unicorns, 🍬 trees and cleared clouds score.",
  [TranslationKey.INFO_FOG]: "Cloud|You cannot see here yet. Walk a unicorn closer.",
  [TranslationKey.INFO_EMPTY]: "Meadow|Free space. A rainbow can appear here.",
  [TranslationKey.INFO_TREE]: "Lollipop tree|Next to a rainbow it makes one 🍬 a turn. No rainbow can appear here.",
  [TranslationKey.INFO_DONUT]: "Donut|A portal to the other donut. Jumping costs one 💧 extra.",
  [TranslationKey.JUMP]: "Jump",
  // Says both halves of the trade: the free step, and the rainbow spot it takes up.
  [TranslationKey.INFO_FLOWER]: "Flower|Stepping on it is free. But no rainbow can appear here.",
  [TranslationKey.INFO_BUY]: "Nursery|Trade 3 🍬 for a new unicorn on this field.",
  [TranslationKey.BUY]: "Buy",
};
