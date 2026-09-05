import { candyCloudsSong as song } from "./songs/candy-clouds";
import { getLocalStorageItem, LocalStorageKey, setLocalStorageItem } from "../utils/local-storage";
import { PubSubEvent, pubSubService } from "../utils/pub-sub-service";
import { IS_POKI_ENABLED } from "../env-utils";
import { CPlayerSimple as CPlayer } from "./small-player-simple";
import type { SoundBoxPlayer } from "./player-interface";

let audioElem: HTMLAudioElement;
let isActive = false;
let initialized = false;
// The effects have their own switch, remembered on their own key. No autoplay dance for them:
// an effect only ever plays on the player's own tap.
let areEffectsOn = getLocalStorageItem(LocalStorageKey.SOUND_MUTED) !== "true";

export async function initAudio(initializeMuted: boolean) {
  const player = new CPlayer();
  player.init(song);

  await generateUntilDone(player);
  const wave = player.createWave();
  const src = URL.createObjectURL(new Blob([wave], { type: "audio/wav" }));

  audioElem = new Audio(src);
  audioElem.loop = true;
  audioElem.volume = 0.5;

  document.addEventListener("visibilitychange", () => {
    audioElem.muted = document.hidden;
  });

  if (IS_POKI_ENABLED) {
    pubSubService.subscribe(PubSubEvent.MUTE_MUSIC, () => {
      console.log("Muting music");
      audioElem.muted = true;
    });

    pubSubService.subscribe(PubSubEvent.UNMUTE_MUSIC, () => {
      console.log("Unmuting music");
      audioElem.muted = false;
    });
  }

  document.addEventListener("click", () => {
    if (!initialized) {
      initialized = true;

      !initializeMuted && togglePlayer();
    }
  });
}

export function generateUntilDone(player: SoundBoxPlayer): Promise<void> {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      if (player.generate() >= 1) {
        clearInterval(interval);
        resolve();
      }
    }, 0);
  });
}

export function togglePlayer(): boolean {
  isActive = !isActive;
  playOrPauseMusicIfApplicable();

  setLocalStorageItem(LocalStorageKey.MUSIC_MUTED, isActive ? "false" : "true");

  return isActive;
}

export function toggleEffects(): boolean {
  areEffectsOn = !areEffectsOn;
  setLocalStorageItem(LocalStorageKey.SOUND_MUTED, areEffectsOn ? "false" : "true");

  return areEffectsOn;
}

// The effects follow their own button and the tab: `areEffectsOn` is what the button toggles,
// and `audioElem.muted` is what the tab going away (or Poki) does to the music behind its back —
// asked here too, so a hidden tab goes quiet altogether rather than only losing its music.
export function isSoundOn(): boolean {
  return areEffectsOn && !audioElem.muted;
}

export function playOrPauseMusicIfApplicable(shouldPlay: boolean = isActive) {
  const isCurrentlyPlaying = !audioElem.paused && !audioElem.ended;

  if (shouldPlay && !isCurrentlyPlaying) {
    audioElem.play();
  } else if (!shouldPlay && isCurrentlyPlaying) {
    audioElem.pause();
  }
}
