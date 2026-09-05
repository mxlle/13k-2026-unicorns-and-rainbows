import {
  buildSound,
  candySound,
  dropsSound,
  loseSound,
  popSound,
  portalSound,
  rainbowSound,
  unicornSound,
  winSound,
} from "../songs/sound-effects";
import { generateUntilDone, isSoundOn } from "../music-control";
import { CPlayerSimple as CPlayer } from "../small-player-simple";
import { HAS_SIMPLE_SOUND_EFFECTS } from "../../env-utils";
import type { SoundEffect } from "./sound-effect";

// In SoundEffect order: the enum is the index into this list.
const SOUNDS = [dropsSound, candySound, unicornSound, popSound, rainbowSound, buildSound, portalSound, winSound, loseSound];

// The rival's sounds are the player's, slowed down. With preservesPitch off a slower playback is
// also a lower one, so every effect has a darker cousin for no song bytes at all.
const DARK_PLAYBACK_RATE = 0.6;

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
 * Plays one effect, if sound is on at all. `dark` is the rival's voice — the same sound an
 * octave-ish lower and slower.
 * A fresh Audio element per play, so sounds can overlap rather than cut each other off.
 */
export function playSoundEffect(effect: SoundEffect, dark = false) {
  if (!HAS_SIMPLE_SOUND_EFFECTS || !isSoundOn() || !soundUrls[effect]) return;

  const audio = new Audio(soundUrls[effect]);
  audio.preservesPitch = false;
  audio.playbackRate = dark ? DARK_PLAYBACK_RATE : 1;
  void audio.play();
}
