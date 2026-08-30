import styles from "./game-map.module.scss";
import { createButton, createElement, createElements } from "../../utils/html-utils";
import { PubSubEvent, pubSubService } from "../../utils/pub-sub-service";
import { CssClass } from "../../utils/css-class";
import { HAS_DEV_TOOLS, HAS_GAMEPLAY_NICE_TO_HAVES, HAS_OPPONENT } from "../../env-utils";
import { getTranslation } from "../../translations/i18n";
import { TranslationKey } from "../../translations/translationKey";
import {
  BASE_INCOME,
  build,
  buyUnicorn,
  canBuild,
  canUsePortal,
  CHEST_CANDY,
  CHEST_DROPS,
  createGameMap,
  createSeed,
  GameMap,
  getIndex,
  endTurn,
  getBuild,
  getUnicornPrice,
  getExploration,
  getFeedingRainbows,
  getUnicornLevel,
  getMoveCost,
  getMoveTargets,
  getPortalTargets,
  getPosition,
  getRainbowDrops,
  getTile,
  getScore,
  getScoreParts,
  getSpawnTargets,
  hasFreeMove,
  HAS_RIVAL,
  hasGo,
  isRunOver,
  isSeen,
  MAP_SIZE,
  MAP_SIZES,
  moveCharacter,
  MOVE_COST,
  nextTurn,
  openChest,
  PORTAL_COST,
  Position,
  revealAround,
  TREE_COUNT,
  TURN_LIMIT,
  updateRainbows,
} from "../../game/game-map";
import { ChestLoot, GameObjectType, OBJECT_CONFIG, PLAYER, RIVAL, SIDE_BATHTUB, SIDE_UNICORN } from "../../game/game-objects";
import { getPercent, LEVEL_SEEDS, LEVEL_TARGETS, setBestScore } from "../../game/levels";
import {
  applyBotAction,
  BOT_STRATEGIES,
  BOT_STRATEGY_EMOJIS,
  BOT_STRATEGY_NAMES,
  BotActionKind,
  BotStrategy,
  getBotAction,
  resetBot,
} from "../../game/bot";

const FOG_EMOJI = "☁️";
const DROP_EMOJI = "💧";
const TURN_EMOJI = "⏳";
// The closing turn's own emoji: the same hourglass, run out. It is the whole "this is your
// last turn" signal, and being an emoji rather than a word it needs no translation and
// stays out of the end-turn button, which already carries three states of its own.
const LAST_TURN_EMOJI = "⌛";
const SCORE_EMOJI = "⭐";
// Labels the two zoom steps in the turn bar, the way every counter in the game is labelled by
// the thing it counts. Without it a bare − and + beside a clock read as something to do with
// the turns rather than with the board.
const ZOOM_EMOJI = "🔍";
// Stand-ins for the object emoji in the info panel, for the things that are not objects.
const HINT_EMOJI = "👆";
// How grown a unicorn is, one of these per level, after its name in the info panel. Sparkles
// rather than stars: ⭐ is the score's own glyph and would read as points.
const LEVEL_EMOJI = "✨";
// Not the seedling: that is the lollipop-tree build site now, and two different things in the
// info panel must not wear the same glyph.
const EMPTY_EMOJI = "🌾";
// Ground no longer under cloud, in the score breakdown: the cloud itself, standing for the
// ones cleared off the board rather than the ones still on it. Same glyph as the fog on the
// board, which is what ties the row to the thing it counts.
const EXPLORE_EMOJI = FOG_EMOJI;
const CANDY_EMOJI = "🍬";
// One per scoring category, in the order getScoreParts returns them: rainbows shining and
// unicorns found. Exploration is not in here — it is what each of the two is worth rather
// than a third of them, so the panel gives it a line of its own at the top.
const SCORE_EMOJIS = [OBJECT_CONFIG[GameObjectType.RAINBOW].emoji, OBJECT_CONFIG[GameObjectType.UNICORN].emoji];
// The same board again, on the button that starts it over.
const RETRY_EMOJI = "🔁";
// The level's target, in the row that says how near the run came to it. A target rather than a
// second ⭐: the score above it is already the star's own number, and this row is what that
// number was being measured against.
const TARGET_EMOJI = "🎯";
const WIN_EMOJI = "🎉";
// The ending that is no longer a celebration. Only reachable on a board with an opponent on
// it — without one there is nobody to come second to, and WIN_EMOJI is the only ending there is.
const LOSE_EMOJI = "🌑";
// PLACEHOLDER: the beat between two of the opponent's actions. Its whole turn is played out
// in front of the player rather than resolved in a flash, because a rival that simply
// teleports between turns is a number going up rather than somebody racing you — but a 25x25
// turn can be thirty actions long, so this is deliberately quicker than the dev bot's own
// step: fast enough that a turn passes in a couple of seconds, slow enough to see what moved.
const RIVAL_STEP_DELAY = 60;
const FIRST_TURN = 1; // the opening turn is the only one that hints "pick up a character"
// PLACEHOLDER zoom steps, as multiples of "the whole board fits in the view". Expressing
// them as multiples rather than tile sizes is what makes step 0 a true overview on any map
// size and any screen — a fixed tile size that suits a 9x9 phone board would leave a 20x20
// one unreadable, and one that suits 20x20 would waste the screen at 9x9.
const ZOOM_STEPS = [1, 1.5, 2.2, 3];
// PLACEHOLDER: the tile size a run wants to open at — big enough for the emoji to read and
// for a finger to hit. It picks the opening zoom step; see applyZoom.
const COMFORT_TILE = 32;
const MIN_TILE = 8; // a floor for the maths below, in case the map row is measured before it has a size
// PLACEHOLDER payout-flight timings. FLY_SPREAD is the window all departures share rather
// than a gap apiece: a big board can be paying out thirty times at once, and one emoji every
// FLY_STAGGER would take longer to watch than the turn took to play.
const FLY_DURATION = 500;
const FLY_STAGGER = 70;
const FLY_SPREAD = 400;
// The beat between the two currencies: the drops are all in the purse before the first sweet
// leaves its tree. It is dead time on top of the flights themselves, so it buys the two halves
// their separation at the price of a longer wait between turns.
const CURRENCY_GAP = 400;
// PLACEHOLDER: how far apart a candy beam's parallel lines sit, in tiles. One line per sweet
// the pairing pays (see renderBeams), so a fully grown tree draws three of them across the one
// tile between it and its rainbow — wide enough to count, narrow enough to still read as one
// feed rather than as three unrelated beams.
const BEAM_GAP = 0.16;
// PLACEHOLDER: the counter's reaction to an arrival — out and back, so the whole pop is
// twice this. Short enough that a stagger's worth of payments still reads as separate hits.
const POP_DURATION = 120;
const POP_SCALE = 1.35;
// The colour the drop counter takes while it is being spent from — the same pop as income,
// in the negative. A literal because a keyframe cannot read a stylesheet: keep it in step
// with theme.scss's $danger-color-contrast by hand.
const SPEND_COLOR = "#e06d80";
// The colour a counter takes when what it is worth goes *up* — the income growing, the score
// climbing. The mirror of SPEND_COLOR, and a literal for the same reason: a keyframe cannot
// read a stylesheet, so keep it in step with theme.scss's $success-color-light by hand.
const GAIN_COLOR = "#44aa77";
// PLACEHOLDER spend-feedback timings. One drop rises off the tile per drop paid, so a portal
// jump throws two and a free step over a flower throws none — the same "one glyph, one unit"
// the payout speaks in. The rise is in em, so it scales with the glyph rather than the zoom.
const SPEND_DURATION = 700;
const SPEND_STAGGER = 120;
// The window every departure shares, the same shape as FLY_SPREAD and for the same reason:
// a unicorn now costs one sweet per head of the herd, so an unbounded stagger would make a
// purchase take longer to watch the bigger the herd got.
const SPEND_SPREAD = 400;
const SPEND_RISE = 2.2;
// Every counter reaction is this same beat, whichever direction the money went.
const POP_OPTIONS: KeyframeAnimationOptions = { "duration": POP_DURATION, "direction": "alternate", "iterations": 2 };
// PLACEHOLDER: the beat between two actions while the dev bot is playing a run out by itself.
// Fast enough to watch a 25-turn run in under a minute, slow enough to follow what moved.
// It is also how often the timer looks to see whether the payout has finished, which is the
// one thing that makes it wait — see toggleAutoPlay.
const AUTO_STEP_DELAY = 120;

/**
 * Where an element sits on the screen, as its centre — a tile a glyph leaves from and a
 * counter it flies to are both aimed at by their middle.
 *
 * NOTE for everything below that animates: the keys of a keyframe and of an options object
 * are properties terser is free to rename, and `easing` and `iterations` are not on its list
 * of known browser names — they were silently mangled and quietly stopped working. Every key
 * handed to `animate` is therefore quoted, which is what `keep_quoted` protects.
 */
function centre(element: HTMLElement): number[] {
  const { x, y, width, height } = element.getBoundingClientRect();
  return [x + width / 2, y + height / 2];
}

/**
 * A glyph that flies and is gone: dropped on the page at `from`, animated to `keyframe`, and
 * taken off again when it lands. It is positioned by its centre — see the `translate` in the
 * stylesheet — so `from` is the middle of whatever it is leaving.
 */
function flyGlyph(emoji: string, [x, y]: number[], keyframe: Keyframe, options: KeyframeAnimationOptions, onLand?: () => void) {
  const element = createElement({ cssClass: [styles.fly, CssClass.EMOJI], text: emoji });

  element.style.left = `${x}px`;
  element.style.top = `${y}px`;
  document.body.append(element);

  // A single keyframe on purpose: the missing one is filled in from the element as it stands,
  // which is exactly where it starts. With no `fill`, a glyph waiting for its turn simply
  // sits where it was put until its delay is up.
  const animation = element.animate([keyframe], options);

  animation.onfinish = () => {
    element.remove();
    onLand?.();
  };
}

