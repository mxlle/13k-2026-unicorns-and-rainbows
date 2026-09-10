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
 * tutorial, then 78 / 55 / 53 / 59 / 64 / 94. The 9x9 and the 13x13 are the steepest boards on
 * the ladder — the bot is barely past half of what has been got out of them — and the 25x25 is
 * the one board where it is nearly the best there has been.
 *
 * **Updating one after a better run:** multiply the old target by the percentage the run came
 * out at. It pins exactly, and not by luck — the panel rounds the percentage to a whole number,
 * so a reading of p% puts the score inside a band half a percent wide either way, and getPercent
 * rounds by the same half percent. For any p at or above 100 the whole band comes back out as
 * 100%, whatever the score inside it actually was.
 *
 * The bot's own scores on these boards are in BOT_MIN_SCORES / BOT_MAX_SCORES below, which
 * `npm run levels` re-measures. Read them whenever the economy moves and the ladder has to be
 * re-read: what the bot makes of a board is the one reading of it that does not need playing.
 */
export const LEVEL_TARGETS = [400, 1296, 1600, 2283, 3910, 6966, 9600];

/**
 * What the game's own opponent scores on each level, as the two ends of one band: the shipped
 * `mixed` bot on that exact board, with nothing varied but the seed its tie-breaks come off
 * (twenty of them, 1000-1019, via `npm run levels`). Both rows are runs the opponent really
 * had — the same bot on a bad day and on a good one — which is what makes them a pair rather
 * than a number and an error bar.
 *
 * **Nothing reads these yet.** They are here for the second score target — "beat the bot"
 * beside LEVEL_TARGETS' "beat the author" — and are deliberately unused until that lands. They
 * cost the bundle nothing while they are: both arrays tree-shake out, measured at no change to
 * the packed zip.
 *
 * The run a player actually faces is neither row: it is `mixed` seeded from the *map* seed,
 * which is what the game does (resetBot in game-map.component.ts) — 384, 1008, 880, 1204,
 * 2322, 4450, 9000. It sits near the bottom of the band on the 13x13 and the 21x21 and near
 * the top on the 25x25, because one seeded run is a fact about that seed and not about the bot.
 * Whichever row a target ends up reading, the number the player watches on screen on the three
 * boards with a rival is lower again — the dark side gives up the closing turn (see hasGo).
 *
 * MAX is a lower bound rather than a ceiling: twenty seeds is what was rolled, and rolling more
 * can only ever find a better run. Re-measure both when the economy moves.
 */
export const BOT_MIN_SCORES = [368, 936, 800, 960, 2187, 4230, 6111];
export const BOT_MAX_SCORES = [384, 1032, 1080, 1914, 3420, 6048, 9212];

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
