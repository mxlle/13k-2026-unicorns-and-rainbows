import styles from "./game-map.module.scss";
import { createButton, createElement, createElements } from "../../utils/html-utils";
import { ComponentDefinition } from "../../types";
import { PubSubEvent, pubSubService } from "../../utils/pub-sub-service";
import { CssClass } from "../../utils/css-class";
import { getTranslation } from "../../translations/i18n";
import { TranslationKey } from "../../translations/translationKey";
import { createDialog, Dialog } from "../../framework/components/dialog/dialog";
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
const FIRST_TURN = 1; // the opening turn is the only one that hints "pick up a character"

export function GameMapComponent(): ComponentDefinition<undefined> {
  let map: GameMap;
  let isRunning = false;
  let endDialog: Dialog | undefined;
  // Two-tap navigation: tap an object to select it, then — if it is a character that
  // can afford a step — tap one of its highlighted neighbours to move there.
  let selected: Position | undefined;
  let targets: Position[] = [];

  const tileElements = createElements({ cssClass: [styles.tile, CssClass.EMOJI] }, MAP_SIZE * MAP_SIZE);
  // one delegated listener instead of one per tile
  const board = createElement(
    { cssClass: styles.board, onClick: (event) => onTileClick(tileElements.indexOf(event.target)) },
    tileElements,
  );
  board.style.setProperty("--s", String(MAP_SIZE)); // keeps MAP_SIZE the single source of truth

  // PLACEHOLDER turn bar: turn count, purse and goal on the left, end-turn button on the right
  const turnCounter = createElement({ cssClass: [styles.count, CssClass.EMOJI] });
  const purse = createElement({ cssClass: [styles.count, CssClass.EMOJI] });
  const goal = createElement({ cssClass: [styles.count, CssClass.EMOJI] });
  const endTurnButton = createButton({ text: getTranslation(TranslationKey.END_TURN), onClick: endTurn });
  const turnBar = createElement({ cssClass: styles.turnBar }, [turnCounter, purse, goal, endTurnButton]);

  // Object info: hovers over the bottom of the map, just above the turn bar. It shares
  // the map's grid cell, so opening it overlays the board instead of shifting anything.
  const infoEmoji = createElement({ cssClass: [styles.infoEmoji, CssClass.EMOJI] });
  const infoName = createElement({ cssClass: styles.infoName });
  const infoText = createElement();
  const infoPanel = createElement({ cssClass: styles.info }, [infoEmoji, infoName, infoText]);

  // The board keeps its size whatever the screen does; this row scrolls to reach it.
  const mapArea = createElement({ cssClass: styles.mapArea }, [board]);
  const hostElement = createElement({ cssClass: styles.host }, [mapArea, infoPanel, turnBar]);

  function render() {
    const selectedIndex = selected && getIndex(selected);
    const targetIndices = targets.map(getIndex);
    // Guidance: an empty purse makes the income the only way on, so ending the turn
    // becomes the next step. Before that, on the opening turn, it is picking a character.
    const needsIncome = map.coins < MOVE_COST;
    const hintCharacters = !needsIncome && !selected && map.turn === FIRST_TURN;

    map.tiles.forEach((tile, index) => {
      const element = tileElements[index];
      const objectType = getObject(index);
      const isSelectedTile = index === selectedIndex;
      element.classList.toggle(styles.revealed, tile.isRevealed);
      element.classList.toggle(styles.character, objectType !== undefined);
      element.classList.toggle(CssClass.HINT, hintCharacters && tile.isRevealed && tile.living !== undefined);
      element.classList.toggle(styles.selected, isSelectedTile);
      // no steps lit means the selection is only being looked at — see select()
      element.classList.toggle(styles.neutral, isSelectedTile && !targets.length);
      element.classList.toggle(styles.target, targetIndices.includes(index));
      element.textContent = tile.isRevealed ? (objectType === undefined ? "" : OBJECT_CONFIG[objectType].emoji) : FOG_EMOJI;
    });

    turnCounter.textContent = TURN_EMOJI + map.turn;
    purse.textContent = COIN_EMOJI + map.coins;
    goal.textContent = `${OBJECT_CONFIG[GameObjectType.RAINBOW].emoji}${map.rainbowCount}/${RAINBOW_GOAL}`;
    endTurnButton.classList.toggle(CssClass.PRIMARY, needsIncome);
    endTurnButton.classList.toggle(CssClass.HINT, needsIncome);
  }

  /** Opens the info panel on an object, or folds it away when there is nothing to tell. */
  function showInfo(objectType?: GameObjectType) {
    infoPanel.classList.toggle(CssClass.HIDDEN, objectType === undefined);
    if (objectType === undefined) return;

    const config = OBJECT_CONFIG[objectType];
    const [name, description] = getTranslation(config.info).split("|");
    infoEmoji.textContent = config.emoji;
    infoName.textContent = name;
    infoText.textContent = description;
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
    showInfo(index === undefined ? undefined : getObject(index));
  }

  function onTileClick(index: number) {
    if (!isRunning || index < 0) return;

    if (targets.some((target) => getIndex(target) === index)) {
      move(getPosition(index));
    } else {
      // every visible object can be picked up and explains itself; tapping it again —
      // or tapping fog or bare ground — drops the selection and folds the panel away
      const isNew = getObject(index) !== undefined && index !== (selected && getIndex(selected));
      select(isNew ? getPosition(index) : undefined);
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
    if (!isRunning) return;

    startTurn(map);
    select(selected); // steps that were unaffordable a moment ago may be back
    render();

    if (isLost(map)) endGame(false);
  }

  function endGame(hasWon: boolean) {
    isRunning = false;
    pubSubService.publish(PubSubEvent.GAME_END, { isWon: hasWon });

    endDialog?.destroy();
    endDialog = createDialog(createElement({ text: getTranslation(hasWon ? TranslationKey.WON : TranslationKey.LOST) }), () =>
      startNewGame(),
    );
    void endDialog.open();
  }

  function startNewGame() {
    map = createGameMap();
    startTurn(map); // the sun's two rainbows are the opening purse
    select(undefined);
    render();
    isRunning = true;

    pubSubService.publish(PubSubEvent.GAME_START);
  }

  return [hostElement, startNewGame];
}
