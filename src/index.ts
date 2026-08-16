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
import { LaunchScreenComponent } from "./components/launch-screen/launch-screen.component";

if (HAS_VISUAL_NICE_TO_HAVES) {
  import("./globals.nice2have.scss");
}

const initializeMuted = getLocalStorageItem(LocalStorageKey.MUTED) === "true";

let isInitialized = false;

function init() {
  if (isInitialized) return;
  isInitialized = true;

  const [gameArea, startNewGame, headerControls] = GameMapComponent(() => showLaunchScreen(true));
  const launchScreen = LaunchScreenComponent((size) => {
    // Shown before the run starts, or applyZoom would be measuring a hidden map row and
    // every board would open at the wrong step.
    showLaunchScreen(false);
    startNewGame(size);
  });

  // The launch screen and the board take turns in the same row under the header, so whichever
  // is up has the whole window. What the run lends the header — its counters and its zoom —
  // belongs to the run rather than to the header, and goes with the board: neither has
  // anything to say before one is being played.
  function showLaunchScreen(show: boolean) {
    gameArea.classList.toggle(CssClass.HIDDEN, show);
    headerControls.classList.toggle(CssClass.HIDDEN, show);
    launchScreen.classList.toggle(CssClass.HIDDEN, !show);
  }

  // the run's controls sit in the header rather than over the board, so they can never cover
  // a tile; the chip among them takes itself out of the flow and centres — see its styles
  document.body.append(HeaderComponent(GAME_EMOJI, GAME_TITLE, [headerControls, MuteButton()]), gameArea, launchScreen);

  showLaunchScreen(true);

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
