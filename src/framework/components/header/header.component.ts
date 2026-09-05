import { createElement } from "../../../utils/html-utils";
import { CssClass } from "../../../utils/css-class";
import styles from "./header.module.scss";

/**
 * The game's name and whatever the screen lends the header, on one row. The title stays at
 * every width: it is the one place the game says what it is called, and words say that to a
 * player who has not learnt a glyph yet. The mark used to sit in front of it and step aside on
 * a narrow screen — it is on the launch screen's play button instead, where it is decoration
 * rather than a thing that has to shorten.
 */
export function HeaderComponent(title: string, endElements: (Node | string)[] = []): HTMLElement {
  return createElement({ cssClass: [styles.host, CssClass.EMPHASIS] }, [
    createElement({ cssClass: styles.title, text: title }),
    createElement({ cssClass: styles.endElements }, endElements),
  ]);
}
