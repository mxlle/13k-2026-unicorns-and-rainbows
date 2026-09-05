import { TranslationKey } from "./translationKey";

// Example secondary language. Returned via a function so the German texts are
// tree-shaken away when HAS_GERMAN is false (LANG_DE_ENABLED !== "true"),
// e.g. in the js13k build. Copy this file's shape to add another language.
export function getDeTranslationMap(): Record<TranslationKey, string> {
  return {
    [TranslationKey.CONTINUE]: "Weiter",
    [TranslationKey.WON]: "Die Zeit ist um!|Dein Endstand:",
    [TranslationKey.END_TURN]: "Zug beenden",
    [TranslationKey.LEVELS]: "Levels",
    [TranslationKey.RETRY]: "Nochmal",
    [TranslationKey.PLAY]: "Spielen",
    [TranslationKey.INFO_UNICORN]: "Einhorn|Dein Entdecker. Tippe ein helles Feld an — laufen kostet 💧 und vertreibt ☁️.",
    [TranslationKey.INFO_UNICORN_SHINE]: "Es leuchtet. Stell es so auf: 🦄⛲🌈. Jedes ✨ (3 Züge leuchten) macht seinen 🌈 wertvoller.",
    [TranslationKey.INFO_RAINBOW]: "Regenbogen|Er zählt, solange er leuchtet. Neben einem 🍭 macht er 🍬, sonst 💧.",
    [TranslationKey.INFO_FOUNTAIN]: "Brunnen|Auf der anderen Seite kommt ein Regenbogen heraus: 🦄⛲🌈",
    [TranslationKey.INFO_BATHTUB]: "Badewanne|Sie macht 2 💧 pro Zug.",
    [TranslationKey.INFO_BATHTUB_SELL]: "Ein neues Einhorn daneben kostet ein 🍬 pro Einhorn, das du hast.",
    [TranslationKey.INFO_HINT]: "|Tippe etwas an, um zu erfahren, was es tut.",
    [TranslationKey.INFO_GOAL]: "|Bau auf, bevor die Züge ausgehen. Jedes 🌈 und 🦄 zählt 1 Punkt pro % freigeräumter ☁️.",
    [TranslationKey.INFO_FOG]: "Wolke|Hier kannst du noch nichts sehen. Lauf mit einem Einhorn näher heran.",
    [TranslationKey.INFO_EMPTY]: "Wiese|Freier Platz. Hier kann ein Regenbogen entstehen.",
    [TranslationKey.INFO_TREE]: "Lollibaum|Er macht aus dem 💧 jedes 🌈 daneben 🍬. Hier kann kein Regenbogen entstehen.",
    [TranslationKey.INFO_DONUT]: "Donut|Ein Portal. Tippe einen anderen 🍩 an, um für 2 💧 dorthin zu springen.",
    [TranslationKey.INFO_FLOWER]: "Blume|Wer darauf steht, geht jeden Schritt gratis weiter. Hier kann kein Regenbogen entstehen.",
    [TranslationKey.INFO_CHEST]: "Geschenk|Betritt es zum Öffnen. Darin ist 💧, 🍬 oder ein neues 🦄.",
    [TranslationKey.INFO_TUB_SITE]: "Leere Wanne|Ein Einhorn daneben kann sie füllen.",
    [TranslationKey.INFO_FOUNTAIN_SITE]: "Geröll|Ein Einhorn daneben kann den Brunnen wieder aufbauen.",
    [TranslationKey.INFO_TREE_SITE]: "Setzling|Ein Einhorn daneben kann ihn zum 🍭-Baum ziehen.",
    // Der Gegner. Kein HAS_OPPONENT-Ternary nötig: die ganze Datei hängt schon an HAS_GERMAN.
    [TranslationKey.INFO_RIVAL]: "Dunkles Einhorn|Dein Rivale. Es spielt dasselbe Spiel — sei vor ihm an den Brunnen.",
    [TranslationKey.INFO_DARK_RAINBOW]: "Dunkler Regenbogen|Er zählt für deinen Rivalen. Sein Feld ist besetzt.",
    [TranslationKey.INFO_STUCK]: "Zug verbraucht|Du kannst dir nichts mehr leisten. Beende den Zug, um dein Einkommen zu kassieren.",
    [TranslationKey.INFO_STUCK_LAST]: "Letzter Zug verbraucht|Nichts mehr zu tun. Beende den Zug, um das Spiel zu beenden.",
    [TranslationKey.WON_RACE]: "Du gewinnst!|Dein Endstand:",
    [TranslationKey.LOST_RACE]: "Dein Rivale gewinnt!|Dein Endstand:",
  };
}
