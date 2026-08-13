import styles from "./game-map.module.scss";
import { createButton, createElement, createElements } from "../../utils/html-utils";
import { ComponentDefinition, Direction } from "../../types";
import { PubSubEvent, pubSubService } from "../../utils/pub-sub-service";
import { CssClass } from "../../utils/css-class";
import { getTranslation } from "../../translations/i18n";
import { TranslationKey } from "../../translations/translationKey";
import { createDialog, Dialog } from "../../framework/components/dialog/dialog";
import { createGameMap, GameMap, isWon, MAP_SIZE, moveUnicorn, revealAroundUnicorn } from "../../game/game-map";
import { OBJECT_CONFIG } from "../../game/game-objects";

const FOG_EMOJI = "☁️";

export function GameMapComponent(): ComponentDefinition<undefined> {
  let map: GameMap;
  let isRunning = false;
  let endDialog: Dialog | undefined;

  const tileElements = createElements({ cssClass: [styles.tile, CssClass.EMOJI] }, MAP_SIZE * MAP_SIZE);
  const board = createElement({ cssClass: styles.board }, tileElements);
  board.style.setProperty("--s", String(MAP_SIZE)); // keeps MAP_SIZE the single source of truth

  const moveButtons: [string, Direction][] = [
    ["⬆️", Direction.UP],
    ["⬅️", Direction.LEFT],
    ["➡️", Direction.RIGHT],
    ["⬇️", Direction.DOWN],
  ];
  const controls = createElement(
    { cssClass: styles.controls },
    moveButtons.map(([icon, direction]) =>
      createButton({ text: icon, cssClass: [CssClass.ICON_BTN, CssClass.EMOJI], onClick: () => move(direction) }),
    ),
  );

  const hostElement = createElement({ cssClass: styles.host }, [board, controls]);

  function render() {
    map.tiles.forEach((tile, index) => {
      const element = tileElements[index];
      // living layer wins the tile — the ground object stays on the map underneath
      const objectType = tile.living ?? tile.object;
      element.classList.toggle(styles.revealed, tile.isRevealed);
      element.textContent = tile.isRevealed ? (objectType === undefined ? "" : OBJECT_CONFIG[objectType].emoji) : FOG_EMOJI;
    });
  }

  function endGame() {
    isRunning = false;
    pubSubService.publish(PubSubEvent.GAME_END, { isWon: true });

    endDialog?.destroy();
    endDialog = createDialog(createElement({ text: getTranslation(TranslationKey.WON) }), () => startNewGame());
    void endDialog.open();
  }

  function move(direction: Direction) {
    if (!isRunning || !moveUnicorn(map, direction)) return;

    const newlyFoundRainbows = revealAroundUnicorn(map);
    render();

    if (newlyFoundRainbows) pubSubService.publish(PubSubEvent.STAR_COLLECT);
    if (isWon(map)) endGame();
  }

  document.addEventListener("keydown", (event) => {
    const direction = {
      "ArrowUp": Direction.UP,
      "ArrowDown": Direction.DOWN,
      "ArrowLeft": Direction.LEFT,
      "ArrowRight": Direction.RIGHT,
      "w": Direction.UP,
      "s": Direction.DOWN,
      "a": Direction.LEFT,
      "d": Direction.RIGHT,
    }[event.key];

    if (direction !== undefined) {
      event.preventDefault();
      move(direction);
    }
  });

  function startNewGame() {
    map = createGameMap();
    render();
    isRunning = true;

    pubSubService.publish(PubSubEvent.GAME_START);
  }

  return [hostElement, startNewGame];
}
