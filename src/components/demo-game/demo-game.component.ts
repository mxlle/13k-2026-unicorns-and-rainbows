import styles from "./demo-game.module.scss";
import { createButton, createElement } from "../../utils/html-utils";
import { ComponentDefinition, Direction } from "../../types";
import { PubSubEvent, pubSubService } from "../../utils/pub-sub-service";
import { CssClass } from "../../utils/css-class";
import { getRandomIntFromInterval } from "../../utils/random-utils";
import { getTranslation } from "../../translations/i18n";
import { TranslationKey } from "../../translations/translationKey";
import { createDialog, Dialog } from "../../framework/components/dialog/dialog";

// Placeholder game: move the unicorn to collect all 3 rainbows while avoiding
// the storm cloud. Replace with the real game, but keep the GAME_START / GAME_END events —
// index.ts (sounds, poki hooks) relies on them, and STAR_COLLECT drives the
// coin pickup sound.

const BOARD_SIZE = 5;
const RAINBOW_COUNT = 3;

interface Position {
  x: number;
  y: number;
}

interface Rainbow {
  position: Position;
  element: HTMLElement;
}

export function DemoGameComponent(): ComponentDefinition<undefined> {
  let unicornPosition: Position;
  let cloudPosition: Position;
  let rainbows: Rainbow[];
  let collected: number;
  let isRunning = false;
  let endDialog: Dialog | undefined;

  const unicornElement = createElement({ text: "🦄", cssClass: [styles.entity, CssClass.EMOJI] });
  const cloudElement = createElement({ text: "🌩️", cssClass: [styles.entity, CssClass.EMOJI] });
  const board = createElement({ cssClass: styles.board }, [cloudElement, unicornElement]);

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

  function placeEntity(element: HTMLElement, position: Position) {
    element.style.translate = `${position.x * 100}% ${position.y * 100}%`;
  }

  function samePosition(a: Position, b: Position) {
    return a.x === b.x && a.y === b.y;
  }

  function randomFreePosition(occupied: Position[]): Position {
    let position: Position;
    do {
      position = { x: getRandomIntFromInterval(0, BOARD_SIZE - 1), y: getRandomIntFromInterval(0, BOARD_SIZE - 1) };
    } while (occupied.some((p) => samePosition(p, position)));
    return position;
  }

  function endGame(isWon: boolean, translationKey: TranslationKey) {
    isRunning = false;
    pubSubService.publish(PubSubEvent.GAME_END, { isWon });

    endDialog?.destroy();
    endDialog = createDialog(createElement({ text: getTranslation(translationKey) }), () => startNewGame());
    void endDialog.open();
  }

  function move(direction: Direction) {
    if (!isRunning) return;

    const delta: Record<Direction, Position> = {
      [Direction.UP]: { x: 0, y: -1 },
      [Direction.DOWN]: { x: 0, y: 1 },
      [Direction.LEFT]: { x: -1, y: 0 },
      [Direction.RIGHT]: { x: 1, y: 0 },
    };

    unicornPosition = {
      x: Math.min(BOARD_SIZE - 1, Math.max(0, unicornPosition.x + delta[direction].x)),
      y: Math.min(BOARD_SIZE - 1, Math.max(0, unicornPosition.y + delta[direction].y)),
    };
    placeEntity(unicornElement, unicornPosition);

    if (samePosition(unicornPosition, cloudPosition)) {
      endGame(false, TranslationKey.LOST);
      return;
    }

    const rainbow = rainbows.find((r) => r.element.isConnected && samePosition(r.position, unicornPosition));
    if (rainbow) {
      rainbow.element.remove();
      collected++;
      pubSubService.publish(PubSubEvent.STAR_COLLECT);

      if (collected === RAINBOW_COUNT) {
        endGame(true, TranslationKey.WON);
      }
    }
  }

  document.addEventListener("keydown", (event) => {
    const direction = {
      "ArrowUp": Direction.UP,
      "ArrowDown": Direction.DOWN,
      "ArrowLeft": Direction.LEFT,
      "ArrowRight": Direction.RIGHT,
    }[event.key];

    if (direction !== undefined) {
      event.preventDefault();
      move(direction);
    }
  });

  function startNewGame() {
    rainbows?.forEach((r) => r.element.remove());

    unicornPosition = { x: 0, y: 0 };
    const occupied: Position[] = [unicornPosition];

    cloudPosition = randomFreePosition(occupied);
    occupied.push(cloudPosition);

    rainbows = Array.from({ length: RAINBOW_COUNT }, () => {
      const position = randomFreePosition(occupied);
      occupied.push(position);
      const element = createElement({ text: "🌈", cssClass: [styles.entity, CssClass.EMOJI] });
      placeEntity(element, position);
      board.append(element);
      return { position, element };
    });

    collected = 0;
    placeEntity(unicornElement, unicornPosition);
    placeEntity(cloudElement, cloudPosition);
    isRunning = true;

    pubSubService.publish(PubSubEvent.GAME_START);
  }

  return [hostElement, startNewGame];
}
