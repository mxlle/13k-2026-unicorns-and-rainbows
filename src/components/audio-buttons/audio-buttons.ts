import { createButton } from "../../utils/html-utils";
import { CssClass } from "../../utils/css-class";
import { toggleEffects, togglePlayer } from "../../audio/music-control";
import { getLocalStorageItem, LocalStorageKey } from "../../utils/local-storage";

/**
 * One switch per kind of sound: the music and the effects, each remembered on its own key. Off
 * is shown by dimming the same glyph rather than swapping it — there is no "music off" emoji,
 * and one rule for both buttons reads better than two.
 */
function AudioButton(emoji: string, mutedKey: LocalStorageKey, toggle: () => boolean): HTMLElement {
  return createButton({
    text: emoji,
    cssClass: [CssClass.ICON_BTN, CssClass.SECONDARY, getLocalStorageItem(mutedKey) === "true" ? CssClass.DIMMED : ""],
    onClick: (event) => event.target.classList.toggle(CssClass.DIMMED, !toggle()),
  });
}

export function AudioButtons(): HTMLElement[] {
  return [AudioButton("🎵", LocalStorageKey.MUSIC_MUTED, togglePlayer), AudioButton("🔊", LocalStorageKey.SOUND_MUTED, toggleEffects)];
}
