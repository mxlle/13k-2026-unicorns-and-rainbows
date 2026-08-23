import { getShortLanguageName } from "../utils/language-util";
import { enTranslations } from "./en";
import { getDeTranslationMap } from "./de";
import { TranslationKey } from "./translationKey";
import { HAS_GERMAN, HAS_TEXT_PLACEHOLDERS } from "../env-utils";

// English is the default language and always ships. Each additional language is
// gated behind its own compile-time HAS_<LANG> flag (see env-utils.ts), so a
// disabled language's translation map is tree-shaken out of the build.
//
// To add a language, e.g. French:
//   1. .env* files:  LANG_FR_ENABLED=<true|false> per build mode
//   2. env-utils.ts: export const HAS_FRENCH = import.meta.env.LANG_FR_ENABLED === "true";
//   3. src/translations/fr.ts: export a getFrTranslationMap() (see de.ts)
//   4. add one branch below
// Both halves are written inside the flag rather than around it: `navigator.language` is a
// property read terser cannot prove side-effect-free, so a sniff whose only reader has been
// compiled away is kept and performed on every lookup. Same for the <html lang>, which is
// only ever anything but the "en" index.html already carries once a second language ships.
function getActiveTranslations(): [lang: string, records: Record<TranslationKey, string>] {
  if (HAS_GERMAN && getShortLanguageName(navigator.language) === "de") return ["de", getDeTranslationMap()];

  return ["en", enTranslations];
}

export function getTranslation(key: TranslationKey, ...args: string[]): string {
  const [lang, records] = getActiveTranslations();
  if (HAS_GERMAN) document.documentElement.setAttribute("lang", lang);

  const translation = records[key];

  // Substitute {0}, {1}, … placeholders with runtime args. Gated behind its own
  // flag so the regex/replace is tree-shaken from builds that don't need it.
  return HAS_TEXT_PLACEHOLDERS ? translation.replace(/\{(\d+)}/g, (_, i) => args[i]) : translation;
}
