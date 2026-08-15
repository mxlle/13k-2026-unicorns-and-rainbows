import styles from "./game-map.module.scss";
import { createButton, createElement, createElements } from "../../utils/html-utils";
import { PubSubEvent, pubSubService } from "../../utils/pub-sub-service";
import { CssClass } from "../../utils/css-class";
import { getTranslation } from "../../translations/i18n";
import { TranslationKey } from "../../translations/translationKey";
import {
  buyUnicorn,
  canBuyUnicorn,
  CANDY_PRICE,
  canUsePortal,
  createGameMap,
  createSeed,
  GameMap,
  getIndex,
  endTurn,
  getMoveCost,
  getMoveTargets,
  getPortalTarget,
  getPosition,
  getScore,
  getScoreParts,
  hasFreeMove,
  isEarningTree,
  isRunOver,
  isStuck,
  MAP_SIZE,
  moveCharacter,
  MOVE_COST,
  PORTAL_COST,
  Position,
  revealAround,
  TURN_LIMIT,
  UNICORN_START,
  updateRainbows,
} from "../../game/game-map";
import { GameObjectType, OBJECT_CONFIG } from "../../game/game-objects";

const FOG_EMOJI = "☁️";
const DROP_EMOJI = "💧";
const TURN_EMOJI = "⏳";
const SCORE_EMOJI = "⭐";
// Stand-ins for the object emoji in the info panel, for the things that are not objects.
const HINT_EMOJI = "👆";
const EMPTY_EMOJI = "🌱";
const EXPLORE_EMOJI = "🧭";
const CANDY_EMOJI = "🍬";
// One per scoring category, in the order getScoreParts returns them: rainbows shining,
// unicorns found, lollipop trees earning, and ground no longer under cloud. Declared after
// EMPTY_EMOJI on purpose — reading it earlier would be a dead-zone crash at module load.
const SCORE_EMOJIS = [
  OBJECT_CONFIG[GameObjectType.RAINBOW].emoji,
  OBJECT_CONFIG[GameObjectType.UNICORN].emoji,
  OBJECT_CONFIG[GameObjectType.TREE].emoji,
  EXPLORE_EMOJI,
];
// PLACEHOLDER: the invitation to buy, drawn on the start field once a unicorn is
// affordable and the field is clear. It is not a game object — nothing stands on the
// tile, so it can never block a rainbow the way a real object would.
const HEART_EMOJI = "💗";
const WIN_EMOJI = "🎉";
const LOSE_EMOJI = "😢";
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
const START_INDEX = getIndex(UNICORN_START); // the one field a bought unicorn ever appears on

