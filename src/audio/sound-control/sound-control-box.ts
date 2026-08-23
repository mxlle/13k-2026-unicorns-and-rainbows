import { coinSound, loseSound, winSound } from "../songs/music-and-sounds";
import { generateUntilDone } from "../music-control";
import { CPlayerSimple as CPlayer } from "../small-player-simple";

export let winSoundSrcUrl: string | undefined;
export let loseSoundSrcUrl: string | undefined;
export let coinSoundSrcUrl: string | undefined;

export async function initWinLoseSoundEffects() {
  if (!winSoundSrcUrl) {
    winSoundSrcUrl = await initSoundEffect(winSound);
  }

  if (!loseSoundSrcUrl) {
    loseSoundSrcUrl = await initSoundEffect(loseSound);
  }

  if (!coinSoundSrcUrl) {
    coinSoundSrcUrl = await initSoundEffect(coinSound);
  }
}

async function initSoundEffect(soundDef: object) {
  const player = new CPlayer();
  player.init(soundDef);

  await generateUntilDone(player);
  const wave = player.createWave();
  return URL.createObjectURL(new Blob([wave], { type: "audio/wav" }));
}
