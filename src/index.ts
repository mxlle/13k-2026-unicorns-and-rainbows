import "./globals.scss";
import { PubSubEvent, pubSubService } from "./utils/pub-sub-service";
import { initPoki, pokiSdk } from "./poki-integration";
import { CssClass } from "./utils/css-class";
import { sleep } from "./utils/promise-utils";
import { initAudio } from "./audio/music-control";
import { getLocalStorageItem, LocalStorageKey } from "./utils/local-storage";
import { GAME_EMOJI, GAME_TITLE, HAS_SIMPLE_SOUND_EFFECTS, HAS_VISUAL_NICE_TO_HAVES, IS_POKI_ENABLED } from "./env-utils";
import { coinSoundSrcUrl, initWinLoseSoundEffects, loseSoundSrcUrl, winSoundSrcUrl } from "./audio/sound-control/sound-control-box";
import { playSound } from "./audio/sound-control/sound-control";
import { HeaderComponent } from "./framework/components/header/header.component";
import { MuteButton } from "./components/mute-button/mute-button";
import { GameMapComponent } from "./components/game-map/game-map.component";

if (HAS_VISUAL_NICE_TO_HAVES) {
  import("./globals.nice2have.scss");
}

const initializeMuted = getLocalStorageItem(LocalStorageKey.MUTED) === "true";

let isInitialized = false;

function init() {
  if (isInitialized) return;
  isInitialized = true;

  const [gameArea, startNewGame, statusChip] = GameMapComponent();

  // the chip takes itself out of the flow and centres on the header — see its styles
  document.body.append(HeaderComponent(GAME_EMOJI, GAME_TITLE, [statusChip, MuteButton()]), gameArea);

  startNewGame();

  pubSubService.subscribe(PubSubEvent.GAME_START, () => {
    document.body.classList.remove(CssClass.WON);

    if (IS_POKI_ENABLED) {
      pokiSdk?.gameplayStart();
    }
  });

  if (HAS_SIMPLE_SOUND_EFFECTS) {
    pubSubService.subscribe(PubSubEvent.STAR_COLLECT, () => {
      coinSoundSrcUrl && playSound(coinSoundSrcUrl);
    });
  }

  pubSubService.subscribe(PubSubEvent.GAME_END, (result) => {
    if (result.isWon) {
      document.body.classList.add(CssClass.WON);
    }

    if (HAS_SIMPLE_SOUND_EFFECTS) {
      const soundEffect = result.isWon ? winSoundSrcUrl : loseSoundSrcUrl;
      soundEffect && playSound(soundEffect);
    }

    if (IS_POKI_ENABLED) {
      sleep(300).then(() => pokiSdk?.gameplayStop()); // to avoid issue that stop is called before start
    }
  });
}

// INIT
const initApp = async () => {
  init();
  await sleep(0); // to make it a real promise
  await initAudio(initializeMuted);
  HAS_SIMPLE_SOUND_EFFECTS && (await initWinLoseSoundEffects());
};

if (IS_POKI_ENABLED) initPoki(initApp);
else initApp();
