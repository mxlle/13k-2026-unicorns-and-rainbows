import { defineEnum } from "./enums";

// Keep in sync with src/names.scss (SCSS uses the same names via #{$NAME})
export type CssClass = defineEnum<typeof CssClass>;
export const CssClass = defineEnum({
  PRIMARY: "global__primary",
  PRIMARY_HIGHLIGHT: "global__primary-highlight", // the loudest button on screen — rainbow, animated
  SECONDARY: "global__secondary",
  WON: "global__won",
  ICON_BTN: "global__icon-btn",
  HIDDEN: "global__hidden",
  EMOJI: "global__emoji",
  HINT: "global__hint", // pulses whatever the player should do next
});
