import { createElement } from "../../../utils/html-utils";
import { CssClass } from "../../../utils/css-class";
import styles from "./header.module.scss";

/**
 * The game's name and whatever the screen lends the header, on one row. The title stays at
 * every width: it is the one place the game says what it is called, and words say that to a
 * player who has not learnt a glyph yet. The mark used to sit in front of it and step aside on
 * a narrow screen — it is on the launch screen's play button instead, where it is decoration
 * rather than a thing that has to shorten.
 *
 * It is also the way out: tapping the name leaves whatever is being played and goes back to the
 * levels, which is the convention every site on the web has taught, and the game had no other
 * way back until a run was over. A run walked out of this way is simply abandoned — it has no
 * score to keep, the same as one left by closing the tab.
 */
export function HeaderComponent(title: string, onTitleClick: () => void, endElements: (Node | string)[] = []): HTMLElement {
  return createElement({ cssClass: [styles.host, CssClass.EMPHASIS] }, [
    createElement({ cssClass: styles.title, text: title, onClick: onTitleClick }),
    createElement({ cssClass: styles.endElements }, endElements),
  ]);
}
