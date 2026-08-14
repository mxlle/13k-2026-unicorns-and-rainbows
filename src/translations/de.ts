import { TranslationKey } from "./translationKey";

// Example secondary language. Returned via a function so the German texts are
// tree-shaken away when HAS_GERMAN is false (LANG_DE_ENABLED !== "true"),
// e.g. in the js13k build. Copy this file's shape to add another language.
export function getDeTranslationMap(): Record<TranslationKey, string> {
  return {
    [TranslationKey.CONTINUE]: "Weiter",
    [TranslationKey.WON]: "Gewonnen!",
    [TranslationKey.LOST]: "Oh nein!",
    [TranslationKey.END_TURN]: "Zug beenden",
    [TranslationKey.INFO_UNICORN]: "Einhorn|Leuchtet. Stell es neben einen Brunnen, um einen Regenbogen zu erzeugen.",
    [TranslationKey.INFO_RAINBOW]: "Regenbogen|Bringt jede Runde eine Münze, solange er leuchtet. 5 gleichzeitig gewinnen.",
    [TranslationKey.INFO_FOUNTAIN]: "Brunnen|Bricht Licht von der Nachbarkachel zu einem Regenbogen auf der Kachel gegenüber.",
    [TranslationKey.INFO_SUN]: "Sonne|Leuchtet immer, bewegt sich nie. Ihre zwei Brunnen sind dein Startkapital.",
  };
}
