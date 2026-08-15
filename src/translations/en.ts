import { TranslationKey } from "./translationKey";

// For texts that should be shorter in the competition build, use per-entry
// ternaries on the HAS_SHORT_TEXTS flag (env-utils.ts) — the unused variant is
// tree-shaken: [TranslationKey.START]: HAS_SHORT_TEXTS ? "Go" : "Start game",
export const enTranslations: Record<TranslationKey, string> = {
  [TranslationKey.CONTINUE]: "Continue",
  // The end-of-run texts share the info panel's "Name|Description" shape.
  [TranslationKey.WON]: "You won!|All the rainbows you needed are shining at once.",
  [TranslationKey.LOST]: "Oh no!|No drops and no rainbows left. Nothing can move.",
  [TranslationKey.END_TURN]: "End turn",
  [TranslationKey.NEW_GAME]: "New game",
  // PLACEHOLDER wording — "Name|Description", split at the pipe by the info panel.
  // Plain, short words: many players will not be native speakers. The 🦄⛲🌈 pattern
  // carries the line-up rule without language, and repeats, so it costs almost nothing.
  [TranslationKey.INFO_UNICORN]: "Unicorn|It shines. Line it up like this: 🦄⛲🌈",
  [TranslationKey.INFO_RAINBOW]: "Rainbow|One 💧 every turn. Have 5 at once to win.",
  [TranslationKey.INFO_FOUNTAIN]: "Fountain|Light comes out the other side as a rainbow: 🦄⛲🌈",
  [TranslationKey.INFO_SUN]: "Sun|It never moves, so its rainbows never go out: ☀️⛲🌈",
  [TranslationKey.INFO_HINT]: "|Tap anything on the map to find out what it does.",
  [TranslationKey.INFO_GOAL]: "|Explore the clouds, find friends and fountains, make rainbows: 🦄⛲🌈",
  [TranslationKey.INFO_FOG]: "Cloud|You cannot see here yet. Walk a unicorn closer.",
  [TranslationKey.INFO_EMPTY]: "Meadow|Free space. A rainbow can appear here.",
  [TranslationKey.INFO_TREE]: "Lollipop tree|Sweet, but in the way. No rainbow can appear here.",
  [TranslationKey.INFO_DONUT]: "Donut|A portal to the other donut. Jumping costs one 💧 extra.",
  [TranslationKey.JUMP]: "Jump",
};
