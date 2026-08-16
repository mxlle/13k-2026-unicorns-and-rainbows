import styles from "./launch-screen.module.scss";
import { createElement } from "../../utils/html-utils";
import { CssClass } from "../../utils/css-class";
import { getLocalStorageItem, LocalStorageKey, setLocalStorageItem } from "../../utils/local-storage";
import { MAP_SIZES } from "../../game/game-map";

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
 * The launch screen: one stripe per board on offer, tapping one starts a run on it.
 *
 * Long-term this is where the seven levels live, each stripe filling in as its level is
 * scored on — which is why there is one stripe per entry rather than a row of buttons over a
 * painted rainbow. Today every stripe is the same board generator at a different size, and
 * the only thing carried over between visits is which one was played last.
 */
export function LaunchScreenComponent(onPick: (size: number) => void): HTMLElement {
  const lastPlayed = getLocalStorageItem(LocalStorageKey.SIZE);
  // The stripe currently wearing the marker. Kept as the element rather than as a size, so
  // moving the mark is two class calls and the screen needs no re-render of its own — it is
  // built once and stays on the page for the whole session, hidden while a run is on.
  let marked: HTMLElement | undefined;

  const host = createElement(
    { cssClass: styles.host },
    MAP_SIZES.map((size, index) => {
      const stripe = createElement(
        {
          cssClass: styles.stripe,
          onClick: () => {
            setLocalStorageItem(LocalStorageKey.SIZE, `${size}`);
            mark(stripe);
            onPick(size);
          },
        },
        [createElement({ tag: "span", cssClass: CssClass.EMOJI, text: MAP_EMOJI }), ` ${size}`],
      );

      // Which one was played last, so a returning player's eye lands where they left off.
      // Compared as a string: that is what came out of storage, and a board an older build
      // offered but this one does not simply matches nothing.
      if (`${size}` === lastPlayed) mark(stripe);

      // The one thing that differs per stripe. Everything else about how a stripe is drawn —
      // its solidity included — is in the stylesheet, reading this.
      stripe.style.setProperty("--h", `${VIOLET_HUE * ((MAP_SIZES.length - 1 - index) / (MAP_SIZES.length - 1)) ** WARM_BIAS}deg`);

      return stripe;
    }),
  );

  function mark(stripe: HTMLElement) {
    marked?.classList.remove(styles.last);
    (marked = stripe).classList.add(styles.last);
  }

  return host;
}
