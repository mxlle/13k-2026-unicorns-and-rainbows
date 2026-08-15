import { defineEnum } from "./enums";

// All js13k entries are served from the same origin (js13kgames.com), so they
// share one localStorage — js13k therefore recommends namespacing your keys,
// conventionally with your GitHub handle. Kept short: it is prepended to every
// key, so each character costs bytes in the zip.
const LOCAL_STORAGE_PREFIX = "mxlle";

export type LocalStorageKey = defineEnum<typeof LocalStorageKey>;
export const LocalStorageKey = defineEnum({
  MUTED: "m",
  LEVEL: "l",
  SIZE: "s", // the board size last played, so a run opens on the one the player chose
});

export function setLocalStorageItem(key: LocalStorageKey, value: string, postfix?: string) {
  localStorage.setItem(LOCAL_STORAGE_PREFIX + "." + key + (postfix ? "." + postfix : ""), value);
}

export function getLocalStorageItem(key: LocalStorageKey, postfix?: string): string | null {
  return localStorage.getItem(LOCAL_STORAGE_PREFIX + "." + key + (postfix ? "." + postfix : ""));
}

export function removeLocalStorageItem(key: LocalStorageKey, postfix?: string) {
  localStorage.removeItem(LOCAL_STORAGE_PREFIX + "." + key + (postfix ? "." + postfix : ""));
}

export function getArrayFromStorage(key: LocalStorageKey) {
  const item = getLocalStorageItem(key);
  if (!item) {
    return [];
  }

  // @ts-ignore
  return item.split(",").map((v) => (v == +v ? +v : v));
}
