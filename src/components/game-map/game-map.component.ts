import styles from "./game-map.module.scss";
import { createButton, createElement, createElements } from "../../utils/html-utils";
import { PubSubEvent, pubSubService } from "../../utils/pub-sub-service";
import { CssClass } from "../../utils/css-class";
import { getTranslation } from "../../translations/i18n";
import { TranslationKey } from "../../translations/translationKey";
import {
  canUsePortal,
  createGameMap,
  createSeed,
  GameMap,
  getIndex,
  getMoveTargets,
  getPortalTarget,
  getPosition,
  isLost,
  isWon,
  MAP_SIZE,
  moveCharacter,
  MOVE_COST,
  PORTAL_COST,
  Position,
  RAINBOW_GOAL,
  revealAround,
  startTurn,
  updateRainbows,
} from "../../game/game-map";
import { GameObjectType, OBJECT_CONFIG } from "../../game/game-objects";

const FOG_EMOJI = "☁️";
const DROP_EMOJI = "💧";
const TURN_EMOJI = "⏳";
// PLACEHOLDER: how many drops the purse still draws one by one. Above that it falls
// back to "💧n" — a pip row long enough to fill the header would crowd out the title.
const MAX_PIPS = 8;
const DROP_SPEND_MS = 500; // keep in sync with $drop-spend-duration in the stylesheet
// Stand-ins for the object emoji in the info panel, for the things that are not objects.
const HINT_EMOJI = "👆";
const EMPTY_EMOJI = "🌱";
const WIN_EMOJI = "🎉";
const LOSE_EMOJI = "😢";
const FIRST_TURN = 1; // the opening turn is the only one that hints "pick up a character"

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
  const goal = createElement({ tag: "span" });
  const counter = (emoji: string, value: HTMLElement) =>
    createElement({ cssClass: styles.count }, [createElement({ tag: "span", cssClass: CssClass.EMOJI, text: emoji }), value]);
  // The purse is drawn as one drop per step the player can still take, so the cost of a
  // step needs no number anywhere. One element per drop, so a single one can be animated.
  const dropPips = createElement({ tag: "span", cssClass: CssClass.EMOJI });
  const dropCount = createElement({ tag: "span" }); // only used past MAX_PIPS
  const purse = createElement({ cssClass: [styles.count, styles.purse] }, [dropPips, dropCount]);
  purse.style.setProperty("--n", `${MAX_PIPS}`); // its slot is as wide as a full purse
  // One button for both ends of a run: end the turn while playing, start over once it is over.
  const endTurnButton = createButton({ onClick: () => (isRunning ? endTurn() : startNewGame()) });
  const turnBar = createElement({ cssClass: styles.turnBar }, [counter(TURN_EMOJI, turnCounter), endTurnButton]);
  // What the run is about — drops to spend and rainbows still needed — as one chip in the
  // middle of the header, in view wherever the player is looking. Its width never changes
  // (the purse holds a fixed slot), so the chip stays put as drops come and go.
  const status = createElement({ cssClass: styles.status }, [purse, counter(OBJECT_CONFIG[GameObjectType.RAINBOW].emoji, goal)]);

  // Object info: a permanent row of its own between map and turn bar, so it can never
  // cover the board and never shifts it either. Empty selection shows a hint instead.
  // Spans, not divs: emoji, name and description flow as one wrapping line of text.
  const infoEmoji = createElement({ tag: "span", cssClass: [styles.infoEmoji, CssClass.EMOJI] });
  const infoName = createElement({ tag: "span", cssClass: styles.infoName });
  const infoText = createElement({ tag: "span" });
  // The portal action sits in the same line that explains it, so the offer and the
  // description arrive together. Hidden unless the selection is standing on a donut.
  const jumpButton = createButton({ cssClass: [CssClass.SECONDARY, styles.jump], onClick: () => move(portalTarget!, PORTAL_COST) }, [
    createElement({ tag: "span", cssClass: CssClass.EMOJI, text: OBJECT_CONFIG[GameObjectType.DONUT].emoji }),
    ` ${getTranslation(TranslationKey.JUMP)}`,
  ]);
  const infoPanel = createElement({ cssClass: styles.info }, [createElement({}, [infoEmoji, infoName, infoText, jumpButton])]);

  // The board keeps its size whatever the screen does; this row scrolls to reach it.
  const mapArea = createElement({ cssClass: styles.mapArea }, [board]);
  const hostElement = createElement({ cssClass: styles.host }, [mapArea, infoPanel, turnBar]);

  function render() {
    const selectedIndex = selected && getIndex(selected);
    const targetIndices = targets.map(getIndex);
    // Guidance: an empty purse makes the income the only way on, so ending the turn
    // becomes the next step. Before that, on the opening turn, it is picking a character.
    // Once the run is over the same button is the only thing left to press.
    const needsIncome = map.drops < MOVE_COST;
    const isOver = !isRunning;
    const hintCharacters = !isOver && !needsIncome && !selected && map.turn === FIRST_TURN;

    map.tiles.forEach((tile, index) => {
      const element = tileElements[index];
      const objectType = getObject(index);
      const isSelectedTile = index === selectedIndex;
      element.classList.toggle(styles.revealed, tile.isRevealed);
      element.classList.toggle(styles.glowing, objectType !== undefined && OBJECT_CONFIG[objectType].glows);
      element.classList.toggle(CssClass.HINT, hintCharacters && tile.isRevealed && tile.living !== undefined);
      element.classList.toggle(styles.selected, isSelectedTile);
      // no steps lit means the selection is only being looked at — see select()
      element.classList.toggle(styles.neutral, isSelectedTile && !targets.length);
      element.classList.toggle(styles.target, targetIndices.includes(index));

      // The fog belongs to the ground layer: under it there is nothing else to show.
      const hasLiving = tile.isRevealed && tile.living !== undefined;
      const ground = groundGlyphs[index];
      // guarded on isRevealed, or the fog cloud hiding a tree would be turned instead
      ground.classList.toggle(styles.tree, tile.isRevealed && tile.object === GameObjectType.TREE);
      ground.classList.toggle(styles.covered, hasLiving); // steps back behind the character
      ground.textContent = tile.isRevealed ? (tile.object === undefined ? "" : OBJECT_CONFIG[tile.object].emoji) : FOG_EMOJI;

      const living = livingGlyphs[index];
      // only makes room when there is actually something underneath to show
      living.classList.toggle(styles.stacked, hasLiving && tile.object !== undefined);
      living.textContent = hasLiving ? OBJECT_CONFIG[tile.living!].emoji : "";
    });

    turnCounter.textContent = `${map.turn}`;
    goal.textContent = `${map.rainbowCount}/${RAINBOW_GOAL}`;
    renderPurse();
    renderBeams();

    // Offered wherever the character stands, but greyed out when it cannot be paid for or
    // somebody else is already standing on the far donut.
    jumpButton.classList.toggle(CssClass.HIDDEN, !portalTarget);
    jumpButton.classList.toggle(CssClass.HINT, !!portalTarget && canUsePortal(map, portalTarget));
    jumpButton.disabled = !portalTarget || !canUsePortal(map, portalTarget);

    endTurnButton.textContent = getTranslation(isOver ? TranslationKey.NEW_GAME : TranslationKey.END_TURN);
    // Ending a turn is one step among many; starting the next run is the whole screen.
    endTurnButton.classList.toggle(CssClass.PRIMARY, needsIncome && !isOver);
    endTurnButton.classList.toggle(CssClass.PRIMARY_HIGHLIGHT, isOver);
    endTurnButton.classList.toggle(CssClass.HINT, needsIncome || isOver);
  }

  /**
   * The purse is reconciled, not rewritten: drops that stay keep their element, so only
   * what actually changed moves. Earned drops rain in one after the other (the stagger is
   * a CSS delay per new drop), a spent one leaves the row at once and falls out below it.
   */
  function renderPurse() {
    const asPips = map.drops <= MAX_PIPS;
    dropCount.textContent = asPips ? "" : `${map.drops}`;
    const wanted = asPips ? map.drops : 1; // past MAX_PIPS a single drop labels the number
    // drops already on their way out do not count — their place in the row is gone
    const shown = ([...dropPips.children] as HTMLElement[]).filter((pip) => !pip.classList.contains(styles.spent));

    for (let i = shown.length; i < wanted; i++) {
      const pip = createElement({ tag: "span", cssClass: styles.pip, text: DROP_EMOJI });
      pip.style.setProperty("--i", `${i - shown.length}`); // its place in the stagger
      dropPips.append(pip);
    }

    // Spending takes the last drops off the row. Every position is measured first: a drop
    // that has already left the flow would pull the next one along and mismeasure it.
    const spent = shown.slice(wanted).map((pip) => [pip, pip.offsetLeft, pip.offsetTop] as const);

    spent.forEach(([pip, left, top]) => {
      pip.style.left = `${left}px`; // pinned where it stood, so leaving the flow does not move it
      pip.style.top = `${top}px`;
      pip.classList.add(styles.spent);
      // not "animationend": with prefers-reduced-motion the animation never runs and the
      // drop would be stranded on top of the header forever
      setTimeout(() => pip.remove(), DROP_SPEND_MS);
    });
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
    const isCharacter = index !== undefined && map.tiles[index].living !== undefined;
    // Steps only light up for a character that can afford one. Scenery, a blocked-in
    // character and one with an empty purse all end up with no targets, which is what
    // render() draws as the neutral selection.
    targets = isCharacter && map.drops >= MOVE_COST ? getMoveTargets(map, position!) : [];
    // only a character can take the portal, and only from the donut it is standing on
    portalTarget = isCharacter ? getPortalTarget(map, position!) : undefined;
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

  /** One step, or — at the portal's price — a jump straight to the far donut. */
  function move(target: Position, cost = MOVE_COST) {
    map.drops -= cost;
    moveCharacter(map, selected!, target);

    const previousRainbowCount = map.rainbowCount;
    revealAround(map, target);
    updateRainbows(map);
    // after the fog lifts, so a step into the unknown still reads its own tile
    select(target); // stays selected, so walking on is a single tap per step
    render();

    if (map.rainbowCount > previousRainbowCount) pubSubService.publish(PubSubEvent.STAR_COLLECT);
    if (isWon(map)) endGame(true);
  }

  /** Collect the income, then hand the board back — a run only ever ends here or on a win. */
  function endTurn() {
    startTurn(map);
    select(selected); // steps that were unaffordable a moment ago may be back
    render();

    if (isLost(map)) endGame(false);
  }

  /** The result takes over the info panel and the turn button — no dialog on top of the board. */
  function endGame(hasWon: boolean) {
    isRunning = false;
    select(undefined); // drops the board highlights; the panel now carries the result
    setInfo(hasWon ? TranslationKey.WON : TranslationKey.LOST, hasWon ? WIN_EMOJI : LOSE_EMOJI);
    render();

    pubSubService.publish(PubSubEvent.GAME_END, { isWon: hasWon });
  }

  // Passing a seed replays exactly that map; leaving it out deals a new one. Replaying the
  // map just played needs no snapshot — only remembering the number it was built from.
  function startNewGame(seed = createSeed()) {
    map = createGameMap(seed);
    startTurn(map); // the sun's two rainbows are the opening purse
    isRunning = true; // before render(), which reads it for the turn button
    select(undefined);
    render();

    pubSubService.publish(PubSubEvent.GAME_START);
  }

  return [hostElement, startNewGame, status];
}
