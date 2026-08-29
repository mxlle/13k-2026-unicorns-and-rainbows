import { getLocalStorageItem, LocalStorageKey, setLocalStorageItem } from "../utils/local-storage";

/**
 * The levels: one per rung of MAP_SIZES, and each of them one number. A board is fully
 * determined by its seed (see random-utils), so a curated level is nothing but the seed it is
 * built from — there is no level data in the bundle, and replaying one costs a call to
 * createGameMap rather than a snapshot.
 *
 * PLACEHOLDER seeds, picked with `npm run bot` over seeds 1-40 on every board. For each rung,
 * the seed whose score under the `mixed` bot sits closest to the median of the forty — a map
 * that is neither a gift nor a punishment, so the ladder climbs on the board getting bigger
 * rather than on the luck of the deal. On the three boards with an opponent, closeness of the
 * two sides' scores counts as well: a seed the rival runs away with, or one the player's corner
 * owns, is not a race whatever its median says. Small numbers because nothing needs them to be
 * large and short numbers cost less.
 *
 * The tutorial is the one picked against that rule. Its ceiling is 400 — two rainbows, two
 * unicorns, no cloud left — and half the seeds have no way to reach it: the second unicorn is
 * in the present, and a present without one in it caps the board at 176 whatever anybody does.
 * Level 1 is where the whole loop is taught, so it is a board where the loop can actually be
 * completed, and its bot score (384) is a target with something in it rather than a formality.
 *
 * **These are tied to the generation code.** Everything in createGameMap comes off the one
 * seeded generator in the order it is rolled, so adding, removing or reordering a roll builds
 * a different map from the same number — and the targets below, which were measured on these
 * maps, stop describing them. Re-run the bot and re-pick both lists when that happens.
 */
export const LEVEL_SEEDS = [10, 12, 8, 14, 11, 35, 16];

/**
 * What 100% is worth on each level: the score the `mixed` bot came out at on that exact seed.
 * So full marks is "play the board as well as the game's own opponent does" — a bar that means
 * the same thing on every rung and can be re-derived whenever the economy moves, from the same
 * bot, the same seed and the same command.
 */
export const LEVEL_TARGETS = [400, 960, 1092, 1512, 2565, 4180, 5952];

/**
 * A score as its share of the level's target, as a whole percent. It is what fills the level's
 * stripe on the launch screen and what closes the score panel at the end of a run.
 *
 * Not capped. 100% is the bot's own result and a fine place to stop, but a board played better
 * than that is the one number a player has to chase once the ladder has been climbed, and a
 * percentage that stops at full would quietly throw it away. The *bar* is capped — a stripe
 * cannot be more than full — which is the launch screen's business rather than this one's.
 */
export function getPercent(level: number, score: number): number {
  return ((score * 100) / LEVEL_TARGETS[level] + 0.5) | 0;
}

/**
 * The best score on a level's own board, per level, or 0 for one never finished. Runs on a
 * random seed are deliberately not in here: a level's percentage stands for the one board every
 * player gets, so a lucky deal cannot fill a stripe.
 *
 * Stored as one comma-joined list under one key rather than a key per level — the whole point
 * of the levels being an ordered ladder is that a list indexed by rung says everything.
 */
const getScores = () => (getLocalStorageItem(LocalStorageKey.SCORES) ?? "").split(",");

export function getBestScore(level: number): number {
  return +getScores()[level] || 0;
}

export function setBestScore(level: number, score: number) {
  if (score <= getBestScore(level)) return;

  const scores = getScores();
  scores[level] = `${score}`;
  // A level finished before an earlier one leaves holes behind it, and join writes a hole as
  // the empty string — which +"" reads straight back as the 0 it was.
  setLocalStorageItem(LocalStorageKey.SCORES, scores.join(","));
}
