import { cozyPawsSong as song } from "./songs/cozy-paws";
import { LocalStorageKey, setLocalStorageItem } from "../utils/local-storage";
import { PubSubEvent, pubSubService } from "../utils/pub-sub-service";
import { IS_POKI_ENABLED } from "../env-utils";
import { CPlayerSimple as CPlayer } from "./small-player-simple";
import type { SoundBoxPlayer } from "./player-interface";

let audioElem: HTMLAudioElement;
let isActive = false;
let initialized = false;

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

  setLocalStorageItem(LocalStorageKey.MUTED, isActive ? "false" : "true");

  return isActive;
}

// The mute button owns *all* audio, not just the music: `isActive` is what it toggles, and
// `audioElem.muted` is what the tab going away (or Poki) does behind its back. Sound effects
// ask both, so they follow the button and the tab without a second flag to keep in step.
export function isSoundOn(): boolean {
  return isActive && !audioElem.muted;
}

export function playOrPauseMusicIfApplicable(shouldPlay: boolean = isActive) {
  const isCurrentlyPlaying = !audioElem.paused && !audioElem.ended;

  if (shouldPlay && !isCurrentlyPlaying) {
    audioElem.play();
  } else if (!shouldPlay && isCurrentlyPlaying) {
    audioElem.pause();
  }
}
