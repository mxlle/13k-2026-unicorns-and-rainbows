import { TranslationKey } from "./translationKey";

// Example secondary language. Returned via a function so the German texts are
// tree-shaken away when HAS_GERMAN is false (LANG_DE_ENABLED !== "true"),
// e.g. in the js13k build. Copy this file's shape to add another language.
export function getDeTranslationMap(): Record<TranslationKey, string> {
  return {
    [TranslationKey.CONTINUE]: "Weiter",
    [TranslationKey.WON]: "Gewonnen!|Alle Regenbögen, die du brauchst, leuchten gleichzeitig.",
    [TranslationKey.LOST]: "Oh nein!|Keine Tropfen und keine Regenbögen mehr. Nichts kann sich bewegen.",
    [TranslationKey.END_TURN]: "Zug beenden",
    [TranslationKey.NEW_GAME]: "Neues Spiel",
    [TranslationKey.INFO_UNICORN]: "Einhorn|Es leuchtet. Stell es so auf: 🦄⛲🌈",
    [TranslationKey.INFO_RAINBOW]: "Regenbogen|Ein 💧 pro Zug. Lass 5 gleichzeitig leuchten und du gewinnst.",
    [TranslationKey.INFO_FOUNTAIN]: "Brunnen|Auf der anderen Seite kommt ein Regenbogen heraus: 🦄⛲🌈",
    [TranslationKey.INFO_SUN]: "Sonne|Sie bewegt sich nie. Ihre Regenbögen verschwinden nie: ☀️⛲🌈",
    [TranslationKey.INFO_HINT]: "|Tippe etwas auf der Karte an, um zu erfahren, was es tut.",
    [TranslationKey.INFO_FOG]: "Wolke|Hier kannst du noch nichts sehen. Lauf mit einem Einhorn näher heran.",
    [TranslationKey.INFO_EMPTY]: "Wiese|Freier Platz. Hier kann ein Regenbogen entstehen.",
  };
}
