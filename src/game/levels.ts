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
 * completed, which is what makes its ceiling a target worth setting (see LEVEL_TARGETS).
 *
 * **These are tied to the generation code.** Everything in createGameMap comes off the one
 * seeded generator in the order it is rolled, so adding, removing or reordering a roll builds
 * a different map from the same number — and the targets below, which were measured on these
 * maps, stop describing them. Re-run the bot and re-pick both lists when that happens.
 */
export const LEVEL_SEEDS = [10, 12, 8, 14, 11, 35, 16];

/**
 * What 100% is worth on each level: the best run played on that board. These started out as the
 * `mixed` bot's own scores and are now Almut's, which is a change of meaning as much as of
 * number — full marks is "as well as this board has ever been played" rather than "as well as
 * the game's opponent plays it", and the bar moves when somebody plays better.
 *
 * Level 1 is the exception and always will be: 400 is the board's ceiling — two rainbows, two
 * unicorns, no cloud left (see LEVEL_SEEDS) — so its 100% is perfection rather than a best.
 *
 * Where the bot now sits, which is the honest measure of how hard these are: 96% on the
 * tutorial, then 80 / 76 / 66 / 68 / 61 / 78. So from the 13x13 up, matching the bot is worth
 * about two thirds of a level, and the 21x21 is the steepest board on the ladder.
 *
 * **Updating one after a better run:** multiply the old target by the percentage the run came
 * out at. It pins exactly, and not by luck — the panel rounds the percentage to a whole number,
 * so a reading of p% puts the score inside a band half a percent wide either way, and getPercent
 * rounds by the same half percent. For any p at or above 100 the whole band comes back out as
 * 100%, whatever the score inside it actually was.
 *
 * The bot scores these replaced, for when the economy moves and the ladder has to be re-read:
 * 384, 960, 1092, 1512, 2565, 4180, 5952 — same seeds, `npm run bot -- --size=N --seed=S`.
 */
export const LEVEL_TARGETS = [400, 1200, 1441, 2283, 3796, 6897, 7619];

/**
 * A score as its share of the level's target, as a whole percent. It is what fills the level's
 * stripe on the launch screen and what closes the score panel at the end of a run.
 *
 * Not capped. 100% is the best run there has been and a fine place to stop, but a board played
 * better than that is the one number a player has to chase once the ladder has been climbed,
 * and a percentage that stops at full would quietly throw it away — it is also how the targets
 * above get updated. The *bar* is capped — a stripe cannot be more than full — which is the
 * launch screen's business rather than this one's.
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