// The usual [host, update] tuple plus the status chip that belongs in the header — it is
// part of the game state, so the game owns it; only its place in the DOM is elsewhere.
export function GameMapComponent(): [hostElement: HTMLElement, startNewGame: (seed?: number) => void, statusChip: HTMLElement] {
  let map: GameMap;
  let isRunning = false;
  // Two-tap navigation: tap an object to select it, then — if it is a character that
  // can afford a step — tap one of its highlighted neighbours to move there.
  let selected: Position | undefined;
  let targets: Position[] = [];
  // The far donut, when the selection is a character standing on the near one. It is an
  // action rather than a highlighted tile, so taking the portal never gives the far end
  // away before the player has walked there.
  let portalTarget: Position | undefined;
  // Whether the selection is the start field with enough candy in the jar. Like the portal
  // it is an offer rather than a highlighted tile, and it takes the info line over so the
  // trade is explained right beside the button that makes it.
  let isBuySpot = false;

  // Two stacked glyph layers per tile, mirroring the two layers of the model: the ground
  // first, the character standing on it painted over it (later sibling, same grid cell).
  // A character therefore never hides what it stands on — the donut under a unicorn still
  // shows. Glyphs live in spans of their own so one can be transformed on its own — the
  // lollipop tree is drawn tilted and gets stood upright — without turning the tile's
  // background, its selection ring, or the grid cell with it.
  const groundGlyphs = createElements({ tag: "span" }, MAP_SIZE * MAP_SIZE);
  const livingGlyphs = createElements({ tag: "span" }, MAP_SIZE * MAP_SIZE);
  const tileElements = groundGlyphs.map((ground, index) =>
    createElement({ cssClass: [styles.tile, CssClass.EMOJI] }, [ground, livingGlyphs[index]]),
  );
  // Light beams live in their own layer above the tiles: a tile can carry several at
  // once (the sun's does), which a per-tile pseudo-element could not draw.
  const beamLayer = createElement({ cssClass: styles.beams });
  // one delegated listener instead of one per tile
  // beam layer first: the tiles are positioned too, so they paint over it and an emoji
  // is never hidden by the light passing through it
  const board = createElement({ cssClass: styles.board, onClick: (event) => onTileClick(tileElements.indexOf(event.target)) }, [
    beamLayer,
    ...tileElements,
  ]);
  board.style.setProperty("--s", String(MAP_SIZE)); // keeps MAP_SIZE the single source of truth

  // PLACEHOLDER turn bar: turn count on the left, end-turn button on the right.
  // Only the emoji gets the emoji font — digits inside it would render as emoji glyphs too.
  const turnCounter = createElement({ tag: "span" });
  const dropCount = createElement({ tag: "span" });
  const candyCount = createElement({ tag: "span" });
  const scoreCount = createElement({ tag: "span" });
  const counter = (emoji: string, value: HTMLElement) =>
    createElement({ cssClass: styles.count }, [createElement({ tag: "span", cssClass: CssClass.EMOJI, text: emoji }), value]);
  // One button for both ends of a run: end the turn while playing, start over once it is over.
  const endTurnButton = createButton({ onClick: () => (isRunning ? finishTurn() : startNewGame()) });
  // The run's progress: how far through the 20 turns, and what the board is worth right now.
  // The score sits here rather than in the header chip because three "n (+n)" counters in a
  // row overflow the header on a phone — and the turn bar has the width going spare.
  const turnBar = createElement({ cssClass: styles.turnBar }, [
    counter(TURN_EMOJI, turnCounter),
    counter(SCORE_EMOJI, scoreCount),
    endTurnButton,
  ]);
  // The two currencies as one chip in the middle of the header, in view wherever the player
  // is looking. Each reads "what you have (+what the board pays you next turn)", so the
  // cost of a plan and the income funding it are side by side.
  const status = createElement({ cssClass: styles.status }, [counter(DROP_EMOJI, dropCount), counter(CANDY_EMOJI, candyCount)]);

  // Object info: a permanent row of its own between map and turn bar, so it can never
  // cover the board and never shifts it either. Empty selection shows a hint instead.
  // Spans, not divs: emoji, name and description flow as one wrapping line of text.
  const infoEmoji = createElement({ tag: "span", cssClass: [styles.infoEmoji, CssClass.EMOJI] });
  const infoName = createElement({ tag: "span", cssClass: styles.infoName });
  const infoText = createElement({ tag: "span" });
  // The portal action sits in the same line that explains it, so the offer and the
  // description arrive together. Hidden unless the selection is standing on a donut.
  const jumpButton = createButton({ cssClass: [CssClass.SECONDARY, styles.action], onClick: () => move(portalTarget!, PORTAL_COST) }, [
    createElement({ tag: "span", cssClass: CssClass.EMOJI, text: OBJECT_CONFIG[GameObjectType.DONUT].emoji }),
    ` ${getTranslation(TranslationKey.JUMP)}`,
  ]);
  // The purchase, offered the same way: an action in the line that explains it. It can
  // never share the line with the jump — the start field is revealed before any donut is
  // placed, so no donut can ever lie on it.
  const buyButton = createButton({ cssClass: [CssClass.SECONDARY, styles.action], onClick: buy }, [
    createElement({ tag: "span", cssClass: CssClass.EMOJI, text: OBJECT_CONFIG[GameObjectType.UNICORN].emoji }),
    ` ${getTranslation(TranslationKey.BUY)}`,
  ]);
  // The end-of-run breakdown, one line per scoring category, stacked under the result line.
  // Empty while the run is on, and CSS hides it then, so it takes no room until it has any.
  const scoreBoard = createElement({ cssClass: styles.scoreBoard });
  const infoPanel = createElement({ cssClass: styles.info }, [
    createElement({}, [infoEmoji, infoName, infoText, jumpButton, buyButton]),
    scoreBoard,
  ]);

  // The board takes its size from the map and the zoom step; this row scrolls to reach the
  // parts of it that do not fit. Panning is the browser's own scrolling — which brings touch
  // momentum, trackpad gestures and keyboard scrolling along for nothing.
  const mapArea = createElement({ cssClass: styles.mapArea }, [board]);
  const zoomOutButton = createButton({ cssClass: CssClass.ICON_BTN, onClick: () => zoom(-1) }, ["−"]);
  const zoomInButton = createButton({ cssClass: CssClass.ICON_BTN, onClick: () => zoom(1) }, ["+"]);
  const zoomControl = createElement({ cssClass: styles.zoom }, [zoomOutButton, zoomInButton]);
  const hostElement = createElement({ cssClass: styles.host }, [mapArea, zoomControl, infoPanel, turnBar]);

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
    const freeIndices = targets.filter((target) => !getMoveCost(map, target)).map(getIndex);
    // Guidance: an empty purse makes the income the only way on, so ending the turn
    // becomes the next step. Before that, on the opening turn, it is picking a character.
    // Once the run is over the same button is the only thing left to press.
    // The two signals on that button are deliberately split. Colour goes on as soon as the
    // purse is empty — ending the turn is the way on from there, whether or not a free step
    // over a flower is still available. The pulse waits for the stricter case, when there
    // is genuinely nothing else left to do, so it never nags a player who can still act.
    const outOfWater = map.drops < MOVE_COST;
    const needsIncome = outOfWater && !hasFreeMove(map);
    const canBuy = canBuyUnicorn(map);
    const isOver = !isRunning;
    const hintCharacters = !isOver && !needsIncome && !selected && map.turn === FIRST_TURN;

    map.tiles.forEach((tile, index) => {
      const element = tileElements[index];
      const objectType = getObject(index);
      const isSelectedTile = index === selectedIndex;
      // The invitation to buy. Drawn only while the purchase is actually available, so the
      // heart never appears on a field that would refuse it, and it pulses like any other
      // "this is your next move" — it is the one affordance nothing else on the board hints at.
      const showHeart = canBuy && index === START_INDEX;
      element.classList.toggle(styles.revealed, tile.isRevealed);
      element.classList.toggle(styles.glowing, objectType !== undefined && OBJECT_CONFIG[objectType].glows);
      element.classList.toggle(CssClass.HINT, showHeart || (hintCharacters && tile.isRevealed && tile.living !== undefined));
      element.classList.toggle(styles.selected, isSelectedTile);
      // no steps lit means the selection is only being looked at — see select()
      element.classList.toggle(styles.neutral, isSelectedTile && !targets.length);
      element.classList.toggle(styles.target, targetIndices.includes(index));
      element.classList.toggle(styles.free, freeIndices.includes(index));

      // The fog belongs to the ground layer: under it there is nothing else to show.
      const hasLiving = tile.isRevealed && tile.living !== undefined;
      const ground = groundGlyphs[index];
      // guarded on isRevealed, or the fog cloud hiding a tree would be turned instead
      ground.classList.toggle(styles.tree, tile.isRevealed && tile.object === GameObjectType.TREE);
      // which trees are paying into the jar this turn — read from the same predicate the
      // income itself is counted with, so the glow can never promise candy that never comes
      ground.classList.toggle(styles.earning, isEarningTree(map, getPosition(index)));
      ground.classList.toggle(styles.covered, hasLiving); // steps back behind the character
      // the heart only shows on a clear field, so there is never a ground glyph to displace
      ground.textContent = showHeart
        ? HEART_EMOJI
        : tile.isRevealed
          ? tile.object === undefined
            ? ""
            : OBJECT_CONFIG[tile.object].emoji
          : FOG_EMOJI;

      const living = livingGlyphs[index];
      // only makes room when there is actually something underneath to show
      living.classList.toggle(styles.stacked, hasLiving && tile.object !== undefined);
      living.textContent = hasLiving ? OBJECT_CONFIG[tile.living!].emoji : "";
    });

    // Each currency reads "what you have (+what next turn pays)". The income half updates as
    // the player moves, so the cost of rearranging the board and its effect on next turn's
    // takings are visible in the same glance.
    turnCounter.textContent = `${Math.min(map.turn, TURN_LIMIT)}/${TURN_LIMIT}`;
    dropCount.textContent = `${map.drops} (+${map.rainbowCount})`;
    candyCount.textContent = `${map.candy} (+${map.candyIncome})`;
    scoreCount.textContent = `${getScore(map)}`; // a snapshot, so it has no "+" to show
    renderBeams();

    // Offered wherever the character stands, but greyed out when it cannot be paid for or
    // somebody else is already standing on the far donut.
    jumpButton.classList.toggle(CssClass.HIDDEN, !portalTarget);
    jumpButton.classList.toggle(CssClass.HINT, !!portalTarget && canUsePortal(map, portalTarget));
    jumpButton.disabled = !portalTarget || !canUsePortal(map, portalTarget);

    // Offered on the start field whenever the candy is there, greyed out until the field
    // is actually clear — the same shape as the jump above it.
    buyButton.classList.toggle(CssClass.HIDDEN, !isBuySpot);
    buyButton.classList.toggle(CssClass.HINT, isBuySpot && canBuy);
    buyButton.disabled = !canBuy;

    endTurnButton.textContent = getTranslation(isOver ? TranslationKey.NEW_GAME : TranslationKey.END_TURN);
    // Ending a turn is one step among many; starting the next run is the whole screen.
    endTurnButton.classList.toggle(CssClass.PRIMARY, outOfWater && !isOver);
    endTurnButton.classList.toggle(CssClass.PRIMARY_HIGHLIGHT, isOver);
    endTurnButton.classList.toggle(CssClass.HINT, needsIncome || isOver);
  }

  /**
   * One element per beam, laid out in percentages of the board so it follows MAP_SIZE and
   * the responsive board width on its own. A lit beam runs the full two tiles to its
   * rainbow; an unlit one stops halfway, inside the fountain that swallowed the light.
   * Every beam is safe to draw — only a revealed glower casts one in the first place.
   */
  function renderBeams() {
    beamLayer.replaceChildren(
      ...map.beams.map(({ x, y, dx, dy, isLit }) => {
        const element = createElement({ cssClass: [styles.beam, isLit ? "" : styles.unlit] });
        const tileSize = 100 / MAP_SIZE; // one tile as a percentage of the board

        element.style.left = `${(x + 0.5) * tileSize}%`;
        element.style.top = `${(y + 0.5) * tileSize}%`;
        // diagonals are longer by exactly the hypotenuse of a 1x1 tile
        element.style.width = `${(isLit ? 2 : 1) * Math.hypot(dx, dy) * tileSize}%`;
        element.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;

        return element;
      }),
    );
  }

  /** The info panel is one line: an emoji plus a "Name|Description" text. */
  function setInfo(key: TranslationKey, emoji: string) {
    const [name, description] = getTranslation(key).split("|");
    infoEmoji.textContent = emoji;
    infoName.textContent = name; // empty for the hint, which has no name
    infoText.textContent = description;
  }

  /** Whatever the player tapped explains itself — an object, bare ground, or the fog. */
  function showInfo(index?: number) {
    const objectType = index === undefined ? undefined : getObject(index);
    // with nothing picked up, the opening turn spells out what the run is about;
    // from then on the nudge to tap around is enough
    const isOpening = map.turn === FIRST_TURN;

    // Standing on a donut, the portal is what there is to act on — it takes the line over
    // the character's own description, right beside the button that uses it.
    if (portalTarget) setInfo(TranslationKey.INFO_DONUT, OBJECT_CONFIG[GameObjectType.DONUT].emoji);
    else if (isBuySpot) setInfo(TranslationKey.INFO_BUY, HEART_EMOJI);
    else if (objectType !== undefined) setInfo(OBJECT_CONFIG[objectType].info, OBJECT_CONFIG[objectType].emoji);
    else if (index === undefined)
      setInfo(
        isOpening ? TranslationKey.INFO_GOAL : TranslationKey.INFO_HINT,
        isOpening ? OBJECT_CONFIG[GameObjectType.RAINBOW].emoji : HINT_EMOJI,
      );
    else if (map.tiles[index].isRevealed) setInfo(TranslationKey.INFO_EMPTY, EMPTY_EMOJI);
    else setInfo(TranslationKey.INFO_FOG, FOG_EMOJI);
  }

  /** What is visible on a tile — the living layer wins, the ground object stays underneath. */
  function getObject(index: number): GameObjectType | undefined {
    const tile = map.tiles[index];
    return tile.isRevealed ? (tile.living ?? tile.object) : undefined;
  }

  /** Selection is "what the player is looking at" — the info panel follows it exactly. */
  function select(position?: Position) {
    selected = position;
    const index = position && getIndex(position);
    // A character still under the fog is not a character yet: its tile stays plain fog to
    // the player, so tapping it can never pick it up, light up its steps, or offer it the
    // portal — any of which would give away that something is hiding there.
    const tile = index === undefined ? undefined : map.tiles[index];
    const isCharacter = !!tile?.isRevealed && tile.living !== undefined;
    // Steps only light up for a character that can afford them, and affordability is now
    // per target rather than per character: with an empty purse a step onto a flower is
    // still on, and it is exactly then that it matters most. Scenery, a blocked-in
    // character and one that can afford none of its steps all end up with no targets,
    // which is what render() draws as the neutral selection.
    targets = isCharacter ? getMoveTargets(map, position!).filter((target) => getMoveCost(map, target) <= map.drops) : [];
    // only a character can take the portal, and only from the donut it is standing on
    portalTarget = isCharacter ? getPortalTarget(map, position!) : undefined;
    // Offered on the start field as soon as the candy is there, even when the field is
    // occupied — the button then shows up disabled, which is what says "clear it first".
    isBuySpot = index === START_INDEX && map.candy >= CANDY_PRICE;
    showInfo(index); // reads portalTarget, so it comes last
  }

  function onTileClick(index: number) {
    if (!isRunning || index < 0) return;

    if (targets.some((target) => getIndex(target) === index)) {
      move(getPosition(index));
    } else {
      // every tile can be picked up and explains itself, fog and bare ground included;
      // tapping the selected one again drops it and the panel falls back to its hint
      select(index === (selected && getIndex(selected)) ? undefined : getPosition(index));
      render();
    }
  }

  /** One step at whatever that step costs, or — at the portal's price — a jump straight to the far donut. */
  function move(target: Position, cost = getMoveCost(map, target)) {
    map.drops -= cost;
    moveCharacter(map, selected!, target);

    const previousRainbowCount = map.rainbowCount;
    revealAround(map, target);
    updateRainbows(map);
    // after the fog lifts, so a step into the unknown still reads its own tile
    select(target); // stays selected, so walking on is a single tap per step
    render();

    if (map.rainbowCount > previousRainbowCount) pubSubService.publish(PubSubEvent.STAR_COLLECT);
  }

  /** Trades the jar of candy for a unicorn on the start field, then hands the board back. */
  function buy() {
    buyUnicorn(map);
    select(selected); // the offer is spent and the field taken, so the panel has to follow
    render();

    pubSubService.publish(PubSubEvent.STAR_COLLECT);
  }

  /**
   * Closes the turn: the board pays out, the turn counter moves on, and the run ends if that
   * was the last one. A board that has seized up ends the run early — every remaining turn
   * would be identical, so there is nothing to play out.
   */
  function finishTurn() {
    endTurn(map);
    select(selected); // steps that were unaffordable a moment ago may be back
    render();

    if (isRunOver(map) || isStuck(map)) endGame(!isStuck(map));
  }

  /**
   * The result takes over the info panel and the turn button — no dialog on top of the board.
   * `hasFinished` separates the two ways a run can end: playing all twenty turns out, or the
   * board seizing up before that. Both report the same score; only the first is celebrated.
   */
  function endGame(hasFinished: boolean) {
    isRunning = false;
    select(undefined); // drops the board highlights; the panel now carries the result
    setInfo(hasFinished ? TranslationKey.WON : TranslationKey.LOST, hasFinished ? WIN_EMOJI : LOSE_EMOJI);
    infoText.textContent += ` ${getScore(map)}`; // both texts end ready for the number
    // The total above, its working below: one line per category showing what was counted,
    // what each was worth and what it came to. The emoji is a span of its own — the digits
    // beside it must not be rendered in the emoji font.
    scoreBoard.replaceChildren(
      ...getScoreParts(map).map(([count, weight], index) =>
        createElement({}, [
          createElement({ tag: "span", cssClass: CssClass.EMOJI, text: SCORE_EMOJIS[index] }),
          ` ${count} × ${weight} = ${count * weight}`,
        ]),
      ),
    );
    render();

    pubSubService.publish(PubSubEvent.GAME_END, { isWon: hasFinished });
  }

  // Passing a seed replays exactly that map; leaving it out deals a new one. Replaying the
  // map just played needs no snapshot — only remembering the number it was built from.
  function startNewGame(seed = createSeed()) {
    map = createGameMap(seed);
    scoreBoard.replaceChildren(); // last run's working, gone before the new board shows
    isRunning = true; // before render(), which reads it for the turn button
    select(undefined);
    render();
    applyZoom(true); // the map row can only be measured once it is on the page, so not before here

    pubSubService.publish(PubSubEvent.GAME_START);
  }

  return [hostElement, startNewGame, status];
}
