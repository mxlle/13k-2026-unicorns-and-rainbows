import { createButton, createElement } from "../../utils/html-utils";
import { CssClass } from "../../utils/css-class";
import { toggleEffects, togglePlayer } from "../../audio/music-control";
import { getLocalStorageItem, LocalStorageKey } from "../../utils/local-storage";

/**
 * One switch per kind of sound: the music and the effects, each remembered on its own key. Off
 * is shown by dimming the same glyph rather than swapping it — there is no "music off" emoji,
 * and one rule for both buttons reads better than two.
 *
 * The glyph sits in a span of its own for the dark theme's sake: 🎵 and 🔊 are near-black art
 * and have to be inverted to be seen on a dark page, and a filter on the *button* takes more
 * than the glyph with it — a button carries `backdrop-filter`, which makes anything with a
 * filter on it a backdrop root, so inverting the button inverted the blurred page behind it and
 * drew a pale disc where the dark page should show through. On the span there is nothing behind
 * the glyph to catch. See the rule in globals.scss.
 *
 * It is also why the handler is a method rather than an arrow: `event.target` is now the span
 * whenever the glyph itself is clicked, and it is the *button* that wears the muted class. A
 * non-arrow listener gets the element it is bound to as `this`, which is that button however
 * deep the click landed.
 */
function AudioButton(emoji: string, mutedKey: LocalStorageKey, toggle: () => boolean): HTMLElement {
  return createButton(
    {
      cssClass: [CssClass.ICON_BTN, CssClass.SECONDARY, getLocalStorageItem(mutedKey) === "true" ? CssClass.DIMMED : ""],
      onClick() {
        this.classList.toggle(CssClass.DIMMED, !toggle());
      },
    },
    [createElement({ tag: "span", text: emoji })],
  );
}

export function AudioButtons(): HTMLElement[] {
  return [AudioButton("🎵", LocalStorageKey.MUSIC_MUTED, togglePlayer), AudioButton("🔊", LocalStorageKey.SOUND_MUTED, toggleEffects)];
}
