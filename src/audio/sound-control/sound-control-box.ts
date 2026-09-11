import { buildSound, countSound, loseSound, portalSound, rainbowSound, stuckSound, unicornSound, winSound } from "../songs/sound-effects";
import { generateUntilDone, isSoundOn } from "../music-control";
import { CPlayerSimple as CPlayer } from "../small-player-simple";
import { HAS_SIMPLE_SOUND_EFFECTS } from "../../env-utils";
import type { SoundEffect } from "./sound-effect";

// In SoundEffect order: the enum is the index into this list. Both currencies count the same way.
const SOUNDS = [countSound, countSound, unicornSound, rainbowSound, buildSound, portalSound, winSound, loseSound, stuckSound];

// One rendered WAV per effect, as object URLs, in SoundEffect order.
let soundUrls: string[] = [];

/** Renders every effect once, up front — the same way the music is, and gated the same way. */
export async function initSoundEffects() {
  if (!HAS_SIMPLE_SOUND_EFFECTS) return;

  for (const sound of SOUNDS) {
    const player = new CPlayer();
    player.init(sound);

    await generateUntilDone(player);
    const wave = player.createWave();
    soundUrls.push(URL.createObjectURL(new Blob([wave], { type: "audio/wav" })));
  }
}

/**
 * Plays one effect, if sound is on at all. The rival has no voice of its own: its turn is watched
 * rather than heard — the ring says where it is and the board says what it did, and a sound on top
 * of that was either a celebration of the wrong side or 58 bytes saying what was already said.
 * A fresh Audio element per play, so sounds can overlap rather than cut each other off.
 */
export function playSoundEffect(effect: SoundEffect) {
  if (!HAS_SIMPLE_SOUND_EFFECTS || !isSoundOn() || !soundUrls[effect]) return;

  void new Audio(soundUrls[effect]).play();
}
