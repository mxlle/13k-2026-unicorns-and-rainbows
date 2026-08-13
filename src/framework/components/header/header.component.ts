import { createElement } from "../../../utils/html-utils";
import styles from "./header.module.scss";

export function HeaderComponent(title: string, endElements: (Node | string)[] = []): HTMLElement {
  return createElement({ cssClass: styles.host }, [
    createElement({ cssClass: styles.title }, [title]),
    createElement({ cssClass: styles.endElements }, endElements),
  ]);
}
