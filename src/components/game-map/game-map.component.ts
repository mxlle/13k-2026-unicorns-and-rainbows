import styles from "./game-map.module.scss";
import { createButton, createElement, createElements } from "../../utils/html-utils";
import { ComponentDefinition } from "../../types";
import { PubSubEvent, pubSubService } from "../../utils/pub-sub-service";
import { CssClass } from "../../utils/css-class";
import { getTranslation } from "../../translations/i18n";
import { TranslationKey } from "../../translations/translationKey";
import {
  createGameMap,
  GameMap,
  getIndex,
  getMoveTargets,
  getPosition,
  isLost,
  isWon,
  MAP_SIZE,
  moveCharacter,
  MOVE_COST,
  Position,
  RAINBOW_GOAL,
  revealAround,
  startTurn,
  updateRainbows,
} from "../../game/game-map";
import { GameObjectType, OBJECT_CONFIG } from "../../game/game-objects";

const FOG_EMOJI = "☁️";
const COIN_EMOJI = "🪙";
const TURN_EMOJI = "⏳";
// Stand-ins for the object emoji in the info panel, for the things that are not objects.
const HINT_EMOJI = "👆";
const EMPTY_EMOJI = "🌱";
const WIN_EMOJI = "🎉";
const LOSE_EMOJI = "😢";
const FIRST_TURN = 1; // the opening turn is the only one that hints "pick up a character"

export function GameMapComponent(): ComponentDefinition<undefined> {
  let map: GameMap;
  let isRunning = false;
  // Two-tap navigation: tap an object to select it, then — if it is a character that
  // can afford a step — tap one of its highlighted neighbours to move there.
  let selected: Position | undefined;
  let targets: Position[] = [];

  const tileElements = createElements({ cssClass: [styles.tile, CssClass.EMOJI] }, MAP_SIZE * MAP_SIZE);
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

  // PLACEHOLDER turn bar: turn count, purse and goal on the left, end-turn button on the right
  // Only the emoji gets the emoji font — digits inside it would render as emoji glyphs too.
  const turnCounter = createElement({ tag: "span" });
  const purse = createElement({ tag: "span" });
  const goal = createElement({ tag: "span" });
  const counter = (emoji: string, value: HTMLElement) =>
    createElement({ cssClass: styles.count }, [createElement({ tag: "span", cssClass: CssClass.EMOJI, text: emoji }), value]);
  // One button for both ends of a run: end the turn while playing, start over once it is over.
  const endTurnButton = createButton({ onClick: () => (isRunning ? endTurn() : startNewGame()) });
  const turnBar = createElement({ cssClass: styles.turnBar }, [
    counter(TURN_EMOJI, turnCounter),
    counter(COIN_EMOJI, purse),
    counter(OBJECT_CONFIG[GameObjectType.RAINBOW].emoji, goal),
    endTurnButton,
  ]);

  // Object info: a permanent row of its own between map and turn bar, so it can never
  // cover the board and never shifts it either. Empty selection shows a hint instead.
  // Spans, not divs: emoji, name and description flow as one wrapping line of text.
  const infoEmoji = createElement({ tag: "span", cssClass: [styles.infoEmoji, CssClass.EMOJI] });
  const infoName = createElement({ tag: "span", cssClass: styles.infoName });
  const infoText = createElement({ tag: "span" });
  const infoPanel = createElement({ cssClass: styles.info }, [createElement({}, [infoEmoji, infoName, infoText])]);

  // The board keeps its size whatever the screen does; this row scrolls to reach it.
  const mapArea = createElement({ cssClass: styles.mapArea }, [board]);
  const hostElement = createElement({ cssClass: styles.host }, [mapArea, infoPanel, turnBar]);

  function render() {
    const selectedIndex = selected && getIndex(selected);
    const targetIndices = targets.map(getIndex);
    // Guidance: an empty purse makes the income the only way on, so ending the turn
    // becomes the next step. Before that, on the opening turn, it is picking a character.
    // Once the run is over the same button is the only thing left to press.
    const needsIncome = map.coins < MOVE_COST;
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
      element.textContent = tile.isRevealed ? (objectType === undefined ? "" : OBJECT_CONFIG[objectType].emoji) : FOG_EMOJI;
    });

    turnCounter.textContent = `${map.turn}`;
    purse.textContent = `${map.coins}`;
    goal.textContent = `${map.rainbowCount}/${RAINBOW_GOAL}`;
    renderBeams();

    endTurnButton.textContent = getTranslation(isOver ? TranslationKey.NEW_GAME : TranslationKey.END_TURN);
    endTurnButton.classList.toggle(CssClass.PRIMARY, needsIncome || isOver);
    endTurnButton.classList.toggle(CssClass.HINT, needsIncome || isOver);
  }

  /**
   * One element per beam, laid out in percentages of the board so it follows MAP_SIZE and
   * the responsive board width on its own. A lit beam runs the full two tiles to its
   * rainbow; an unlit one stops halfway, inside the fountain that swallowed the light.
   * Beams from a glower still under the fog are left out — they would give its position away.
   */
  function renderBeams() {
    beamLayer.replaceChildren(
      ...map.beams
        .filter((beam) => map.tiles[getIndex(beam)].isRevealed)
        .map(({ x, y, dx, dy, isLit }) => {
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

    if (objectType !== undefined) setInfo(OBJECT_CONFIG[objectType].info, OBJECT_CONFIG[objectType].emoji);
    else if (index === undefined) setInfo(TranslationKey.INFO_HINT, HINT_EMOJI);
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
    // Steps only light up for a character that can afford one. Scenery, a blocked-in
    // character and one with an empty purse all end up with no targets, which is what
    // render() draws as the neutral selection.
    targets = index !== undefined && map.coins >= MOVE_COST && map.tiles[index].living !== undefined ? getMoveTargets(map, position!) : [];
    showInfo(index);
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

  function move(target: Position) {
    map.coins -= MOVE_COST;
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

  function startNewGame() {
    map = createGameMap();
    startTurn(map); // the sun's two rainbows are the opening purse
    isRunning = true; // before render(), which reads it for the turn button
    select(undefined);
    render();

    pubSubService.publish(PubSubEvent.GAME_START);
  }

  return [hostElement, startNewGame];
}
