import { defineEnum } from "../../utils/enums";

/**
 * Every sound the game makes, by what it announces. The values index the sound list in
 * sound-control-box.ts, so keep the two in the same order.
 *
 * The first three double as other indices on purpose: DROPS and CANDY are the two currencies
 * (a payout landing in its counter, a present's loot arriving), and UNICORN is ChestLoot.UNICORN
 * — so a currency or a loot value *is* the sound it makes, and no lookup sits between them.
 *
 * On its own rather than in sound-control-box.ts so that vite.config.ts can import it for the
 * enum inlining without pulling the synth and the songs into the build config.
 */
export type SoundEffect = defineEnum<typeof SoundEffect>;
export const SoundEffect = defineEnum({
  DROPS: 0,
  CANDY: 1,
  UNICORN: 2,
  POP: 3,
  RAINBOW: 4,
  BUILD: 5,
  PORTAL: 6,
  WIN: 7,
  LOSE: 8,
});
