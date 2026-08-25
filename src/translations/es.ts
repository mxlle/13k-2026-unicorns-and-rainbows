import { TranslationKey } from "./translationKey";

// Latin American Spanish — the Poki audience is largely South American, so the vocabulary is
// chosen for that side of the Atlantic: "puntaje" rather than "puntuación", "dona" rather than
// "dónut", and "tú" throughout (never "vosotros"), which also matches the German file's "du".
// Returned via a function so the texts are tree-shaken away when HAS_SPANISH is false
// (LANG_ES_ENABLED !== "true"), e.g. in the js13k build.
export function getEsTranslationMap(): Record<TranslationKey, string> {
  return {
    [TranslationKey.CONTINUE]: "Continuar",
    [TranslationKey.WON]: "¡Se acabó el tiempo!|Tu puntaje final:",
    [TranslationKey.END_TURN]: "Terminar turno",
    [TranslationKey.NEW_GAME]: "Nuevo juego",
    [TranslationKey.PLAY]: "Jugar ahora",
    [TranslationKey.INFO_UNICORN]: "Unicornio|Tu explorador. Toca una casilla iluminada — caminar cuesta 💧 y despeja ☁️.",
    [TranslationKey.INFO_UNICORN_SHINE]: "Brilla. Alinéalo así: 🦄⛲🌈. Cada ✨ (3 turnos brillando) hace que su 🌈 valga más.",
    [TranslationKey.INFO_RAINBOW]: "Arcoíris|Suma puntos mientras brilla. Junto a un 🍭 hace 🍬, si no 💧.",
    [TranslationKey.INFO_FOUNTAIN]: "Fuente|Del otro lado sale un arcoíris: 🦄⛲🌈",
    [TranslationKey.INFO_BATHTUB]: "Bañera|Hace 2 💧 por turno.",
    [TranslationKey.INFO_BATHTUB_SELL]: "Un unicornio nuevo al lado cuesta un 🍬 por cada unicornio que tengas.",
    [TranslationKey.INFO_HINT]: "|Toca algo para saber qué hace.",
    [TranslationKey.INFO_GOAL]: "|Construye antes de que se acaben los turnos. Cada 🌈 y 🦄 da 1 punto por % de ☁️ que despejaste.",
    [TranslationKey.INFO_FOG]: "Nube|Todavía no puedes ver aquí. Acerca un unicornio.",
    [TranslationKey.INFO_EMPTY]: "Pradera|Espacio libre. Aquí puede aparecer un arcoíris.",
    // "caramelos" rather than a regional word for the lollipop itself: chupetín, paleta and
    // piruleta each pick one country, and this is the only line where 🍬 needs a word at all.
    [TranslationKey.INFO_TREE]: "Árbol de caramelos|Convierte el 💧 de cada 🌈 al lado en 🍬. Aquí no puede aparecer un arcoíris.",
    [TranslationKey.INFO_DONUT]: "Dona|Un portal. Toca otra 🍩 para saltar allí por 2 💧.",
    [TranslationKey.INFO_FLOWER]: "Flor|Pisarla es gratis. Pero aquí no puede aparecer un arcoíris.",
    [TranslationKey.INFO_CHEST]: "Regalo|Písalo para abrirlo. Dentro hay 💧, 🍬 o un 🦄 nuevo.",
    [TranslationKey.INFO_TUB_SITE]: "Bañera vacía|Un unicornio al lado puede llenarla.",
    [TranslationKey.INFO_FOUNTAIN_SITE]: "Escombros|Un unicornio al lado puede reconstruir la fuente.",
    [TranslationKey.INFO_TREE_SITE]: "Brote|Un unicornio al lado puede convertirlo en un árbol de 🍭.",
    // El rival. No hace falta un ternary de HAS_OPPONENT: todo el archivo ya depende de HAS_SPANISH.
    [TranslationKey.INFO_RIVAL]: "Unicornio oscuro|Tu rival. Juega el mismo juego — llega a las fuentes antes que él.",
    [TranslationKey.INFO_DARK_RAINBOW]: "Arcoíris oscuro|Suma puntos para tu rival. Su casilla está ocupada.",
    [TranslationKey.WON_RACE]: "¡Ganaste!|Tu puntaje final:",
    [TranslationKey.LOST_RACE]: "¡Ganó tu rival!|Tu puntaje final:",
  };
}
