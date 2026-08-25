import { getShortLanguageName } from "../utils/language-util";
import { enTranslations } from "./en";
import { getDeTranslationMap } from "./de";
import { getEsTranslationMap } from "./es";
import { TranslationKey } from "./translationKey";
import { HAS_GERMAN, HAS_SECONDARY_LANGUAGE, HAS_SPANISH, HAS_TEXT_PLACEHOLDERS } from "../env-utils";

// English is the default language and always ships. Each additional language is
// gated behind its own compile-time HAS_<LANG> flag (see env-utils.ts), so a
// disabled language's translation map is tree-shaken out of the build.
//
// To add a language, e.g. French:
//   1. .env* files:  LANG_FR_ENABLED=<true|false> per build mode
//   2. env-utils.ts: export const HAS_FRENCH = import.meta.env.LANG_FR_ENABLED === "true";
//      and add it to HAS_SECONDARY_LANGUAGE
//   3. src/translations/fr.ts: export a getFrTranslationMap() (see de.ts)
//   4. add one branch below
// The sniff sits inside HAS_SECONDARY_LANGUAGE rather than around it, and so does the
// <html lang> below: `navigator.language` is a property read terser cannot prove
// side-effect-free, so in a build whose every language branch has been compiled away it would
// be kept and performed on every lookup. The lang attribute is likewise only ever anything but
// the "en" index.html already carries once a second language ships.
function getActiveTranslations(): [lang: string, records: Record<TranslationKey, string>] {
  if (HAS_SECONDARY_LANGUAGE) {
    const lang = getShortLanguageName(navigator.language);
    if (HAS_GERMAN && lang === "de") return ["de", getDeTranslationMap()];
    if (HAS_SPANISH && lang === "es") return ["es", getEsTranslationMap()];
  }

  return ["en", enTranslations];
}

export function getTranslation(key: TranslationKey, ...args: string[]): string {
  const [lang, records] = getActiveTranslations();
  if (HAS_SECONDARY_LANGUAGE) document.documentElement.setAttribute("lang", lang);

  const translation = records[key];

  // Substitute {0}, {1}, … placeholders with runtime args. Gated behind its own
  // flag so the regex/replace is tree-shaken from builds that don't need it.
  return HAS_TEXT_PLACEHOLDERS ? translation.replace(/\{(\d+)}/g, (_, i) => args[i]) : translation;
}
