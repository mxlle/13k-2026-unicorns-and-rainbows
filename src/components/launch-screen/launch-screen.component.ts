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
 * The launch screen: one stripe per board on offer, played in two taps — one to pick the
 * stripe, a second anywhere on it to start the run. Two taps rather than one because a stripe
 * is going to mean a level with a history behind it, and a screen where looking at a level and
 * committing to it are the same gesture leaves nowhere to put that. It also means the board a
 * run is about to be played on is stated before it starts.
 *
 * Long-term this is where the seven levels live, each stripe filling in as its level is
 * scored on — which is why there is one stripe per entry rather than a row of buttons over a
 * painted rainbow. Today every stripe is the same board generator at a different size.
 *
 * The screen always opens with something picked, and the pick climbs: a new player finds the
 * bottom stripe ready to play, and finishing a run leaves the one above it ready instead. So
 * the ladder is walked by pressing the same button over and over, and picking a stripe is
 * something a player does only to break step — to replay one, or to skip ahead.
 */
export function LaunchScreenComponent(onPlay: (size: number) => void): HTMLElement {
  // The rung being offered, as an index rather than a size: the whole behaviour is "the next
  // one along", which is a thing only a position in the ladder can say.
  let pickedIndex = 0;
  const stripes: HTMLElement[] = [];

  // One button, moved into whichever stripe is picked, rather than one per stripe kept
  // hidden: it is the same offer wherever it lands, and there is only ever one of it.
  // HINT because it is exactly what that class is for elsewhere in the game — the one
  // obvious thing to do next.
  // It carries no handler of its own: it only ever sits inside the picked stripe, and a click
  // on the picked stripe is already the thing this button offers (see the stripe below). So
  // the click bubbles into that one handler instead of there being two ways to start a run.
  const playButton = createButton({ cssClass: [CssClass.HINT, styles.play] }, [
    createElement({ tag: "span", cssClass: CssClass.EMOJI, text: GAME_EMOJI }),
    ` ${getTranslation(TranslationKey.PLAY)}`,
  ]);

  const host = createElement(
    { cssClass: styles.host },
    MAP_SIZES.map((size, index) => {
      // The label is wrapped rather than dropped straight into the stripe: it has to centre
      // and give way as one thing when the play button lands beside it, and a bare text node
      // would be a flex item of its own.
      // What is in it is the rung's number first and biggest — that is what a level selector
      // is a list of, and it is the one thing that will still be true once the stripes stop
      // being seven sizes of the same generator. The board comes second and smaller, as the
      // detail about the level rather than its name, and states both axes because "9" alone
      // reads as an amount of something rather than as how big the map is.
      // The ladder runs 5 to 25, so the dimensions are three characters wide on the bottom
      // three rungs and five on the rest — and on a wide screen, where the label is centred,
      // that difference walks the level number sideways as the eye goes down the column.
      // Padding the short ones out to the same width is what holds it still; the page is set
      // in a monospace face, so one character is one exact amount of space and this comes out
      // straight rather than nearly straight.
      // The padding goes on the outside of the pair rather than in front of each half, so
      // "5×5" stays tight around its × and it is the slack that is centred. No-break spaces
      // because ordinary ones at the edges of a text node collapse away to nothing.
      const width = `${size}`;
      const left = width.padStart(2, "\u00a0");
      const right = width.padEnd(2, "\u00a0");
      // A tap on a stripe that is not the picked one picks it; a tap anywhere on the picked
      // one starts the run. Two taps to play a level the player was not already being offered,
      // one to take the offer — and the whole stripe is that offer's target rather than just
      // the button on it, which on a phone is the difference between a comfortable hit and a
      // careful one. The button stays because it is what *says* the second tap plays.
      const stripe = createElement({ cssClass: styles.stripe, onClick: () => (index === pickedIndex ? start() : pick(index)) }, [
        createElement({ cssClass: styles.label }, [
          createElement({ cssClass: styles.level, text: `${index + 1}` }),
          // Wrapped so the emoji and the dimensions are one flex item; loose, they would be two,
          // and the label's gap would open up in the middle of the board's own name.
          createElement({ tag: "span" }, [createElement({ tag: "span", cssClass: CssClass.EMOJI, text: MAP_EMOJI }), ` ${left}×${right}`]),
        ]),
      ]);

      // The one thing that differs per stripe. Everything else about how a stripe is drawn —
      // its solidity included — is in the stylesheet, reading this.
      stripe.style.setProperty("--h", `${VIOLET_HUE * ((MAP_SIZES.length - 1 - index) / (MAP_SIZES.length - 1)) ** WARM_BIAS}deg`);
      stripes.push(stripe);

      return stripe;
    }),
  );

  /**
   * Starts the picked run. The screen steps up a rung as it goes, so it is already offering
   * the next level by the time the player comes back to it — both happen in here, so the
   * screen is hidden before the browser ever paints the moved pick. The top of the ladder
   * stays put: there is nothing above it to climb to.
   */
  function start() {
    const size = MAP_SIZES[pickedIndex]; // read before the pick moves on
    const next = Math.min(pickedIndex + 1, MAP_SIZES.length - 1);
    pick(next);
    // What is stored is the rung now on offer rather than the one just played, so closing the
    // tab and coming back lands in the same place as walking back from the run does.
    setLocalStorageItem(LocalStorageKey.SIZE, `${MAP_SIZES[next]}`);
    onPlay(size);
  }

  function pick(index: number) {
    stripes[pickedIndex].classList.remove(styles.picked);
    stripes[(pickedIndex = index)].classList.add(styles.picked);
    stripes[index].append(playButton); // moves it out of wherever it was — an element is in one place
  }

  // Where the screen opens. A stored board that this build no longer offers finds no index, and
  // so does the empty storage of a first visit — both come back -1 and both belong at the
  // bottom of the ladder, which is what the floor at 0 says in one expression.
  pick(Math.max(0, MAP_SIZES.indexOf(Number(getLocalStorageItem(LocalStorageKey.SIZE)))));

  return host;
}
