import { createElement } from "../../../utils/html-utils";
import { CssClass } from "../../../utils/css-class";
import styles from "./header.module.scss";

/**
 * The emoji is the header's identity — it stays at every screen size, the words do not.
 *
 * `emojiClass` is for whoever owns the emoji to say how it should look. The header takes any
 * glyph and has no business knowing that this game's one is a fountain that wants turning pink,
 * so the colour rides in from the call site rather than living in the header's own stylesheet.
 */
export function HeaderComponent(emoji: string, title: string, endElements: (Node | string)[] = [], emojiClass = ""): HTMLElement {
  return createElement({ cssClass: styles.host }, [
    createElement({ cssClass: styles.title }, [
      createElement({ tag: "span", cssClass: [CssClass.EMOJI, emojiClass], text: emoji }),
      createElement({ tag: "span", cssClass: styles.titleText, text: title }),
    ]),
    createElement({ cssClass: styles.endElements }, endElements),
  ]);
}