// The usual [host, update] tuple plus the controls that belong in the header — the status
// chip and the zoom steps. They are part of the run, so the game owns them; only their place
// in the DOM is elsewhere.
// `onExit` is the way back out to the launch screen, which is where a level is chosen: this
// component is handed one to play and never picks its own. The one board it deals for itself is
// the random one behind the 🎲, and that is the same level again rather than a different one.
export function GameMapComponent(
  onExit: () => void,
): [hostElement: HTMLElement, startNewGame: (level: number, random?: boolean) => void, headerControls: HTMLElement] {
  let map: GameMap;
  let isRunning = false;
  // Which rung of the ladder is being played, and whether it is being played on its own board.
  // Both are settled when the run starts and read again when it ends: the level says which
  // record a score belongs to and which target it is measured against, and the flag says
  // whether it counts at all — a random deal is the same size, not the same level.
  let level = 0;
  let isRandom = false;
  // The board on the screen, as the number it was built from. Kept because 🔁 is "this map
  // again" rather than "this level again": on a random deal (see startNewGame) those are two
  // different boards, and it is the one just played that a second go is worth anything on.
  let seed = 0;
  // Two-tap navigation: tap an object to select it, then — if it is a character that
  // can afford a step — tap one of its highlighted neighbours to move there.
  let selected: Position | undefined;
  let targets: Position[] = [];
  // The far donuts, when the selection is a character standing on one of them. They are part
  // of `targets` and lit exactly like a step, so a jump is the same two taps as a walk — the
  // second tap simply lands across the board. Kept as a list of their own all the same,
  // because that second tap has to know it is paying the portal's price rather than a step's.
  let portalTargets: Position[] = [];
  // Whether the selection is a bathtub. A tub lights the fields it can put a unicorn on in
  // exactly the way a character lights the tiles it can step onto, so the second tap has to
  // know which of the two it is finishing: a step, or a purchase.
  let isTubSelected = false;
  // The build site the selection is sitting on, if it is one. Like the tub, a site blocks
  // movement, so nothing can be standing on it and this can never be true at the same time as
  // isCharacter — the three kinds of selection stay cleanly apart.
  let buildSite: Position | undefined;
  // The turn is being paid out: income is in the air and the purse has not been credited
  // yet. The board is locked for as long as it lasts — a step taken mid-flight would change
  // the very income the player is watching arrive.
  let isPaying = false;
  // The opponent is taking its turn. Like isPaying it locks the board, and for a related
  // reason: what the player would be acting on is being changed under them, a step at a time.
  // Kept apart from isPaying rather than folded into it because they end differently — the
  // payout ends in the turn counter moving on, the rival's turn ends in the player's starting.
  let isRivalTurn = false;
  // The timer driving it, so that leaving the board can stop the rival mid-stride. Nothing in
  // the interface can reach the launch screen while the board is locked, so this cannot happen
  // today — but a rival still walking about on a map that has been replaced underneath it is a
  // bad enough failure to be worth one variable.
  let rivalTimer: number | undefined;
  // The tile the rival is acting on, ringed while it acts so the change on the board has a source
  // the eye can find. Held as the element rather than an index because it has to outlive a
  // render: nothing in render() touches this class, so the ring moves with the rival a step at a
  // time instead of being worked out again for every tile on every repaint.
  let rivalMark: HTMLElement | undefined;
  // The score's working is open: the breakdown that ends a run, shown mid-run on demand.
  // It holds the info panel until it is closed or a tile takes the panel over.
  let showsScore = false;
  // Dev-only (see createFogButton): the fog switched off, for looking at how a board actually
  // came out. Purely a way of drawing — the model's isRevealed is untouched, so the score, the
  // income, the rainbows and what can be picked up all behave exactly as they would with the
  // clouds on. Which is the point: it shows you the board without perturbing the run. The one
  // seam is that a tile the game still counts as fogged reads as "Cloud" in the info panel
  // even while you can see what is on it — the panel is telling the truth, not the board.
  let xray = false;
  // Dev-only (see createBotControls): the one thing outside the bot's own corner that has to
  // know it exists — render() calls this to put its buttons in and out of reach, exactly as
  // it does the end-turn button. Declared without a value so that nothing in the bot is so
  // much as named outside HAS_DEV_TOOLS.
  let updateBotControls: (() => void) | undefined;

  /**
   * Whether the board is out of the player's hands for the moment — the income is in the air,
   * or the opponent is taking its turn. Every guard that used to read isPaying reads this, so
   * a new reason to lock the board is added in one place rather than at each of them.
   */
  const isLocked = () => isPaying || isRivalTurn;

  // Two stacked glyph layers per tile, mirroring the two layers of the model: the ground
  // first, the character standing on it painted over it (later sibling, same grid cell).
  // A character therefore never hides what it stands on — the donut under a unicorn still
  // shows. Glyphs live in spans of their own so one can be transformed on its own — the
  // lollipop tree is drawn tilted and gets stood upright — without turning the tile's
  // background, its selection ring, or the grid cell with it.
  // Rebuilt whenever the board changes size — there is one element per tile, so these are
  // the only part of the interface that cannot outlive a different map.
  let groundGlyphs: HTMLElement[] = [];
  let livingGlyphs: HTMLElement[] = [];
  let tileElements: HTMLElement[] = [];

  // Light beams live in their own layer above the tiles: a tile can carry several at
  // once (the sun's does), which a per-tile pseudo-element could not draw.
  const beamLayer = createElement({ cssClass: styles.beams });
  // one delegated listener instead of one per tile — and it survives the tiles being
  // replaced, which is the reason the listener is on the board rather than on them
  const board = createElement({ cssClass: styles.board, onClick: (event) => onTileClick(tileElements.indexOf(event.target)) }, [beamLayer]);

  function buildBoard() {
    groundGlyphs = createElements({ tag: "span" }, MAP_SIZE * MAP_SIZE);
    // The whole layer is drawn up: everything that can ever stand on a tile is an actor, and
    // an actor is what the player is looking for. Set once here rather than per render,
    // because nothing about it depends on what is on the tile.
    livingGlyphs = createElements({ tag: "span", cssClass: styles.character }, MAP_SIZE * MAP_SIZE);
    tileElements = groundGlyphs.map((ground, index) =>
      createElement({ cssClass: [styles.tile, CssClass.EMOJI] }, [ground, livingGlyphs[index]]),
    );
    // beam layer first: the tiles are positioned too, so they paint over it and an emoji
    // is never hidden by the light passing through it
    board.replaceChildren(beamLayer, ...tileElements);
    board.style.setProperty("--s", String(MAP_SIZE)); // keeps MAP_SIZE the single source of truth
  }

  // PLACEHOLDER turn bar: turn count on the left, end-turn button on the right.
  // Only the emoji gets the emoji font — digits inside it would render as emoji glyphs too.
  const turnCounter = createElement({ tag: "span" });
  const dropCount = createElement({ tag: "span" });
  const candyCount = createElement({ tag: "span" });
  const scoreCount = createElement({ tag: "span" });
  // A counter is tappable only when it has somewhere to lead: the extra class is what says so.
  const counter = (emoji: string, value: HTMLElement, onClick?: () => void) =>
    createElement({ cssClass: [styles.count, onClick ? styles.tappable : ""], onClick }, [
      createElement({ tag: "span", cssClass: CssClass.EMOJI, text: emoji }),
      value,
    ]);
  // One button for both ends of a run: end the turn while playing, back to the launch screen
  // once it is over. Which board to play next is that screen's question, not this bar's —
  // there are seven of them now, and they are the stripes of the rainbow over there.
  const endTurnButton = createButton({ onClick: () => (isRunning ? finishTurn() : onExit()) });
  // The board just played, from the top: the same map, the same opening, the same seed. What
  // ends a run is a plan running out of turns, and the second go at a plan is where the first
  // one is worth anything.
  //
  // It lives in the result panel, on a line of its own under the score's working, rather than
  // in the turn bar beside the way out. The bar is a row of things that cannot wrap — the zoom
  // steps, the clock, the button — and a fourth control in it pushed the way out off the edge
  // of a narrow phone. The panel is the one part of the screen that is already growing to fit
  // what a finished run has to say, so a button that only exists after a run belongs in it.
  const retryButton = createButton({ cssClass: [CssClass.SECONDARY, styles.retry], onClick: () => startRun(seed) }, [
    createElement({ tag: "span", cssClass: CssClass.EMOJI, text: RETRY_EMOJI }),
    ` ${getTranslation(TranslationKey.RETRY)}`,
  ]);
  // How far through the turns, next to the button that spends them. It is the one number that
  // stayed down here when the scores went up to the chip: the clock and the thing that moves
  // the clock on belong together, and the turn bar is otherwise all controls.
  const turnDisplay = counter(TURN_EMOJI, turnCounter);
  // Reached for through counter() rather than built by hand, so every counter in the bar is
  // still made the same way: the emoji span is always the first child of the row.
  const turnEmoji = turnDisplay.firstChild!;
  // The score opens its own working: the same breakdown that closes a run, on demand while
  // it is still being played, so "where are my points coming from" is answerable in time to
  // act on the answer rather than only afterwards.
  const scoreDisplay = counter(SCORE_EMOJI, scoreCount, toggleScore);
  // What the bar last showed, so a render can tell a number that moved from one that did not.
  // The two incomes by currency, then the score — seeded by render() itself on the first pass
  // of a run (see newRun), so opening a board is not a flurry of pops for numbers that were
  // never anything else.
  let lastIncome: number[] = [];
  let lastScore = 0;
  let newRun = true;
  // The opponent's score, live beside the player's own. It is the whole reason to have a rival
  // rather than a par to beat: being able to see the gap while there are still turns left to
  // close it. Its face is the dark unicorn rather than a second star, so which number belongs
  // to whom needs no explaining — and the inverted glyph is the same one on the board.
  // Built unconditionally and hidden by render() on boards without an opponent: it costs a
  // handful of bytes and the whole bar is laid out once.
  // Built by a function rather than inline, the same trick createFogButton uses: once
  // HAS_OPPONENT folds to false the whole thing is an uncalled declaration and goes out with
  // the tree-shaking, where a `const` would still run its createElement in every build.
  const rivalScoreCount = createElement({ tag: "span" });

  function createRivalScore(): HTMLElement {
    const display = counter(OBJECT_CONFIG[GameObjectType.DARK_UNICORN].emoji, rivalScoreCount);
    (display.firstChild as HTMLElement).classList.add(styles.dark);

    return display;
  }

  const rivalScoreDisplay = HAS_OPPONENT ? createRivalScore() : rivalScoreCount;

  // What the end-turn button wears while the rival is on the board — see render(). An element
  // rather than text so it can carry the inverted unicorn the rest of the interface already means
  // "the rival" by, and built through a function for the same reason createRivalScore is: with
  // HAS_OPPONENT folded away this is an uncalled declaration and goes out with the tree-shaking.
  function createRivalGlyph(): HTMLElement {
    return createElement({
      tag: "span",
      cssClass: [CssClass.EMOJI, styles.dark],
      text: OBJECT_CONFIG[GameObjectType.DARK_UNICORN].emoji,
    });
  }

  const rivalTurnGlyph = HAS_OPPONENT ? createRivalGlyph() : undefined;
  // Everything the run counts in one chip in the middle of the header, in view wherever the
  // player is looking. The two currencies read "what you have (+what the board pays you next
  // turn)", so the cost of a plan and the income funding it are side by side; the two scores
  // follow them, so what the race stands at is read in the same glance as what it costs to
  // change it. Nothing here is pressable except the score, which opens its own working.
  //
  // The scores used to sit in the turn bar, because three "n (+n)" counters in a row overflowed
  // the header on a phone. Neither score carries an income, so these two are short — and the
  // chip now takes a line of its own below the title row on a narrow screen (see .status),
  // which is the room that made this possible. What is left in the bar is the things you press.
  // Kept as elements of their own, not just built inline: they are what the income flies to
  // and what pops when it lands, and both need the whole counter — emoji and number — rather
  // than the number alone. Indexed by currency, which is what flyIncome sorts its flights by.
  const currencyDisplays = [counter(DROP_EMOJI, dropCount), counter(CANDY_EMOJI, candyCount)];
  // The "(+n)" half, as an element of its own rather than more text in the number beside it.
  // Two signals were landing on the one counter and the later one won: a step that costs a
  // drop *and* lines up a rainbow would flash the spend's red over the income's green —
  // precisely the move the green is there to teach. Split, they never overlap: the number you
  // have reacts to money moving, the rate beside it reacts to the rate changing.
  // It is the better reading anyway. What you hold and what the board pays you are two
  // different facts, and they now look like two.
  const currencyIncomes = [createElement({ tag: "span" }), createElement({ tag: "span" })];
  const currencyValues = [dropCount, candyCount];
  currencyDisplays.forEach((display, currency) => display.append(currencyIncomes[currency]));
  const status = createElement({ cssClass: styles.status }, [
    ...currencyDisplays,
    scoreDisplay,
    ...(HAS_OPPONENT ? [rivalScoreDisplay] : []),
  ]);

  // Object info: a permanent row of its own between map and turn bar, so it can never
  // cover the board and never shifts it either. Empty selection shows a hint instead.
  // Spans, not divs: emoji, name and description flow as one wrapping line of text.
  const infoEmoji = createElement({ tag: "span", cssClass: [styles.infoEmoji, CssClass.EMOJI] });
  const infoName = createElement({ tag: "span", cssClass: styles.infoName });
  const infoText = createElement({ tag: "span" });
  // The build action, offered on the site itself: an action on the board turns up where the
  // thing it acts on is being explained. Its face is filled in by renderBuildButton: what the
  // site becomes and what that costs, which is why it carries no text of its own.
  // The portal used to have a button of its own beside it. It has not needed one since the
  // far donuts became tiles to tap: the board can say "here, and here, and here", which no
  // one button ever could.
  const buildButton = createButton({ cssClass: [CssClass.SECONDARY, styles.action], onClick: raise });
  // The end-of-run breakdown, one line per scoring category, stacked under the result line.
  // Empty while the run is on, and CSS hides it then, so it takes no room until it has any.
  const scoreBoard = createElement({ cssClass: styles.scoreBoard });
  const infoPanel = createElement({ cssClass: styles.info }, [createElement({}, [infoEmoji, infoName, infoText, buildButton]), scoreBoard]);

  // The board takes its size from the map and the zoom step; this row scrolls to reach the
  // parts of it that do not fit. Panning is the browser's own scrolling — which brings touch
  // momentum, trackpad gestures and keyboard scrolling along for nothing.
  const mapArea = createElement({ cssClass: styles.mapArea }, [board]);
  const zoomOutButton = createButton({ cssClass: CssClass.ICON_BTN, onClick: () => zoom(-1) }, ["−"]);
  const zoomInButton = createButton({ cssClass: CssClass.ICON_BTN, onClick: () => zoom(1) }, ["+"]);

  /**
   * Dev-only: the switch that takes the clouds off, for checking how a board actually came
   * out. Built by a function rather than inline so that it is nothing but an uncalled
   * declaration once HAS_DEV_TOOLS folds to false — a `const` here would still run its
   * createButton in every build.
   */
  function createFogButton(): HTMLElement {
    const button = createButton(
      {
        cssClass: CssClass.ICON_BTN,
        onClick: () => {
          xray = !xray;
          button.classList.toggle(CssClass.PRIMARY, xray); // lit while the fog is off
          render();
        },
      },
      [createElement({ tag: "span", cssClass: CssClass.EMOJI, text: FOG_EMOJI })],
    );

    return button;
  }

  /**
   * Dev-only: the bot's controls — which bot is playing, one action from it, and the rest of
   * the run at once. It is for balancing rather than for playing: a run driven by a bot with
   * a stated policy is a reading of what the board is worth to *that* policy, and four of
   * them side by side on the same seed say more about the numbers than any amount of playing
   * it by hand. For the same four bots over a hundred runs, see `npm run bot`.
   *
   * Everything the bot needs lives in here, the strategy included, so that the whole thing
   * is one uncalled declaration once HAS_DEV_TOOLS folds to false — see createFogButton.
   *
   * Stepping is the interesting one: which action came next and what the bot thought it was
   * worth is the whole reason to watch a bot at all, and both are gone if the run plays
   * itself. Playing it out is for the other question — what the board comes to in the end —
   * and it is the same actions at the same speed, just without a finger on the button. Either
   * way the working goes to the console, which is where a run is read back afterwards.
   */
  function createBotControls(): HTMLElement[] {
    let botStrategy: BotStrategy = BotStrategy.MIXED;
    let autoTimer: number | undefined; // the run playing itself; undefined while it is not

    const face = createElement({ tag: "span", cssClass: CssClass.EMOJI });
    // One button cycling the four rather than four buttons: the dev corner is already three
    // controls wide, and which bot is playing is exactly what its face says.
    const strategyButton = createButton(
      {
        cssClass: CssClass.ICON_BTN,
        onClick: () => setStrategy(BOT_STRATEGIES[(BOT_STRATEGIES.indexOf(botStrategy) + 1) % BOT_STRATEGIES.length]),
      },
      [face],
    );

    function setStrategy(strategy: BotStrategy) {
      botStrategy = strategy;
      face.textContent = BOT_STRATEGY_EMOJIS[strategy];
      strategyButton.title = `bot: ${BOT_STRATEGY_NAMES[strategy]}`;
    }

    /**
     * One action from the bot, carried out through exactly the paths a tap goes through —
     * select, then move / buy / raise / end the turn. So the bot can only ever do what a
     * player could have done, the animations and sounds are the ones a human run produces,
     * and there is no second implementation of the rules to drift out of step with these.
     */
    function stepBot() {
      // Always the player's side: this is the bot standing in for the person at the keyboard,
      // and the opponent — which is the same code on the other side — plays its own turn
      // through playRivalTurn without any of these buttons.
      const action = isRunning && !isLocked() ? getBotAction(map, botStrategy, PLAYER) : undefined;

      if (!action) return;

      console.log(
        `🤖 ${BOT_STRATEGY_NAMES[botStrategy]} · turn ${map.turn}/${TURN_LIMIT} · ${map.drops[PLAYER]}💧 ${map.candy[PLAYER]}🍬 · ` +
          `${getScore(map, PLAYER)}⭐ (${getExploration(map, PLAYER)}% seen) → ${action.label} [${Math.round(action.value)}]`,
      );

      if (action.kind === BotActionKind.END_TURN) return finishTurn();

      select(action.from); // the actions below all read the selection, exactly as the taps do
      if (action.kind === BotActionKind.BUY) buy(action.to!);
      else if (action.kind === BotActionKind.BUILD) raise();
      // a jump is a move at the portal's price; undefined lets a plain step price itself
      else move(action.to!, action.kind === BotActionKind.PORTAL ? PORTAL_COST : undefined);
    }

    /**
     * The rest of the run, played by itself: the same stepBot on a timer, which is what keeps
     * the two buttons honest — watching a run and reading its final score are the same run.
     *
     * A timer that polls rather than a chain that schedules itself, because the thing it has
     * to wait for is the payout flight, and how long that takes is the board's business
     * rather than the bot's. A tick while the income is in the air simply does nothing and
     * comes round again. It stops itself the moment the run is over, so nothing has to
     * remember to switch it off — leaving the board or starting another one cannot leave a
     * bot running behind it.
     */
    function toggleAutoPlay() {
      if (autoTimer) {
        clearInterval(autoTimer);
        autoTimer = undefined;
      } else {
        autoTimer = setInterval(() => {
          if (isLocked()) return; // the board is paying out or the rival is moving; nothing to decide yet
          if (isRunning) stepBot();
          else toggleAutoPlay(); // the run is over — and this is the one call that stops it
        }, AUTO_STEP_DELAY);
      }

      updateBotControls!();
    }

    setStrategy(botStrategy);
    const stepButton = createButton({ cssClass: CssClass.ICON_BTN, onClick: stepBot }, ["▶"]);
    const playButton = createButton({ cssClass: CssClass.ICON_BTN, onClick: toggleAutoPlay }, ["⏩"]);
    stepButton.title = "one bot action";
    playButton.title = "play the rest of the run";

    // The bot's own bit of render(): the two buttons are out of reach for the same reasons
    // the end-turn button is, and the play button is lit while it is the one driving.
    updateBotControls = () => {
      stepButton.disabled = isLocked() || !isRunning;
      playButton.disabled = !isRunning;
      playButton.classList.toggle(CssClass.PRIMARY, !!autoTimer);
    };

    return [strategyButton, stepButton, playButton];
  }

  // Everything the run puts in the header, as one thing to hand over and one thing to hide
  // between runs. It used to float over the top-right of the map row, which read as free
  // real estate and was not: at the opening zoom step the board fits the row exactly, so
  // there is nothing to scroll, and on a portrait screen the buttons sat on top of the
  // corner tiles with no way to pan out from under them. The header costs the board nothing
  // and cannot overlap it at any size.
  // `display: contents`, so the pieces are laid out by the header's own row rather than
  // nesting a second flex box inside it — the chip still centres itself on the header, and
  // the buttons still take the header's gap. Hiding the wrapper hides all of them, which is
  // what the launch screen wants: none of it means anything before a run.
  const headerControls = createElement({ cssClass: styles.headerControls }, [
    status,
    ...(HAS_DEV_TOOLS ? [createFogButton(), ...createBotControls()] : []),
  ]);
  // Built here rather than up with its counters, because it holds the zoom steps and they have
  // to exist first. They are controls for the board and now sit under it with the other one —
  // the header is what the run counts, this is what the player presses.
  // The board's own controls lead, labelled by what they act on, and the clock follows them on
  // its way to the button that moves it on.
  const turnBar = createElement({ cssClass: styles.turnBar }, [
    createElement({ tag: "span", cssClass: CssClass.EMOJI, text: ZOOM_EMOJI }),
    zoomOutButton,
    zoomInButton,
    turnDisplay,
    endTurnButton,
  ]);
  const hostElement = createElement({ cssClass: styles.host }, [mapArea, infoPanel, turnBar]);

  let zoomIndex = 0;

  /**
   * Turns the current zoom step into a tile size. Everything else — the board's width, the
   * emoji size, the beams — is derived from --tile in the stylesheet, so this one property
   * is the whole zoom. Measured against the shorter side of the map row so that step 0 fits
   * whichever way the screen is turned, less one pixel per column for the grid lines.
   *
   * `reset` picks the opening step as well: the first one whose tiles are big enough to read
   * and to hit, which on a small map is the overview itself and on a big one is a few steps
   * in. That is what lets one setting suit a 9x9 and a 20x20 board — a fixed starting step
   * would either scroll a small map for no reason or open a large one unreadably small.
   */
  function applyZoom(reset = false) {
    const fit = Math.max((Math.min(mapArea.clientWidth, mapArea.clientHeight) - MAP_SIZE) / MAP_SIZE, MIN_TILE);

    if (reset) {
      const readable = ZOOM_STEPS.findIndex((step) => fit * step >= COMFORT_TILE);
      zoomIndex = readable < 0 ? ZOOM_STEPS.length - 1 : readable;
    }

    board.style.setProperty("--tile", `${fit * ZOOM_STEPS[zoomIndex]}px`);
    zoomOutButton.disabled = !zoomIndex;
    zoomInButton.disabled = zoomIndex === ZOOM_STEPS.length - 1;
  }

  /** Steps the zoom, keeping whatever was in the middle of the view in the middle of it. */
  function zoom(direction: number) {
    const next = Math.min(ZOOM_STEPS.length - 1, Math.max(0, zoomIndex + direction));
    if (next === zoomIndex) return;

    // measured before the board resizes under it, or the old centre is already gone
    const { scrollLeft, scrollTop, clientWidth, clientHeight } = mapArea;
    const ratio = ZOOM_STEPS[next] / ZOOM_STEPS[zoomIndex];
    zoomIndex = next;
    applyZoom();
    mapArea.scrollLeft = (scrollLeft + clientWidth / 2) * ratio - clientWidth / 2;
    mapArea.scrollTop = (scrollTop + clientHeight / 2) * ratio - clientHeight / 2;
  }

  // A turned phone changes what "fits" means, and every step is defined against it. Wrapped
  // rather than passed directly: the handler's Event argument would land in `reset`.
  addEventListener("resize", () => applyZoom());

  function render() {
    const selectedIndex = selected && getIndex(selected);
    const targetIndices = targets.map(getIndex);
    // A step onto a flower costs nothing, and the purse is the only place that would
    // otherwise say so — after the fact. These get a highlight of their own instead.
    // A tub's fields are never free — they cost candy — so they keep the plain target ring
    // even when the flower under one of them would have made the step itself free.
    const freeIndices = isTubSelected ? [] : targets.filter((target) => !getMoveCost(map, target, PLAYER)).map(getIndex);
    // The far donuts, which are lit like steps and priced like nothing else — see move()
    const portalIndices = portalTargets.map(getIndex);
    // What every lit tile costs, written on the tile. The tub's fields have always carried
    // their price this way and it was the one offer on the board that did — a step's cost was
    // only ever findable in the purse, after the step. Now the board states the price of
    // whatever it is offering, in one language: the tub's fields in sweets, a step and a jump
    // in drops, and a free step says so by staying green with nothing written on it.
    // The tub's own price is the one that moves — it is the size of the herd, so it goes up
    // with every unicorn bought, which is exactly why it is worth writing on the field rather
    // than leaving it to an info text that would be read once and remembered wrong.
    // Both prices are the same on every tile of their kind, so they are built once per render
    // rather than per tile; only the jump differs, and only on the donuts.
    // Signed, because a bare number on a tile reads as something the tile is worth rather than
    // something it takes: every one of these is money leaving the purse. The same − the zoom
    // step out wears, so the two are one character rather than two lookalikes.
    const priceTag = isTubSelected ? `−${getUnicornPrice(map, PLAYER)}${CANDY_EMOJI}` : `−${MOVE_COST}${DROP_EMOJI}`;
    const jumpTag = `−${PORTAL_COST}${DROP_EMOJI}`;
    // Guidance: an empty purse makes the income the only way on, so ending the turn
    // becomes the next step. Before that, on the opening turn, it is picking a character.
    // Once the run is over the same button is the only thing left to press.
    // The two signals on that button are deliberately split. Colour goes on as soon as the
    // purse is empty — ending the turn is the way on from there, whether or not a free step
    // over a flower is still available. The pulse waits for the stricter case, when there
    // is genuinely nothing else left to do, so it never nags a player who can still act.
    const outOfWater = map.drops[PLAYER] < MOVE_COST;
    const needsIncome = outOfWater && !hasFreeMove(map, PLAYER);
    const isOver = !isRunning;
    const hintCharacters = !isOver && !needsIncome && !selected && map.turn === FIRST_TURN;
    // Which tiles are actually turning light into a rainbow this turn. Read off the beams the
    // model already worked out, so the halo can never promise a rainbow that is not there —
    // the same guarantee getFeedingRainbows gives the trees. A beam is stamped with the tile
    // it *leaves from*, and only the light kind is ever lit, so no isCandy check is needed.
    // Gathered once per render rather than searched per tile: it is a handful of entries.
    // Filtered by what the player can see for the same reason the beams themselves are — see
    // showsBeam. Without it a cloud hiding an opponent's unicorn wears that unicorn's halo.
    const shining = new Set(map.beams.filter((beam) => beam.isLit && showsBeam(beam)).map(getIndex));

    map.tiles.forEach((tile, index) => {
      const element = tileElements[index];
      const isSelectedTile = index === selectedIndex;
      // The invitation to buy: the tub itself pulses, and only while the purchase is really
      // on — the jar can pay and there is somewhere to put the unicorn. It is the one
      // affordance nothing else on the board hints at, so it says so where it happens.
      // Short-circuited on the object check: getSpawnTargets must not run for every tile.
      // The player's own tub only: the opponent's sells to the opponent, and pulsing it would
      // be inviting the player to press something that offers them nothing.
      const canSpawn = tile.object === GameObjectType.BATHTUB && !!getSpawnTargets(map, getPosition(index)).length;
      // A site that can be raised right now pulses for the same reason a tub that can spawn
      // does: it is an affordance nothing else on the board hints at, so it says so where it
      // happens. Short-circuited on getBuild, so canBuild runs only on the handful of sites.
      const canRaiseHere = !!getBuild(tile.object) && canBuild(map, getPosition(index), PLAYER);
      // What the tile *shows*, as opposed to what the game has revealed to the player — the
      // two are the same for everyone but a developer who has switched the clouds off. It is
      // the player's own fog throughout: the opponent's is never drawn, and the only thing
      // that gives away where the rival has been is the rival itself, once seen.
      const isFound = isSeen(tile, PLAYER);
      const isVisible = isFound || (HAS_DEV_TOOLS && xray);
      // Either side's tub: the same piece of furniture, drawn at the same size, and — see the
      // glow below — earning for whoever owns it every turn it stands.
      const isTub = isVisible && SIDE_BATHTUB.includes(tile.object!);
      element.classList.toggle(styles.revealed, isVisible);
      // The halo means "this one is producing", not "this one is a light source" — every
      // unicorn is the latter, so it used to say nothing the glyph did not already say. A
      // unicorn with no halo is one whose walk is still ahead of it, and it keeps its full
      // colour and size on purpose: it is the one the player is being asked to move.
      // A tub pays BASE_INCOME every turn it stands, so it is producing whenever it is on the
      // board — the third producer, and the one that used to wear nothing while the unicorns
      // haloed and the trees glowed pink. Sunlight rather than candy pink, because that is
      // what the glow already sorts by: light and water on one side, sweets on the other.
      // Either side's, exactly as a visible rival unicorn haloes: the glow says "this is
      // earning", not "this is yours".
      element.classList.toggle(styles.glowing, shining.has(index) || isTub);
      element.classList.toggle(
        CssClass.HINT,
        canSpawn || canRaiseHere || (hintCharacters && isSeen(tile, PLAYER) && tile.living === GameObjectType.UNICORN),
      );
      element.classList.toggle(styles.selected, isSelectedTile);
      // no steps lit means the selection is only being looked at — see select()
      element.classList.toggle(styles.neutral, isSelectedTile && !targets.length);
      element.classList.toggle(styles.target, targetIndices.includes(index));
      element.classList.toggle(styles.free, freeIndices.includes(index));
      // Only the lit tiles are written on, and only they read it — a stale tag on a tile that
      // has stopped being a target is a property nothing draws.
      if (targetIndices.includes(index)) element.style.setProperty("--p", `"${portalIndices.includes(index) ? jumpTag : priceTag}"`);

      // The fog belongs to the ground layer: under it there is nothing else to show.
      const hasLiving = isVisible && tile.living !== undefined;
      const ground = groundGlyphs[index];
      // guarded on isVisible, or the fog cloud hiding a tree would be turned instead
      ground.classList.toggle(styles.tree, isVisible && tile.object === GameObjectType.TREE);
      // a site is drawn back from the things that are actually there — see .site
      ground.classList.toggle(styles.site, isVisible && !!getBuild(tile.object));
      // Size as a way of sorting the meadow: a tub is where unicorns come from and is drawn
      // up with them, the flowers are ground cover and are drawn down. Guarded on isVisible for
      // the same reason .tree is — an unrevealed tile is a cloud, not the thing under it.
      // Either side's tub, since both are the same piece of furniture at the same size.
      ground.classList.toggle(styles.big, isTub);
      ground.classList.toggle(styles.small, isVisible && tile.object === GameObjectType.FLOWER);
      // which trees are paying into the player's jar this turn — read off the same list the
      // income itself is counted from, so the glow can never promise candy that never comes.
      // The player's own light only: a tree earning off the rival's rainbow is earning for the
      // rival, and lighting it up here would be crediting the player with somebody else's sweets.
      ground.classList.toggle(styles.earning, !!getFeedingRainbows(map, getPosition(index), PLAYER).length);
      ground.classList.toggle(styles.covered, hasLiving); // out of the way, into the corner
      // The opponent's things are drawn as the negative of the player's — see .dark. Both
      // layers can carry one: a dark rainbow on the ground, a dark unicorn standing on it.
      // Behind the flag rather than behind isDark alone: with no opponent every tile would
      // still be paying for two classList.toggle calls that can never do anything.
      if (HAS_OPPONENT) {
        ground.classList.toggle(styles.dark, isVisible && isDark(tile.object));
        livingGlyphs[index].classList.toggle(styles.dark, hasLiving && isDark(tile.living));
      }

      ground.textContent = isVisible ? (tile.object === undefined ? "" : OBJECT_CONFIG[tile.object].emoji) : FOG_EMOJI;
      livingGlyphs[index].textContent = hasLiving ? OBJECT_CONFIG[tile.living!].emoji : "";
      // How grown it is, handed to the stylesheet to draw it at: a unicorn that has been
      // shining stands taller than the newcomer beside it, which is the level said in the one
      // place the player is already looking. Only worth writing when somebody is home — an
      // empty layer draws nothing whatever size it is set to.
      if (hasLiving) livingGlyphs[index].style.setProperty("--l", `${getUnicornLevel(tile)}`);
    });

    // Each currency reads "what you have (+what next turn pays)". The income half updates as
    // the player moves, so the cost of rearranging the board and its effect on next turn's
    // takings are visible in the same glance.
    turnCounter.textContent = `${Math.min(map.turn, TURN_LIMIT)}/${TURN_LIMIT}`;
    // The closing turn, said twice over: the sand runs out and the whole counter goes
    // warning-coloured. A warning while the turn is being planned, which is when it can
    // still change what the player spends on.
    const isLastTurn = map.turn >= TURN_LIMIT;
    turnEmoji.textContent = isLastTurn ? LAST_TURN_EMOJI : TURN_EMOJI;
    turnDisplay.classList.toggle(styles.lastTurn, isLastTurn);
    dropCount.textContent = `${map.drops[PLAYER]}`;
    candyCount.textContent = `${map.candy[PLAYER]}`;
    // What the board will pay next turn, reacting when it moves. It is the one number in the
    // game that used to change in silence, and it is the change the whole game turns on: a
    // unicorn steps into 🦄⛲🌈 and the income goes up, steps out and it goes down. Everything
    // else here already announces itself with this pop, so the lesson is taught in a language
    // the player has been reading since their first step.
    //
    // Both directions, and green or red says which: the rival taking a fountain off you costs
    // you income exactly as walking away from one does, and neither should pass unremarked.
    const income = [map.dropIncome[PLAYER], map.candyIncome[PLAYER]];
    income.forEach((value, currency) => {
      // A no-break space: the halves are inline-blocks now (so each can pop on its own), and an
      // ordinary space at the start of one is trimmed away — the same reason the launch screen
      // pads its labels with them.
      currencyIncomes[currency].textContent = `\u00a0(+${value})`;
      if (!newRun && value !== lastIncome[currency])
        pop(currencyIncomes[currency], value > lastIncome[currency] ? GAIN_COLOR : SPEND_COLOR);
    });
    lastIncome = income;
    // A board with no trees has no way to make a sweet and nothing to spend one on, so the
    // jar stays out of the header rather than sitting at zero teaching a currency that is not
    // in the game yet. Trees are what make candy, so their count is the honest condition.
    currencyDisplays[1].classList.toggle(CssClass.HIDDEN, !TREE_COUNT);
    const score = getScore(map, PLAYER);
    scoreCount.textContent = `${score}`; // a snapshot, so it has no "+" to show
    // And the star reacts too, for the same reason the income does: it moves on a step into
    // the clouds, on a rainbow lit and on a unicorn found, and those three are the whole of
    // what the run is for. A snapshot can fall as well as climb — a rainbow that goes out
    // takes its points with it — so this says which way it went in the same two colours.
    if (!newRun && score !== lastScore) pop(scoreDisplay, score > lastScore ? GAIN_COLOR : SPEND_COLOR);
    lastScore = score;
    newRun = false; // from here on the bar has a past to compare against
    // The rival's, live beside it — and out of the bar entirely on a board without one, the
    // same way the candy counter stays out of a board with no trees on it.
    if (HAS_OPPONENT) {
      rivalScoreDisplay.classList.toggle(CssClass.HIDDEN, !HAS_RIVAL);
      if (HAS_RIVAL) rivalScoreCount.textContent = `${getScore(map, RIVAL)}`;
    }
    // While the run is on, the working is the player's to open and close. Once it is over
    // the panel belongs to the result and endGame has already filled it — hence the guard.
    if (isRunning) renderScoreBoard(showsScore);
    renderBeams();

    // Three states for the build action: shown on a site, lit while the build is
    // really on, greyed out while it is only being looked at. Greyed rather than hidden is the
    // point — a site the player cannot afford yet still has to say what it would cost.
    const canRaise = !!buildSite && canBuild(map, buildSite, PLAYER);
    buildButton.classList.toggle(CssClass.HIDDEN, !buildSite);
    buildButton.classList.toggle(CssClass.HINT, canRaise);
    buildButton.disabled = !canRaise;
    if (buildSite) renderBuildButton(map.tiles[getIndex(buildSite)].object!);

    // While the rival is walking, the button stops being an action and becomes the answer to "why
    // will nothing respond": whose turn it is, in the glyph that means the rival everywhere else.
    // It is disabled either way (see isLocked), so this changes what it says, not what it does —
    // and it says it where the player last pressed, which is where they are looking.
    if (HAS_OPPONENT && isRivalTurn) endTurnButton.replaceChildren(rivalTurnGlyph!);
    else endTurnButton.textContent = getTranslation(isOver ? TranslationKey.LEVELS : TranslationKey.END_TURN);
    endTurnButton.disabled = isLocked(); // no second turn until this one is paid out and the rival has moved
    // Ending a turn is one step among many; starting the next run is the whole screen.
    endTurnButton.classList.toggle(CssClass.PRIMARY, outOfWater && !isOver);
    endTurnButton.classList.toggle(CssClass.PRIMARY_HIGHLIGHT, isOver);
    endTurnButton.classList.toggle(CssClass.HINT, needsIncome || isOver);
    // The bot acts under the same conditions the player does.
    if (HAS_DEV_TOOLS) updateBotControls!();
  }

  /**
   * Whether the player may be shown a beam at all: only if they can see the tile it leaves
   * from. It used to be free — a beam was only ever cast by a glower the player had found —
   * and became a rule of its own once the opponent's light started being cast off the
   * opponent's fog. Two things read it, and both are ways of drawing the same fact: the line
   * itself, and the halo on the tile casting it. Miss either and a cloud with an opponent's
   * unicorn under it lights up, which is precisely what the fog is for.
   *
   * A `Beam` is a `Position` of its own origin, so a beam can be handed to this directly.
   */
  function showsBeam({ x, y }: Position): boolean {
    return isSeen(map.tiles[getIndex({ x, y })], PLAYER) || (HAS_DEV_TOOLS && xray);
  }

  /**
   * One element per beam, laid out in percentages of the board so it follows MAP_SIZE and
   * the responsive board width on its own. A lit beam runs the full two tiles to its
   * rainbow; an unlit one stops halfway, inside the fountain that swallowed the light.
   */
  function renderBeams() {
    beamLayer.replaceChildren(
      ...map.beams.filter(showsBeam).flatMap(({ x, y, dx, dy, isLit, isCandy, side, lines = 1 }) => {
        const tileSize = 100 / MAP_SIZE; // one tile as a percentage of the board
        const length = Math.hypot(dx, dy); // diagonals are longer by exactly the hypotenuse of a 1x1 tile

        // One line per sweet the pairing pays, side by side across the gap — so what a grown
        // tree is worth can be counted off the board rather than guessed from a thickness.
        // Spread along the perpendicular (-dy, dx), which needs dividing by the length to be a
        // direction rather than a diagonal that spreads further than a straight one.
        return Array.from({ length: lines }, (_, i) => {
          const element = createElement({
            cssClass: [
              styles.beam,
              // three states, and they are the three things light can be doing: turning into
              // sweets, turning into water, or having died in the fountain on the way
              isCandy ? styles.candy : isLit ? styles.water : styles.unlit,
              HAS_OPPONENT && side === RIVAL ? styles.dark : "",
            ],
          });
          const spread = ((i - (lines - 1) / 2) * BEAM_GAP * tileSize) / length;

          element.style.left = `${(x + 0.5) * tileSize - spread * dy}%`;
          element.style.top = `${(y + 0.5) * tileSize + spread * dx}%`;
          element.style.width = `${(isLit ? 2 : 1) * length * tileSize}%`;
          element.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;

          return element;
        });
      }),
    );
  }

  /** The info panel is one line: an emoji plus a "Name|Description" text. */
  function setInfo(key: TranslationKey, emoji: string) {
    const [name, description] = getTranslation(key).split("|");
    if (HAS_OPPONENT) infoEmoji.classList.remove(styles.dark); // the caller puts it back if what it names is the rival's
    infoEmoji.textContent = emoji;
    infoName.textContent = name; // empty for the hint, which has no name
    infoText.textContent = description;
  }

  /** Whatever the player tapped explains itself — an object, bare ground, or the fog. */
  function showInfo(index?: number) {
    // The open score view holds the line: INFO_GOAL is already the text that belongs over a
    // breakdown — what scores, and that it has to be built up before the turns run out.
    if (showsScore) return setInfo(TranslationKey.INFO_GOAL, SCORE_EMOJI);

    const objectType = index === undefined ? undefined : getObject(index);

    // The ground wins over whoever is standing on it, for the donut alone: a unicorn on a
    // donut is a unicorn that can jump, and where it can jump to is the thing worth reading.
    // It is also where the price of a jump is stated, which is why it is not conditional on
    // the jump being affordable — a purse too empty for it is exactly when that has to be legible.
    if (index !== undefined && isSeen(map.tiles[index], PLAYER) && map.tiles[index].object === GameObjectType.DONUT)
      setInfo(TranslationKey.INFO_DONUT, OBJECT_CONFIG[GameObjectType.DONUT].emoji);
    else if (objectType !== undefined) {
      setInfo(OBJECT_CONFIG[objectType].info, OBJECT_CONFIG[objectType].emoji);
      // The panel names the opponent's things with the opponent's own glyph, so what is being
      // explained is the thing that was tapped rather than the player's version of it.
      if (HAS_OPPONENT) infoEmoji.classList.toggle(styles.dark, isDark(objectType));
      // The tub's second job is selling unicorns, and it is paid for in candy — which the
      // tutorial board has no trees to make. There it is not on offer, so it is not described
      // either: the tub is introduced as the thing that pays for the walking, and nothing else.
      // The rival's tub sells to the rival, so the offer is not described on it at all.
      if (objectType === GameObjectType.BATHTUB && TREE_COUNT)
        infoText.textContent += ` ${getTranslation(TranslationKey.INFO_BATHTUB_SELL)}`;
      // How grown a unicorn is, one sparkle per level, after its name. A count rather than a
      // number and with no word for "level" in it: it needs no translating, and it is the same
      // reading as the light it casts, which is drawn one line per level. Either side's — the
      // rival's own progress is a thing worth being able to look up.
      if (SIDE_UNICORN.includes(objectType)) infoName.textContent += ` ${LEVEL_EMOJI.repeat(getUnicornLevel(map.tiles[index!]))}`;
      // The unicorn's own description is the one that changes with the run. INFO_UNICORN is what
      // it is for and how to walk it, which is all the opening position can act on: every board
      // starts as a 3x3 of bare meadow with clouds past it, and the fountain the line-up rule is
      // about is under one of them. Once the player has found a fountain, the rule becomes
      // readable and takes the line over.
      //
      // A swap and not an append, unlike the tub's second job: the two halves together outrun
      // $info-height, the room the panel reserves for its longest description — which is the
      // shine line itself. Either half alone fits, so the reserved height still holds.
      //
      // The player's own unicorn only. SIDE_UNICORN above is deliberately both sides, but the
      // rival's is described by INFO_RIVAL, and overwriting that would explain the player's
      // piece on the opponent's tile. The sparkles can never turn up on a unicorn of the
      // player's without this line: a beam needs the fountain one step away (see
      // updateRainbows), and a unicorn always reveals its own 3x3.
      if (objectType === SIDE_UNICORN[PLAYER] && map.tiles.some((t) => t.object === GameObjectType.FOUNTAIN && isSeen(t, PLAYER)))
        infoText.textContent = getTranslation(TranslationKey.INFO_UNICORN_SHINE);
    } else if (index === undefined) setInfo(TranslationKey.INFO_HINT, HINT_EMOJI);
    else if (isSeen(map.tiles[index], PLAYER)) setInfo(TranslationKey.INFO_EMPTY, EMPTY_EMOJI);
    else setInfo(TranslationKey.INFO_FOG, FOG_EMOJI);
  }

  /** Whether a thing on the board belongs to the opponent — the one question the drawing asks. */
  function isDark(objectType: GameObjectType | undefined): boolean {
    return HAS_OPPONENT && objectType !== undefined && objectType >= GameObjectType.DARK_UNICORN;
  }

  /** Opens the score's working, or closes it again and hands the panel back to the selection. */
  function toggleScore() {
    if (!isRunning || isLocked()) return; // the end-of-run panel is already showing the working
    showsScore = !showsScore;
    showInfo(selected && getIndex(selected));
    render();
  }

  /**
   * The score's working: what a rainbow and a unicorn are worth right now, one row per
   * category, and the total they come to. Rebuilt on every render while it is open, so it
   * stays live as the board changes — and it is the same panel at the end of the run, where
   * it is the final reckoning rather than a running one. The emoji is a span of its own —
   * the digits beside it must not be rendered in the emoji font.
   */
  function renderScoreBoard(show: boolean) {
    const line = (emoji: string, text: string, dark = false) =>
      createElement({}, [createElement({ tag: "span", cssClass: [CssClass.EMOJI, dark ? styles.dark : ""], text: emoji }), text]);
    // The share of the board that is out from under the clouds, which is also — exactly, not
    // as an approximation — what one rainbow and one unicorn are each worth. It heads the
    // list rather than closing it, because the rows below multiply by it: the panel now reads
    // "here is the rate, here is what each of yours earns at it, here is the sum". Nothing is
    // taken off anything, so every point in the total plainly belongs to something built.
    const rate = getExploration(map, PLAYER);
    // What the run was worth as a level: its score as a share of the level's target, which is
    // the same figure the stripe on the launch screen fills to. Only once the run is over,
    // because it is a result and not a rate — the rows above are what the board is worth this
    // instant, and this is what the instant it ends means. And nothing at all on a random
    // board: its size is a level's, but its map is nobody's, and a score on it has no target to
    // be a share of (see setBestScore).
    // The target in brackets after the share of it, because the share alone is a number with
    // nothing behind it: "87%" says how the run went, "87% (6897)" also says what finishing the
    // job would take — and the score two rows above is in the same units as the figure in the
    // brackets, so the two can be read against each other.
    const targetLine =
      isRunning || isRandom ? [] : [line(TARGET_EMOJI, ` ${getPercent(level, getScore(map, PLAYER))}% (${LEVEL_TARGETS[level]})`)];
    // The way back into the board just played, last and under everything the result has to say.
    // Only once there is a result: mid-run this panel is the score's working, and there is
    // nothing to go back to.
    const retryLine = isRunning ? [] : [retryButton];
    // The rival's total gets a row of its own under the player's, and only its total: it is
    // playing off its own clouds, so its working is arithmetic over a board the player has
    // never seen and would explain nothing. What the row is for is the gap.
    const rivalLine =
      HAS_OPPONENT && HAS_RIVAL ? [line(OBJECT_CONFIG[GameObjectType.DARK_UNICORN].emoji, ` ${getScore(map, RIVAL)}`, true)] : [];

    scoreBoard.replaceChildren(
      ...(show
        ? [
            line(EXPLORE_EMOJI, ` ${rate}%`),
            ...getScoreParts(map, PLAYER).map((count, index) => line(SCORE_EMOJIS[index], ` ${count} × ${rate} = ${count * rate}`)),
            line(SCORE_EMOJI, ` ${getScore(map, PLAYER)}`),
            ...rivalLine,
            ...targetLine,
            ...retryLine,
          ]
        : []),
    );
  }

  /** What is visible on a tile — the living layer wins, the ground object stays underneath. */
  function getObject(index: number): GameObjectType | undefined {
    const tile = map.tiles[index];
    return isSeen(tile, PLAYER) ? (tile.living ?? tile.object) : undefined;
  }

  /** Selection is "what the player is looking at" — the info panel follows it exactly. */
  function select(position?: Position) {
    selected = position;
    const index = position && getIndex(position);
    // A character still under the fog is not a character yet: its tile stays plain fog to
    // the player, so tapping it can never pick it up, light up its steps, or offer it the
    // portal — any of which would give away that something is hiding there.
    const tile = index === undefined ? undefined : map.tiles[index];
    // The player's *own* unicorn. The rival's can be picked up and read about — every tile can —
    // but it lights no steps and takes no orders: it is a thing on the board, not a piece.
    const isCharacter = isSeen(tile, PLAYER) && tile!.living === SIDE_UNICORN[PLAYER];
    // A bathtub is the one piece of scenery that leads somewhere: it offers the fields it
    // can put a new unicorn on. Nothing can stand on a tub — it blocks movement — so this
    // and isCharacter are never both true, and the two kinds of target never mix.
    // The player's own again: the rival's tub is scenery to them, priced against a jar that
    // is not theirs, and getSpawnTargets would answer for the rival if it were asked.
    isTubSelected = isSeen(tile, PLAYER) && tile!.object === GameObjectType.BATHTUB;
    // Steps only light up for a character that can afford them, and affordability is now
    // per target rather than per character: with an empty purse a step onto a flower is
    // still on, and it is exactly then that it matters most. Scenery, a blocked-in
    // character and one that can afford none of its steps all end up with no targets,
    // which is what render() draws as the neutral selection. A tub with too little candy
    // lands there too — the fields light up only once the trade can actually be made.
    // Only a character can take the portal, and only from the donut it is standing on. The
    // far ends are filtered exactly as the steps are — an unaffordable jump, or one onto a
    // donut somebody is already standing on, is not lit, because it cannot be taken.
    portalTargets = isCharacter ? getPortalTargets(map, position!, PLAYER).filter((target) => canUsePortal(map, target, PLAYER)) : [];
    targets = isCharacter
      ? [...getMoveTargets(map, position!).filter((target) => getMoveCost(map, target, PLAYER) <= map.drops[PLAYER]), ...portalTargets]
      : isTubSelected
        ? getSpawnTargets(map, position!)
        : [];
    // A site under the fog is not a site yet, for the same reason a character under it is not
    // a character: offering to build on it would give away that something is there.
    buildSite = isSeen(tile, PLAYER) && getBuild(tile!.object) ? position : undefined;
    showInfo(index);
  }

  function onTileClick(index: number) {
    if (!isRunning || isLocked() || index < 0) return;
    showsScore = false; // the board takes the panel back, whether the tap moves or just looks

    if (targets.some((target) => getIndex(target) === index)) {
      // the same second tap either way — what it finishes depends on what is selected, and
      // for a character on whether the lit tile it landed on is next door or across the board
      if (isTubSelected) buy(getPosition(index));
      else move(getPosition(index), portalTargets.some((target) => getIndex(target) === index) ? PORTAL_COST : undefined);
    } else {
      // every tile can be picked up and explains itself, fog and bare ground included;
      // tapping the selected one again drops it and the panel falls back to its hint
      select(index === (selected && getIndex(selected)) ? undefined : getPosition(index));
      render();
    }
  }

  /** One step at whatever that step costs, or — at the portal's price — a jump straight to the far donut. */
  function move(target: Position, cost = getMoveCost(map, target, PLAYER)) {
    map.drops[PLAYER] -= cost;
    moveCharacter(map, selected!, target);
    // Stepping on is the whole of opening one, so this runs on every step and comes back
    // empty-handed on all but a few of them. Before the fog and the rainbows: a chest can
    // hold a unicorn, and that unicorn has its own vision and its own light to bring.
    const loot = openChest(map, target, PLAYER);

    const previousRainbowCount = map.rainbowCounts[PLAYER];
    revealAround(map, target, PLAYER);
    updateRainbows(map);
    // after the fog lifts, so a step into the unknown still reads its own tile
    select(target); // stays selected, so walking on is a single tap per step
    render();
    showSpending(target, cost); // after render(), which is what puts the tile where it is measured
    if (loot !== undefined) showLoot(target, loot);

    if (map.rainbowCounts[PLAYER] > previousRainbowCount) pubSubService.publish(PubSubEvent.STAR_COLLECT);
  }

  /**
   * The build button's face: what the site becomes, then what it costs, in the currencies it
   * is actually paid in — a fountain shows only water, a tree only sweets, and the tub both.
   * No verb on it: the info panel beside it has just said what a unicorn can do here, and a
   * price tag in the currency you hold reads the same in every language.
   * The digits are kept out of the emoji spans, or they would render in the emoji font.
   */
  function renderBuildButton(objectType: GameObjectType) {
    const [built, drops, candy] = getBuild(objectType)!;
    const price = (amount: number, emoji: string) =>
      amount ? [` ${amount}`, createElement({ tag: "span", cssClass: CssClass.EMOJI, text: emoji })] : [];

    buildButton.replaceChildren(
      createElement({ tag: "span", cssClass: CssClass.EMOJI, text: OBJECT_CONFIG[built].emoji }),
      ...price(drops, DROP_EMOJI),
      ...price(candy, CANDY_EMOJI),
    );
  }

  /** Raises what the selected site is for, and hands the board back with the building on it. */
  function raise() {
    const site = buildSite!;
    const [, drops, candy] = getBuild(map.tiles[getIndex(site)].object)!; // before the site is spent

    build(map, site, PLAYER);
    // The tile is a building now, so the selection follows it into what it became — and a tub
    // that has just been filled goes straight on to offering the fields it can put a unicorn on.
    select(site);
    render();
    // Counted out of the field it was built on, one currency after the other, in the same
    // gesture a step and a unicorn already use.
    showSpending(site, drops);
    showSpending(site, candy, 1);

    pubSubService.publish(PubSubEvent.STAR_COLLECT);
  }

  /** Trades the jar of candy for a unicorn on one of the tub's fields, then hands the board back. */
  function buy(target: Position) {
    const price = getUnicornPrice(map, PLAYER); // read before the newcomer joins the herd and puts the price up
    buyUnicorn(map, target, PLAYER);
    select(selected); // the tub stays picked up, but the jar may no longer stretch to another
    render();
    // The jar empties the same way the purse does, from the field the unicorn appeared on —
    // sweets rather than drops, but the same gesture, so a price is always counted out in the
    // currency that paid it.
    showSpending(target, price, 1);

    pubSubService.publish(PubSubEvent.STAR_COLLECT);
  }

  /**
   * A counter reacting to its number changing: it swells and settles back. `colour` tints it
   * for the length of the pop, which is what tells the directions apart — money going out
   * turns it red, a number growing turns it green, money arriving leaves it its own colour
   * because the glyph that flew in has already said where it came from.
   * `scale` rather than a `transform`, so it cannot overwrite a transform the counter may be
   * carrying, and alternated back to nothing so there is nothing to clean up afterwards.
   *
   * Takes the counter rather than an index into the currencies: the score is one of these now,
   * and it is not a currency.
   */
  function pop(display: HTMLElement, colour?: string) {
    // The tint is spread in rather than set to undefined: a keyframe value the browser cannot
    // parse is dropped silently, and "silently" is how the mangled options below went unnoticed.
    display.animate([{ "scale": POP_SCALE, ...(colour && { "color": colour }) }], POP_OPTIONS);
  }

  /**
   * What something just cost, said where the player is looking: one glyph of the currency
   * rises off the tile it was paid on and fades, per unit paid. Counting in glyphs rather
   * than printing a number is what makes a higher price legible without explaining it — the
   * portal throws two drops, a unicorn one sweet per head of the herd — and it is the language the payout
   * speaks in. A free step over a flower pays nothing and so shows nothing, which says "free"
   * by itself.
   */
  function showSpending(position: Position, cost: number, currency = 0) {
    if (!cost) return;

    const from = centre(tileElements[getIndex(position)]);
    const stagger = Math.min(SPEND_STAGGER, SPEND_SPREAD / cost);

    for (let i = 0; i < cost; i++) {
      flyGlyph(
        [DROP_EMOJI, CANDY_EMOJI][currency],
        from,
        { "transform": `translateY(-${SPEND_RISE}em)`, "opacity": 0 },
        {
          "duration": SPEND_DURATION,
          "delay": i * stagger,
          "easing": "ease-out", // off it goes, then it drifts — the opposite of the payout's dive
        },
      );
    }

    pop(currencyValues[currency], SPEND_COLOR);
  }

  /**
   * One unit of money on its way in: a glyph of `currency` leaves `from` and lands on the
   * counter it pays into, popping it as it arrives — so a busy board reads as a run of
   * payments rather than one number quietly changing. Only the trip is animated; the centring
   * on the tile is a CSS `translate` on the glyph itself, and the two compose rather than
   * overwrite each other.
   *
   * `to` is passed in rather than measured here: a busy board sends thirty of these to the
   * same place, and measuring is the one thing that makes the browser stop and think.
   */
  function flyToCounter(currency: number, from: number[], to: number[], delay: number) {
    flyGlyph(
      [DROP_EMOJI, CANDY_EMOJI][currency],
      from,
      { "transform": `translate(${to[0] - from[0]}px, ${to[1] - from[1]}px) scale(0.5)`, "opacity": 0.5 },
      { "duration": FLY_DURATION, "delay": delay, "easing": "ease-in" },
      () => pop(currencyValues[currency]),
    );
  }

  /**
   * A chest paying out. It flies the same glyphs the same way the turn's income does — money
   * coming in always moves towards the purse, whether it was earned or found — so a chest
   * needs no explaining beyond the trip the player has already watched every turn.
   * A unicorn is its own announcement: it is standing on the board, so nothing flies for it.
   */
  function showLoot(position: Position, loot: ChestLoot) {
    if (loot === ChestLoot.UNICORN) return;

    // A loot value doubles as its currency index — see the ChestLoot comment in game-objects.
    const from = centre(tileElements[getIndex(position)]);
    const to = centre(currencyDisplays[loot]);
    const count = [CHEST_DROPS, CHEST_CANDY][loot];
    const stagger = Math.min(FLY_STAGGER, FLY_SPREAD / count);

    for (let i = 0; i < count; i++) flyToCounter(loot, from, to, i * stagger);
  }

  /**
   * The payout made visible: one glyph leaves every tile that is earning and flies to the
   * counter it pays into — a drop from every rainbow, a sweet from every earning tree. Where
   * the income comes from is otherwise only implicit in a number going up, and on a board
   * this size that is the one thing worth showing.
   *
   * Read straight off the tiles rather than from the income counts, so what flies is exactly
   * what is being paid: the two are counted from the same rainbows and the same predicate.
   *
   * The two currencies are collected one after the other rather than at once — every drop
   * first, a pause, then every sweet. Both counters climbing at the same time is a single
   * blur of movement; taken in turn, each currency gets its own moment and the player can
   * actually count what the board just paid them.
   *
   * Returns how long the whole payout takes, which is what finishTurn waits out.
   */
  function flyIncome(): number {
    // The counters are measured once here rather than per flight: thirty drops all land in
    // the same place, and measuring is the one thing that makes the browser stop and think.
    const centres = currencyDisplays.map(centre);
    // The paying tiles, grouped by the currency they pay — which is also the index everything
    // else is keyed by: the emoji that flies, the counter it lands on, and the one that pops.
    // A tile pays at most one of the two: a rainbow lands on empty ground, so no tree can
    // ever be standing on it.
    const groups: number[][] = [[], []];

    // The player's own income only, throughout: what flies is what lands in the counters the
    // player is watching. The rival's payout happens on the model and is never animated — its
    // score is the thing to watch it by, and thirty more glyphs a turn crossing the screen
    // would say nothing the number does not.
    map.tiles.forEach((tile, index) => {
      // A rainbow throws what it is worth: one drop per level of the unicorn whose light made
      // it, so a grown one is counted out in three glyphs and the size of the herd's income can
      // be watched arriving rather than only read off the counter. Through getRainbowDrops, so
      // one whose light is being fed to a tree throws nothing and the flight stays the truth.
      if (tile.object === GameObjectType.RAINBOW)
        groups[0].push(...Array<number>(getRainbowDrops(map, getPosition(index), PLAYER)).fill(index));
      // A tub pays its flat drops out of itself, one glyph each, so the income that needs no
      // setting up is counted out on the board exactly like the income that does.
      else if (tile.object === GameObjectType.BATHTUB) groups[0].push(...Array<number>(BASE_INCOME).fill(index));
      // And a lollipop tree each feeding rainbow's size in sweets — same rule, so a tree catching
      // two of them throws for both, and the flight counts out the price of a unicorn in the
      // same glyphs the purchase will spend.
      else
        groups[1].push(
          ...Array<number>(
            getFeedingRainbows(map, getPosition(index), PLAYER).reduce((sweets, rainbow) => sweets + getTile(map, rainbow)!.light!, 0),
          ).fill(index),
        );
    });

    let start = 0; // when this currency's first glyph sets off
    let end = 0; // when the last one of all has landed — nothing paid, nothing to wait for

    groups.forEach((group, currency) => {
      if (!group.length) return; // an empty currency costs no pause either

      const stagger = Math.min(FLY_STAGGER, FLY_SPREAD / group.length);
      const [toX, toY] = centres[currency];

      // The delay is what lets the sweets wait on their trees while the drops are collected.
      group.forEach((index, i) => flyToCounter(currency, centre(tileElements[index]), [toX, toY], start + i * stagger));

      end = start + (group.length - 1) * stagger + FLY_DURATION;
      start = end + CURRENCY_GAP; // the next currency waits for this one to be in the purse
    });

    return end;
  }

  /**
   * Closes the turn: the board pays out, the turn counter moves on, and the run ends if that
   * was the last one — the only way a run can end, since a bathtub pays whatever else happens
   * and the board can therefore never seize up.
   *
   * The purse is credited only once the income has landed, so the counters move when the
   * drops and sweets reach them rather than a second before. Everything else waits with it,
   * the end of the run included — the last turn is paid out like any other.
   */
  function finishTurn() {
    // The closing turn pays out nothing — see endTurn — so there is nothing to watch either,
    // and the result comes up the moment the button is pressed instead of after a flight of
    // glyphs carrying money the run has no more use for.
    const wait = map.turn < TURN_LIMIT ? flyIncome() : 0;
    isPaying = !!wait; // an empty board pays nothing and has nothing to wait for
    render(); // takes the button out of reach for the length of the flight

    setTimeout(() => {
      isPaying = false;
      endTurn(map, PLAYER);
      select(selected); // steps that were unaffordable a moment ago may be back
      render();

      // The rival goes next, and the clock only moves on once it has had its turn — so a
      // "turn" is the pair of them. Without an opponent the two halves collapse into what
      // this always did: pay the player, tick over, see whether the run is out of turns.
      // On the closing turn it has no go (see hasGo), so the run ends on the player's move
      // rather than on somebody else's.
      if (HAS_OPPONENT && HAS_RIVAL && hasGo(map, RIVAL)) playRivalTurn(closeTurn);
      else closeTurn();
    }, wait);
  }

  /** The clock moving on, once everybody who plays this turn has played it. */
  function closeTurn() {
    nextTurn(map);
    select(selected); // the rival may have walked off a tile this selection was aiming at
    render();

    if (isRunOver(map)) endGame();
  }

  /**
   * The opponent's turn, played out in front of the player one action at a time. It is the
   * same bot the dev corner drives, on the other side, and it goes through applyBotAction
   * rather than through the interface's own move/buy/raise: those are the *player's* hands —
   * they read `selected`, fly the player's glyphs and pop the player's counters.
   *
   * A timer rather than a loop, so the board is repainted between actions and the rival can
   * be watched crossing it. It is also the only thing on this screen that runs while the
   * player cannot act, which is what isRivalTurn locks.
   *
   * Nothing here checks how long the turn is: the bot ends its own turn exactly as the player
   * does — when it can find nothing worth doing — and END_TURN is what stops the timer. That
   * is the same guarantee the run has always leaned on, that a turn always ends.
   */
  function markRivalAction(position?: Position) {
    rivalMark?.classList.remove(styles.acting);
    rivalMark = position && tileElements[getIndex(position)];
    rivalMark?.classList.add(styles.acting);
  }

  function playRivalTurn(onDone: () => void) {
    isRivalTurn = true;
    render(); // takes the board out of reach for as long as the rival is on it

    rivalTimer = setInterval(() => {
      const action = getBotAction(map, BotStrategy.MIXED, RIVAL);

      if (!action || action.kind === BotActionKind.END_TURN) {
        clearInterval(rivalTimer);
        rivalTimer = undefined;
        endTurn(map, RIVAL); // its own payout, on the model — nothing flies for it
        isRivalTurn = false;
        markRivalAction(); // the ring goes out with the turn, or it would read as an offer
        onDone();
        return;
      }

      applyBotAction(map, action, RIVAL);
      // Where it just acted: the tile it stepped onto, or the one it stood on to build. After the
      // action rather than before, so the ring lands where the unicorn now is.
      markRivalAction(action.to ?? action.from);
      // Re-selected rather than only redrawn: the rival may have walked onto the very tile
      // this selection was offering as a step, and a highlight that outlives what it was
      // offering is worse than none. The board is locked either way, so nothing can be acted
      // on in the meantime — this is about what it says, not about what it allows.
      select(selected);
      render();
    }, RIVAL_STEP_DELAY) as unknown as number;
  }

  /**
   * The result takes over the info panel and the turn button — no dialog on top of the board.
   * There is only one way to get here: the turns ran out. The board cannot seize up while a
   * bathtub is paying, so every run is played to the end and every ending is celebrated.
   */
  function endGame() {
    isRunning = false;
    // On a board with an opponent there is now something to lose. A draw goes to the player:
    // the rival is the thing to beat, and matching it is beating it — and it keeps "there is
    // no losing in this game" true of every board that has nobody on it to lose to.
    const isWon = !HAS_OPPONENT || !HAS_RIVAL || getScore(map, PLAYER) >= getScore(map, RIVAL);
    select(undefined); // drops the board highlights; the panel now carries the result
    setInfo(
      HAS_OPPONENT && HAS_RIVAL ? (isWon ? TranslationKey.WON_RACE : TranslationKey.LOST_RACE) : TranslationKey.WON,
      isWon ? WIN_EMOJI : LOSE_EMOJI,
    );
    const score = getScore(map, PLAYER);
    // The level's record, and only from its own board: a level's percentage stands for the one
    // map every player is dealt, so a random deal cannot fill a stripe. Written before the panel
    // is drawn rather than after, because the launch screen reads its stripes back out of this.
    if (!isRandom) setBestScore(level, score);
    infoText.textContent += ` ${score}`; // the text ends ready for the number
    showsScore = false; // the result owns the panel now; there is nothing left to toggle
    renderScoreBoard(true); // the total above, its working below — and the rival's total under that
    render();

    pubSubService.publish(PubSubEvent.GAME_END, { isWon });
  }

  // The level to play comes from the launch screen, as a rung rather than a board: the size and
  // the seed both hang off it (see game/levels.ts), and so does the record the run will be
  // written into. `random` swaps that seed for a fresh one — the same board size dealt again,
  // which scores nothing and is offered once the level's own board has been finished.
  function startNewGame(playedLevel: number, random = false) {
    level = playedLevel;
    isRandom = random;
    // The flag first, so that a build without the random board folds the whole branch away and
    // takes createSeed out with it — the level's own seed is then the only board there is.
    startRun(HAS_GAMEPLAY_NICE_TO_HAVES && random ? createSeed() : LEVEL_SEEDS[level]);
  }

  /**
   * Opens a board. Split from startNewGame because 🔁 comes back through here on its own: which
   * level is being played and whether it counts are settled up there and stay settled, and this
   * is only the map being dealt again.
   */
  function startRun(newSeed: number) {
    seed = newSeed;
    map = createGameMap(seed, MAP_SIZES[level]); // sets MAP_SIZE and HAS_RIVAL, so everything below reads the new board
    // The bot rolls on a generator of its own — see bot.ts — and it is seeded from the map
    // so that the same board played by the same bot plays out the same way twice. It has to
    // be reset for the opponent as well as for the dev tools now: the memory it keeps between
    // decisions (where each unicorn is headed, where it has been) belongs to the last board.
    if (HAS_DEV_TOOLS || HAS_OPPONENT) resetBot(seed);
    // A run left mid-rival-turn must neither lock the next one nor leave a rival walking about
    // on a board that has been replaced underneath it.
    clearInterval(rivalTimer);
    rivalTimer = undefined;
    isRivalTurn = false;
    if (HAS_OPPONENT) markRivalAction(); // a ring from the last board must not open the next one
    if (tileElements.length !== MAP_SIZE * MAP_SIZE) buildBoard();
    showsScore = false; // render() clears last run's working with it, before the new board shows
    newRun = true; // the first render of a board seeds the bar rather than reacting to it
    isRunning = true; // before render(), which reads it for the turn button
    select(undefined);
    render();
    applyZoom(true); // the map row can only be measured once it is on the page, so not before here

    pubSubService.publish(PubSubEvent.GAME_START);
  }

  return [hostElement, startNewGame, headerControls];
}
