import { defineEnum } from "./enums";

// All js13k entries are served from the same origin (js13kgames.com), so they
// share one localStorage — js13k therefore recommends namespacing your keys,
// conventionally with your GitHub handle. Kept short: it is prepended to every
// key, so each character costs bytes in the zip.
const LOCAL_STORAGE_PREFIX = "mxlle";

export type LocalStorageKey = defineEnum<typeof LocalStorageKey>;
export const LocalStorageKey = defineEnum({
  MUSIC_MUTED: "m",
  SOUND_MUTED: "e", // the effects, switched off separately from the music
  // The best score on each level's own board, comma-joined and indexed by level. The digit is a
  // version: a record is only meaningful against the rules it was set under, so a change to the
  // economy that moves what a board is worth gets a new key rather than a migration — the old
  // one is simply left behind, and every stripe starts empty again. Last bumped when the lollipop
  // became a second kind of fountain (2026-09-12): the light rule, the source counts, the
  // boulders and every level seed changed together, so a record from before it is a record on a
  // board that no longer exists.
  SCORES: "l2",
  SIZE: "s1", // the board the launch screen is offering next — one rung above the last one played
  DARK_SIDE: "d", // "1" while the player is playing the dark unicorn (see dark-side.ts)
  // Dev-only (see HAS_DEV_TOOLS): which level was on the screen, so a reload comes back to the
  // board being looked at instead of to the launch screen. Absent means the launch screen. It
  // is written and read behind the flag, so a build without the dev tools never names it.
  SCREEN: "v",
});

// Every access is guarded because the storage getter itself can throw rather than return null:
// Firefox with cookies blocked for the site, and some private modes, raise a SecurityError.
// The first read happens at start-up, so unguarded it would take the game down before it draws.
export function setLocalStorageItem(key: LocalStorageKey, value: string, postfix?: string) {
  try {
    localStorage.setItem(LOCAL_STORAGE_PREFIX + "." + key + (postfix ? "." + postfix : ""), value);
  } catch {}
}

export function getLocalStorageItem(key: LocalStorageKey, postfix?: string): string | null {
  try {
    return localStorage.getItem(LOCAL_STORAGE_PREFIX + "." + key + (postfix ? "." + postfix : ""));
  } catch {
    return null;
  }
}

export function removeLocalStorageItem(key: LocalStorageKey, postfix?: string) {
  try {
    localStorage.removeItem(LOCAL_STORAGE_PREFIX + "." + key + (postfix ? "." + postfix : ""));
  } catch {}
}

export function getArrayFromStorage(key: LocalStorageKey) {
  const item = getLocalStorageItem(key);
  if (!item) {
    return [];
  }

  // @ts-ignore
  return item.split(",").map((v) => (v == +v ? +v : v));
}
