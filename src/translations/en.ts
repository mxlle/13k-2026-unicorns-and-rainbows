import { TranslationKey } from "./translationKey";

// For texts that should be shorter in the competition build, use per-entry
// ternaries on the HAS_SHORT_TEXTS flag (env-utils.ts) — the unused variant is
// tree-shaken: [TranslationKey.START]: HAS_SHORT_TEXTS ? "Go" : "Start game",
export const enTranslations: Record<TranslationKey, string> = {
  [TranslationKey.CONTINUE]: "Continue",
  // The end-of-run texts share the info panel's "Name|Description" shape.
  [TranslationKey.WON]: "You won!|Every rainbow you needed is shining at once.",
  [TranslationKey.LOST]: "Oh no!|No coins and no rainbow left to earn any — nothing can move.",
  [TranslationKey.END_TURN]: "End turn",
  [TranslationKey.NEW_GAME]: "New game",
  // PLACEHOLDER wording — "Name|Description", split at the pipe by the info popup.
  [TranslationKey.INFO_UNICORN]: "Unicorn|Glows. Step it next to a fountain to cast a rainbow.",
  [TranslationKey.INFO_RAINBOW]: "Rainbow|Pays one coin per turn while it shines. Light 5 at once to win.",
  [TranslationKey.INFO_FOUNTAIN]: "Fountain|Refracts a glow from the tile beside it into a rainbow on the tile opposite.",
  [TranslationKey.INFO_SUN]: "Sun|Always glows, never moves. Its two fountains are your starting income.",
  [TranslationKey.INFO_HINT]: "|Tap anything on the map to find out what it does.",
  [TranslationKey.INFO_FOG]: "Cloud|Unexplored. Walk a unicorn close by to lift the fog.",
  [TranslationKey.INFO_EMPTY]: "Meadow|Open ground. A fountain can cast a rainbow onto it.",
};
