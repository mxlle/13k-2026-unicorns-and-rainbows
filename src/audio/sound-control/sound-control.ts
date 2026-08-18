import { isSoundOn } from "../music-control";

const synth = window.speechSynthesis;

export function speak(text: string, rate: number = 1, pitch: number = 1): Promise<void> {
  if (!synth) return Promise.resolve();

  const utterThis = new SpeechSynthesisUtterance();
  utterThis.text = text;
  utterThis.rate = rate;
  utterThis.pitch = pitch;

  return new Promise((resolve) => {
    utterThis.onend = () => {
      resolve();
    };
    synth.speak(utterThis);
  });
}

export function playSound(audioSrc: string, playbackRate: number = 1) {
  if (!isSoundOn()) return Promise.resolve();

  const audio = new Audio(audioSrc);
  audio.preload = "auto";
  audio.preservesPitch = false;
  audio.playbackRate = playbackRate;
  audio.play().catch((error) => {
    console.error("Error playing sound:", error);
  });

  return new Promise<void>((resolve) => {
    audio.addEventListener("ended", () => resolve());
    audio.addEventListener("error", () => resolve());
  });
}

export function playSoundSimple(audioSrc: string) {
  if (!isSoundOn()) return;

  const audio = new Audio(audioSrc);
  void audio.play();
}
