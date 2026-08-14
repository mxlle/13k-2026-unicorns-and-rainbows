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

export function GameMapComponent(): ComponentDefinition<undefined> {
  let map: GameMap;
  let isRunning = false;
  let endDialog: Dialog | undefined;
  // Two-tap navigation: tap a character to select it, then tap one of its
  // highlighted neighbours to move there.
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

  const hostElement = createElement({ cssClass: styles.host }, [board, turnBar]);

  function render() {
    const selectedIndex = selected && getIndex(selected);
    const targetIndices = targets.map(getIndex);

    map.tiles.forEach((tile, index) => {
      const element = tileElements[index];
      // living layer wins the tile — the ground object stays on the map underneath
      const objectType = tile.living ?? tile.object;
      element.classList.toggle(styles.revealed, tile.isRevealed);
      element.classList.toggle(styles.character, isSelectable(index));
      element.classList.toggle(styles.selected, index === selectedIndex);
      element.classList.toggle(styles.target, targetIndices.includes(index));
      element.textContent = tile.isRevealed ? (objectType === undefined ? "" : OBJECT_CONFIG[objectType].emoji) : FOG_EMOJI;
    });

    turnCounter.textContent = TURN_EMOJI + map.turn;
    purse.textContent = COIN_EMOJI + map.coins;
    goal.textContent = `${OBJECT_CONFIG[GameObjectType.RAINBOW].emoji}${map.rainbowCount}/${RAINBOW_GOAL}`;
    // an empty purse makes ending the turn the only way on — highlight it as the next step
    endTurnButton.classList.toggle(CssClass.PRIMARY, map.coins < MOVE_COST);
  }

  /** A character can be picked up only where it is actually visible. */
  function isSelectable(index: number): boolean {
    const tile = map.tiles[index];
    return tile.isRevealed && tile.living !== undefined;
  }

  function select(position?: Position) {
    selected = position;
    // an empty purse buys no steps, so nothing lights up until the next income
    targets = position && map.coins >= MOVE_COST ? getMoveTargets(map, position) : [];
  }

  function onTileClick(index: number) {
    if (!isRunning || index < 0) return;

    if (selected && targets.some((target) => getIndex(target) === index)) {
      move(getPosition(index));
    } else {
      // tapping a character selects it, tapping it again (or anywhere else) clears the selection
      select(isSelectable(index) && index !== (selected && getIndex(selected)) ? getPosition(index) : undefined);
      render();
    }
  }

  function move(target: Position) {
    map.coins -= MOVE_COST;
    moveCharacter(map, selected!, target);
    select(target); // stays selected, so walking on is a single tap per step

    const previousRainbowCount = map.rainbowCount;
    revealAround(map, target);
    updateRainbows(map);
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
