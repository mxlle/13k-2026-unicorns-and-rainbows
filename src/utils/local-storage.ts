import { defineEnum } from "./enums";

// All js13k entries are served from the same origin (js13kgames.com), so they
// share one localStorage — js13k therefore recommends namespacing your keys,
// conventionally with your GitHub handle. Kept short: it is prepended to every
// key, so each character costs bytes in the zip.
const LOCAL_STORAGE_PREFIX = "mxlle";

export type LocalStorageKey = defineEnum<typeof LocalStorageKey>;
export const LocalStorageKey = defineEnum({
  MUTED: "m",
  // The best score on each level's own board, comma-joined and indexed by level. The digit is a
  // version: a record is only meaningful against the rules it was set under, so a change to the
  // economy that moves what a board is worth gets a new key rather than a migration — the old
  // one is simply left behind, and every stripe starts empty again. Last bumped when the flower
  // became the custard springboard (see getMoveCost), which changed what a drop buys everywhere.
  SCORES: "l1",
  SIZE: "s1", // the board the launch screen is offering next — one rung above the last one played
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
