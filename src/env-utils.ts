export const IS_POKI_ENABLED = import.meta.env.POKI_ENABLED === "true";
export const IS_DEV = import.meta.env.DEV;
const IS_JS13K = import.meta.env.IS_JS13K === "true";

// Feature flags — everything behind a `!IS_JS13K` flag is tree-shaken out of
// the competition build. Add flags here instead of sprinkling mode checks.
export const HAS_VISUAL_NICE_TO_HAVES = !IS_JS13K;
export const HAS_GAMEPLAY_NICE_TO_HAVES = !IS_JS13K;
export const HAS_ADVANCED_DEBUGGING = !IS_JS13K;
export const HAS_SHORT_TEXTS = IS_JS13K;
export const HAS_SIMPLE_SOUND_EFFECTS = true;

// Runtime {0}/{1} placeholder substitution in translations. Its own flag (not
// tied to HAS_SHORT_TEXTS) so you can keep short texts AND interpolation, or
// drop the interpolation regex to save bytes when no string uses placeholders.
export const HAS_TEXT_PLACEHOLDERS = true;

// Secondary languages. English always ships as the default/fallback; enable any
// additional language per build mode via its `LANG_<code>_ENABLED` env var (see
// the .env* files). Each flag is a compile-time constant, so a disabled
// language's translation map is tree-shaken out entirely (0 bytes).
// To add one, e.g. French: add LANG_FR_ENABLED to the .env* files, a HAS_FRENCH
// flag here, a src/translations/fr.ts, and one branch in i18n.ts.
export const HAS_GERMAN = import.meta.env.LANG_DE_ENABLED === "true";

export const GAME_TITLE = "Unicorns and Rainbows";
