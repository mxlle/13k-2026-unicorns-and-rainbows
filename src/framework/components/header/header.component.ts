import { createElement } from "../../../utils/html-utils";
import { CssClass } from "../../../utils/css-class";
import styles from "./header.module.scss";

/** The emoji is the header's identity — it stays at every screen size, the words do not. */
export function HeaderComponent(emoji: string, title: string, endElements: (Node | string)[] = []): HTMLElement {
  return createElement({ cssClass: styles.host }, [
    createElement({ cssClass: styles.title }, [
      createElement({ tag: "span", cssClass: CssClass.EMOJI, text: emoji }),
      createElement({ tag: "span", cssClass: styles.titleText, text: title }),
    ]),
    createElement({ cssClass: styles.endElements }, endElements),
  ]);
}
