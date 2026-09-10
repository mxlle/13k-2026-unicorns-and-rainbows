import { TranslationKey } from "./translationKey";

// Latin American Spanish — the Poki audience is largely South American, so the vocabulary is
// chosen for that side of the Atlantic: "puntaje" rather than "puntuación", "dona" rather than
// "dónut", and "tú" throughout (never "vosotros"), which also matches the German file's "du".
// Returned via a function so the texts are tree-shaken away when HAS_SPANISH is false
// (LANG_ES_ENABLED !== "true"), e.g. in the js13k build.
export function getEsTranslationMap(): Record<TranslationKey, string> {
  return {
    [TranslationKey.CONTINUE]: "Continuar",
    [TranslationKey.WON]: "¡Se acabó el tiempo!|Puntaje:",
    [TranslationKey.END_TURN]: "Terminar turno",
    [TranslationKey.LEVELS]: "Niveles",
    [TranslationKey.RETRY]: "Reintentar",
    [TranslationKey.PLAY]: "Jugar",
    [TranslationKey.INFO_UNICORN]: "Unicornio|Toca una casilla iluminada para caminar. Cuesta 💧, despeja ☁️.",
    [TranslationKey.INFO_UNICORN_SHINE]: "Alinea 🦄⛲🌈 para que brille. Brillar sube su rango. Cada rango hace que su 🌈 valga más.",
    [TranslationKey.INFO_RAINBOW]: "Arcoíris|Suma puntos mientras brilla. Junto a un 🍭 hace 🍬, si no 💧.",
    [TranslationKey.INFO_FOUNTAIN]: "Fuente|Necesaria para crear un arcoíris: 🦄⛲🌈",
    [TranslationKey.INFO_BATHTUB]: "Bañera|Hace 2 💧 por turno.",
    [TranslationKey.INFO_BATHTUB_SELL]: "Un unicornio nuevo cuesta un 🍬 por cada unicornio que tengas.",
    [TranslationKey.INFO_HINT]: "|Toca algo para saber más.",
    [TranslationKey.INFO_GOAL]: "|Cada 🌈 y 🦄 da 1 punto por % de ☁️ despejadas.",
    [TranslationKey.INFO_FOG]: "Nube|Desconocido. Acércate.",
    [TranslationKey.INFO_EMPTY]: "Pradera|Espacio libre.",
    // "caramelos" rather than a regional word for the lollipop itself: chupetín, paleta and
    // piruleta each pick one country, and this is the only line where 🍬 needs a word at all.
    [TranslationKey.INFO_TREE]: "Árbol de caramelos|Convierte el 💧 de cada 🌈 al lado en 🍬.",
    [TranslationKey.INFO_DONUT]: "Dona|Un portal. Toca otra 🍩 para saltar por 2 💧.",
    [TranslationKey.INFO_CUSTARD]: "Flan|Rebota. Los pasos desde aquí son gratis.",
    [TranslationKey.INFO_CHEST]: "Regalo|Písalo para abrirlo.",
    [TranslationKey.INFO_TUB_SITE]: "Ducha|Un unicornio al lado puede construir una bañera.",
    [TranslationKey.INFO_FOUNTAIN_SITE]: "Hoyo|Un unicornio al lado puede construir una fuente.",
    [TranslationKey.INFO_TREE_SITE]: "Brote|Un unicornio al lado puede convertirlo en un árbol de 🍭.",
    [TranslationKey.INFO_RIVAL]: "Unicornio oscuro|Tu rival. Llega a las fuentes antes que él.",
    [TranslationKey.INFO_DARK_RAINBOW]: "Arcoíris oscuro|Suma puntos para tu rival.",
    [TranslationKey.INFO_STUCK]: "No quedan acciones|Termina el turno para cobrar ingresos.",
    [TranslationKey.INFO_STUCK_LAST]: "No quedan acciones|Termina el turno para terminar.",
    [TranslationKey.WON_RACE]: "¡Ganaste!|Puntaje:",
    [TranslationKey.LOST_RACE]: "¡Ganó tu rival!|Puntaje:",
    [TranslationKey.RANK]: "Rango",
  };
}
