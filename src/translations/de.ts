import { TranslationKey } from "./translationKey";

// Example secondary language. Returned via a function so the German texts are
// tree-shaken away when HAS_GERMAN is false (LANG_DE_ENABLED !== "true"),
// e.g. in the js13k build. Copy this file's shape to add another language.
export function getDeTranslationMap(): Record<TranslationKey, string> {
  return {
    [TranslationKey.CONTINUE]: "Weiter",
    [TranslationKey.WON]: "Die Zeit ist um!|Endstand:",
    [TranslationKey.END_TURN]: "Zug beenden",
    [TranslationKey.LEVELS]: "Levels",
    [TranslationKey.RETRY]: "Nochmal",
    [TranslationKey.PLAY]: "Spielen",
    [TranslationKey.INFO_UNICORN]: "Einhorn|Tippe ein markiertes Feld an, um zu laufen. Kostet 💧, vertreibt ☁️.",
    [TranslationKey.INFO_UNICORN_SHINE]:
      "Stell es so auf, damit es leuchtet: 🦄⛲🌈. Leuchten erhöht seinen Rang. Mit jedem Rang wird sein 🌈 wertvoller.",
    [TranslationKey.INFO_RAINBOW]: "Regenbogen|Punktet, solange er leuchtet. Neben einem 🍭 erzeugt er 🍬, sonst 💧.",
    [TranslationKey.INFO_FOUNTAIN]: "Brunnen|Nötig für einen Regenbogen: 🦄⛲🌈",
    [TranslationKey.INFO_BATHTUB]: "Badewanne|Erzeugt 2 💧 pro Zug.",
    [TranslationKey.INFO_BATHTUB_SELL]: "Ein neues Einhorn kostet ein 🍬 pro Einhorn, das du schon hast.",
    [TranslationKey.INFO_HINT]: "|Tippe etwas an, um mehr zu erfahren.",
    [TranslationKey.INFO_GOAL]: "|Jedes 🌈 und 🦄 bringt 1 Punkt pro % vertriebener ☁️.",
    [TranslationKey.INFO_FOG]: "Wolke|Unbekannt. Lauf näher heran.",
    [TranslationKey.INFO_EMPTY]: "Wiese|Freier Platz.",
    [TranslationKey.INFO_TREE]: "Lollibaum|Verwandelt das 💧 jedes 🌈 daneben in 🍬.",
    [TranslationKey.INFO_DONUT]: "Donut|Ein Portal. Tippe einen anderen 🍩 an, um für 2 💧 dorthin zu springen.",
    [TranslationKey.INFO_CUSTARD]: "Pudding|Federnd. Jeder Schritt von hier ist gratis.",
    [TranslationKey.INFO_CHEST]: "Geschenk|Betritt es, um es zu öffnen.",
    [TranslationKey.INFO_TUB_SITE]: "Dusche|Ein Einhorn daneben kann eine Wanne bauen.",
    [TranslationKey.INFO_FOUNTAIN_SITE]: "Loch|Ein Einhorn daneben kann einen Brunnen bauen.",
    [TranslationKey.INFO_TREE_SITE]: "Setzling|Ein Einhorn daneben kann daraus einen 🍭-Baum ziehen.",
    [TranslationKey.INFO_RIVAL]: "Dunkles Einhorn|Dein Rivale. Erreiche die Brunnen vor ihm.",
    [TranslationKey.INFO_DARK_RAINBOW]: "Dunkler Regenbogen|Punktet für deinen Rivalen.",
    [TranslationKey.INFO_STUCK]: "Keine Aktionen mehr möglich|Beende den Zug, um dein Einkommen zu kassieren.",
    [TranslationKey.INFO_STUCK_LAST]: "Keine Aktionen mehr möglich|Beende den Zug, um die Partie abzuschließen.",
    [TranslationKey.WON_RACE]: "Du gewinnst!|Endstand:",
    [TranslationKey.LOST_RACE]: "Dein Rivale gewinnt!|Endstand:",
    [TranslationKey.RANK]: "Rang",
  };
}
