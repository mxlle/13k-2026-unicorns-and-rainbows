import { TranslationKey } from "./translationKey";

// For texts that should be shorter in the competition build, use per-entry
// ternaries on the HAS_SHORT_TEXTS flag (env-utils.ts) — the unused variant is
// tree-shaken: [TranslationKey.START]: HAS_SHORT_TEXTS ? "Go" : "Start game",
export const enTranslations: Record<TranslationKey, string> = {
  [TranslationKey.CONTINUE]: "Continue",
  [TranslationKey.WON]: "You won!",
  [TranslationKey.LOST]: "Oh no!",
};
