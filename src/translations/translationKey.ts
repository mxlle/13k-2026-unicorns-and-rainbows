import { defineEnum } from "../utils/enums";

// Only keys that are actually read ship — unused keys still cost bytes because
// the translation maps are kept whole. Delete keys when their last usage goes.
export type TranslationKey = defineEnum<typeof TranslationKey>;
export const TranslationKey = defineEnum({
  CONTINUE: 0,
  WON: 1,
  LOST: 2,
});
