import styles from "./launch-screen.module.scss";
import { createButton, createElement } from "../../utils/html-utils";
import { CssClass } from "../../utils/css-class";
import { getLocalStorageItem, LocalStorageKey, setLocalStorageItem } from "../../utils/local-storage";
import { MAP_SIZES } from "../../game/game-map";
import { getTranslation } from "../../translations/i18n";
import { TranslationKey } from "../../translations/translationKey";
import { GAME_EMOJI } from "../../env-utils";

const MAP_EMOJI = "🗺️"; // labels the board a stripe plays on

/**
 * The hue the bottom stripe takes, in degrees; the top one takes 0, which is red. Bottom to
 * top is easiest to hardest, and that is the whole reason the rainbow is stood on end — the
 * colours a player already reads as "gentle" and as "danger" are at the right ends of it
 * without anything having to say so.
 *
 * Spread across however many stripes there are rather than being seven fixed colours, so the
 * band stays a rainbow if the list of boards grows or shrinks.
 */
const VIOLET_HUE = 300;
/**
 * A rainbow is not evenly spaced around the hue circle: orange and yellow are squeezed into
 * its first sixth while green sprawls over the next third. Spacing the stripes equally comes
 * out as two greens and no orange at all — so the steps are crowded towards the warm end,
 * which is exactly where the colour changes fastest. PLACEHOLDER exponent, tuned by eye.
 */
const WARM_BIAS = 1.4;

/**
 * The launch screen: one stripe per board on offer, picked in two taps — one to choose the
 * stripe, one on the button that appears at the end of it to start the run. Two taps rather
 * than one because a stripe is going to mean a level with a history behind it, and a screen
 * where looking at a level and committing to it are the same gesture leaves nowhere to put
 * that. It also means the board a run is about to be played on is stated before it starts.
 *
 * Long-term this is where the seven levels live, each stripe filling in as its level is
 * scored on — which is why there is one stripe per entry rather than a row of buttons over a
 * painted rainbow. Today every stripe is the same board generator at a different size, and
 * the only thing carried over between visits is which one was played last, which comes back
 * already picked.
 */
export function LaunchScreenComponent(onPlay: (size: number) => void): HTMLElement {
  const lastPlayed = getLocalStorageItem(LocalStorageKey.SIZE);
  // The stripe currently picked, and the board it stands for. Kept as the element rather than
  // as an index, so moving the pick is two class calls and an append — the screen is built
  // once and stays on the page for the whole session, hidden while a run is on.
  let picked: HTMLElement | undefined;
  let pickedSize = 0;

  // One button, moved into whichever stripe is picked, rather than one per stripe kept
  // hidden: it is the same offer wherever it lands, and there is only ever one of it.
  // HINT because it is exactly what that class is for elsewhere in the game — the one
  // obvious thing to do next.
  const playButton = createButton(
    {
      cssClass: [CssClass.HINT, styles.play],
      // The stripe underneath is listening too, and this is inside it. Nothing bad would
      // come of the pick being re-made on the way out, but the run has already started by
      // then and a launch screen quietly rearranging itself behind it is not worth the byte
      // it would save.
      onClick: (event) => {
        event.stopPropagation();
        // Stored on play rather than on pick, so it is the board actually played that comes
        // back chosen next time — a stripe merely looked at leaves no trace.
        setLocalStorageItem(LocalStorageKey.SIZE, `${pickedSize}`);
        onPlay(pickedSize);
      },
    },
    [createElement({ tag: "span", cssClass: CssClass.EMOJI, text: GAME_EMOJI }), ` ${getTranslation(TranslationKey.PLAY)}`],
  );

  const host = createElement(
    { cssClass: styles.host },
    MAP_SIZES.map((size, index) => {
      // The label is wrapped rather than dropped straight into the stripe: it has to centre
      // and give way as one thing when the play button lands beside it, and a bare text node
      // would be a flex item of its own.
      const stripe = createElement({ cssClass: styles.stripe, onClick: () => pick(stripe, size) }, [
        createElement({ cssClass: styles.label }, [createElement({ tag: "span", cssClass: CssClass.EMOJI, text: MAP_EMOJI }), ` ${size}`]),
      ]);

      // The one thing that differs per stripe. Everything else about how a stripe is drawn —
      // its solidity included — is in the stylesheet, reading this.
      stripe.style.setProperty("--h", `${VIOLET_HUE * ((MAP_SIZES.length - 1 - index) / (MAP_SIZES.length - 1)) ** WARM_BIAS}deg`);

      // The board played last comes back already picked, so a replay is the one tap it used
      // to be. Compared as a string: that is what came out of storage, and a board an older
      // build offered but this one does not simply matches nothing, leaving the screen
      // waiting for a choice exactly as it does on a first visit.
      if (`${size}` === lastPlayed) pick(stripe, size);

      return stripe;
    }),
  );

  function pick(stripe: HTMLElement, size: number) {
    picked?.classList.remove(styles.picked);
    (picked = stripe).classList.add(styles.picked);
    pickedSize = size;
    stripe.append(playButton); // moves it out of wherever it was — an element is in one place
  }

  return host;
}
