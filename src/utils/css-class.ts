import { defineEnum } from "./enums";

// Keep in sync with src/names.scss (SCSS uses the same names via #{$NAME})
export type CssClass = defineEnum<typeof CssClass>;
export const CssClass = defineEnum({
  PRIMARY: "global__primary",
  SECONDARY: "global__secondary",
  TERTIARY: "global__tertiary",
  WON: "global__won",
  ICON_BTN: "global__icon-btn",
  HIDDEN: "global__hidden",
  OPACITY_HIDDEN: "global__opacity_hidden",
  EMOJI: "global__emoji",
  ONE_LINER: "global__one_liner",
  HINT: "global__hint", // pulses whatever the player should do next
});
