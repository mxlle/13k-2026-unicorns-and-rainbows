import { PLAYER, RIVAL, Side } from "../game/game-objects";
import { getLocalStorageItem, LocalStorageKey, setLocalStorageItem } from "./local-storage";

/**
 * On <body> while the player is playing the dark unicorn, and the whole of what switches the
 * page to the dark palette — see the `@if $has-side-choice` block at the foot of each
 * stylesheet, and $DARK in names.scss, which has to match this string.
 *
 * **Deliberately not a CssClass member**, which is the one place in the game a global class
 * name is written outside that enum. Every member of it consumes an identifier from the shared
 * minifier generator, which shifts every CSS-module name after it along — measured at 4 packed
 * bytes, for a class the competition build neither styles nor sets. Nothing here is ever
 * minified as a result, and nothing needs to be: the only builds that contain this class at all
 * are the ones with no byte budget.
 */
const DARK_CLASS = "global__dark";

/**
 * Which of the two sides is *drawn* as the dark one — and nothing more than that.
 *
 * The player always plays PLAYER: the same corner, the same economy, the same fog, the same
 * bot on the other side. Taking the dark side swaps which of the two is inverted (see isDark
 * in the map component) and turns the page dark with it, and that is the whole feature. The
 * model has never heard of it, which is why nothing in game-map.ts or bot.ts changes and why
 * `npm run bot` measures exactly the game it measured before.
 *
 * RIVAL by default, which is the game as it has always looked.
 *
 * A module-level binding rather than a lookup because isDark is asked once per glyph per
 * render, and a per-glyph trip to localStorage is not a thing to build.
 */
export let darkSide: Side = RIVAL;

// The one thing that does *not* follow the choice: whose light is drawn in the muted palette.
// That stays the rival's, whichever unicorn the player took — a beam says whose it is in its
// colour, and "the vivid ones are mine" is worth more than the tidiness of a dark unicorn
// casting dark light. See the beam rules in game-map.module.scss.

/** Reads the stored choice and puts the page in the right mode. Called once, at start-up. */
export function initDarkSide() {
  applyDarkSide(getLocalStorageItem(LocalStorageKey.DARK_SIDE) === "1");
}

/**
 * The launch screen's toggle. Stored, so the choice outlives the tab: it is a preference about
 * how the game looks rather than anything about a run, and being asked it again on every visit
 * would make it feel like part of starting one.
 */
export function chooseDarkSide(dark: boolean) {
  applyDarkSide(dark);
  setLocalStorageItem(LocalStorageKey.DARK_SIDE, dark ? "1" : "");
}

function applyDarkSide(dark: boolean) {
  darkSide = dark ? PLAYER : RIVAL;
  // The class is the whole of the dark theme — every rule answering to it is a `body.DARK`
  // override at the foot of the stylesheet it belongs to. See DARK_CLASS.
  document.body.classList.toggle(DARK_CLASS, dark);
}
