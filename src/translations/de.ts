import { TranslationKey } from "./translationKey";

// Example secondary language. Returned via a function so the German texts are
// tree-shaken away when HAS_GERMAN is false (LANG_DE_ENABLED !== "true"),
// e.g. in the js13k build. Copy this file's shape to add another language.
export function getDeTranslationMap(): Record<TranslationKey, string> {
  return {
    [TranslationKey.CONTINUE]: "Weiter",
    [TranslationKey.WON]: "Die Zeit ist um!|Dein Endstand:",
    [TranslationKey.END_TURN]: "Zug beenden",
    [TranslationKey.BACK]: "Zurück",
    [TranslationKey.PLAY]: "Jetzt spielen",
    [TranslationKey.INFO_UNICORN]: "Einhorn|Es leuchtet. Stell es so auf: 🦄⛲🌈",
    [TranslationKey.INFO_RAINBOW]: "Regenbogen|Ein 💧 pro Zug, und er zählt, solange er leuchtet.",
    [TranslationKey.INFO_FOUNTAIN]: "Brunnen|Auf der anderen Seite kommt ein Regenbogen heraus: 🦄⛲🌈",
    [TranslationKey.INFO_BATHTUB]: "Badewanne|Sie macht 2 💧 pro Zug. Ein neues Einhorn daneben kostet ein 🍬 pro Einhorn, das du hast.",
    [TranslationKey.INFO_HINT]: "|Tippe etwas auf der Karte an, um zu erfahren, was es tut.",
    [TranslationKey.INFO_GOAL]: "|Bau auf, bevor die Züge ausgehen. Regenbögen, Einhörner, 🍬-Bäume und freie Felder zählen.",
    [TranslationKey.INFO_FOG]: "Wolke|Hier kannst du noch nichts sehen. Lauf mit einem Einhorn näher heran.",
    [TranslationKey.INFO_EMPTY]: "Wiese|Freier Platz. Hier kann ein Regenbogen entstehen.",
    [TranslationKey.INFO_TREE]: "Lollibaum|Neben einem Regenbogen macht er ein 🍬 pro Zug. Hier kann kein Regenbogen entstehen.",
    [TranslationKey.INFO_DONUT]: "Donut|Ein Portal zum anderen Donut. Der Sprung kostet ein 💧 extra.",
    [TranslationKey.JUMP]: "Springen",
    [TranslationKey.INFO_FLOWER]: "Blume|Ein Schritt darauf ist gratis. Aber hier kann kein Regenbogen entstehen.",
    [TranslationKey.INFO_CHEST]: "Geschenk|Betritt es zum Öffnen. Darin ist 💧, 🍬 oder ein neues 🦄.",
    [TranslationKey.INFO_TUB_SITE]: "Leere Wanne|Ein Einhorn daneben kann sie füllen.",
    [TranslationKey.INFO_FOUNTAIN_SITE]: "Geröll|Ein Einhorn daneben kann den Brunnen wieder aufbauen.",
    [TranslationKey.INFO_TREE_SITE]: "Setzling|Ein Einhorn daneben kann ihn zum 🍭-Baum ziehen.",
  };
}
