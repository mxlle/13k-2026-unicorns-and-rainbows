import "./globals.scss";
import { PubSubEvent, pubSubService } from "./utils/pub-sub-service";
import { initPoki, pokiSdk } from "./poki-integration";
import { CssClass } from "./utils/css-class";
import { sleep } from "./utils/promise-utils";
import { initAudio } from "./audio/music-control";
import { getLocalStorageItem, LocalStorageKey, removeLocalStorageItem } from "./utils/local-storage";
import { GAME_TITLE, HAS_DEV_TOOLS, HAS_SIDE_CHOICE, HAS_VISUAL_NICE_TO_HAVES, IS_POKI_ENABLED } from "./env-utils";
import { initDarkSide } from "./utils/dark-side";
import { initSoundEffects, playSoundEffect } from "./audio/sound-control/sound-control-box";
import { SoundEffect } from "./audio/sound-control/sound-effect";
import { HeaderComponent } from "./framework/components/header/header.component";
import { AudioButtons } from "./components/audio-buttons/audio-buttons";
import { GameMapComponent } from "./components/game-map/game-map.component";
import { LaunchScreenComponent } from "./components/launch-screen/launch-screen.component";

if (HAS_VISUAL_NICE_TO_HAVES) {
  import("./globals.nice2have.scss");
}

// Before anything is built, so the page is already in the right palette when it is first
// painted rather than flipping into it. The script tag is the last thing in <body>, so there
// is a body to put the class on.
if (HAS_SIDE_CHOICE) initDarkSide();

const initializeMuted = getLocalStorageItem(LocalStorageKey.MUSIC_MUTED) === "true";

let isInitialized = false;

function init() {
  if (isInitialized) return;
  isInitialized = true;

  const [gameArea, startNewGame, headerControls] = GameMapComponent(() => showLaunchScreen(true));
  const [launchScreen, updateLaunchScreen, startPickedLevel] = LaunchScreenComponent((level, random) => {
    // Shown before the run starts, or applyZoom would be measuring a hidden map row and
    // every board would open at the wrong step.
    showLaunchScreen(false);
    startNewGame(level, random);
  });

  // The launch screen and the board take turns in the same row under the header, so whichever
  // is up has the whole window. What the run lends the header — its chip of counters — belongs
  // to the run rather than to the header, and goes with the board: neither has anything to say
  // before one is being played. The zoom steps are in there too, so they are hidden with it —
  // there is no board to look closer at until a run is up.
  function showLaunchScreen(show: boolean) {
    // Re-read on the way in: a run just walked away from has written its score to storage, and
    // the stripe it belongs to is what says so. The screen holds nothing of its own about a
    // level, so showing it and bringing it up to date are the same act.
    if (show) updateLaunchScreen();
    // Dev-only: and this screen is now the one to come back to. Written as the *absence* of a
    // level rather than as a name of its own, which is what makes the restore below one read.
    if (HAS_DEV_TOOLS && show) removeLocalStorageItem(LocalStorageKey.SCREEN);
    gameArea.classList.toggle(CssClass.HIDDEN, show);
    headerControls.classList.toggle(CssClass.HIDDEN, show);
    launchScreen.classList.toggle(CssClass.HIDDEN, !show);
  }

  // the run's counters sit in the header rather than over the board, so they can never cover
  // a tile; the chip takes itself out of the flow and centres — see its styles
  //
  // The audio toggles go in front of what the run lends the header, so the run's own controls
  // are the outermost thing at that end: the toggles are there whether or not a board is up and
  // keep their place when one appears, and the zoom steps end up next to the board they act on
  // rather than with a switch between them.
  document.body.append(HeaderComponent(GAME_TITLE, [...AudioButtons(), headerControls]), gameArea, launchScreen);

  // Dev-only: back to whatever was on the screen before the reload, which on a dev machine is
  // a board being looked at far more often than it is the launch screen. Read *before* the
  // launch screen goes up, since showing it is what clears the key — and the run is started
  // after it, so applyZoom still measures a visible map row (see showLaunchScreen).
  const lastScreen = HAS_DEV_TOOLS ? getLocalStorageItem(LocalStorageKey.SCREEN) : null;

  showLaunchScreen(true);

  if (lastScreen) {
    showLaunchScreen(false);
    startNewGame(+lastScreen);
  }

  pubSubService.subscribe(PubSubEvent.GAME_START, () => {
    document.body.classList.remove(CssClass.WON);

    if (IS_POKI_ENABLED) {
      pokiSdk?.gameplayStart();
    }
  });

  pubSubService.subscribe(PubSubEvent.GAME_END, (result) => {
    if (result.isWon) {
      document.body.classList.add(CssClass.WON);
    }

    playSoundEffect(result.isWon ? SoundEffect.WIN : SoundEffect.LOSE);

    if (IS_POKI_ENABLED) {
      sleep(300).then(() => pokiSdk?.gameplayStop()); // to avoid issue that stop is called before start
    }
  });

  // A first visit has nothing to choose between. Every rung is unplayed, the ladder is offering
  // the bottom one, and a menu is the wrong first thing to show somebody who has not seen the
  // game yet — so the picked rung opens by itself. Through the launch screen's own start, so it
  // steps up the ladder and stores the next rung exactly as a tap would: walking out of that
  // first run lands on the ladder with level 2 already on offer.
  // The stored rung is what says a level has ever been picked; it is written the moment one is.
  //
  // Last in init(), after the subscriptions: this starts a run, and a run that starts before
  // anything is listening is one GAME_START nobody hears — which on the poki build is a
  // gameplayStart the platform never gets.
  if (!getLocalStorageItem(LocalStorageKey.SIZE)) startPickedLevel();
}

// INIT
const initApp = async () => {
  init();
  await sleep(0); // to make it a real promise
  await initAudio(initializeMuted);
  await initSoundEffects();
};

if (IS_POKI_ENABLED) initPoki(initApp);
else initApp();
