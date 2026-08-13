import { PubSubEvent, pubSubService } from "./utils/pub-sub-service";
import { IS_POKI_ENABLED } from "./env-utils";

interface PokiSDK {
  init: () => Promise<void>;
  gameLoadingFinished: () => void;
  gameplayStart: () => void;
  gameplayStop: () => void;
  commercialBreak: (callback: () => void) => Promise<void>;
}

declare const PokiSDK: PokiSDK;

export let pokiSdk: PokiSDK | undefined;

const createElement = (tag: string, props: object) => Object.assign(document.createElement(tag), props);
const loadScript = (src: string) =>
  new Promise((onload, onerror) => document.head.appendChild(createElement("script", { src, onload, onerror })));

export async function initPoki(continueToGame: () => Promise<void>) {
  if (!IS_POKI_ENABLED) return continueToGame();

  try {
    await loadScript("https://game-cdn.poki.com/scripts/v2/poki-sdk.js");
    pokiSdk = PokiSDK;
  } catch (error) {
    console.log("Failed to load Poki SDK", error);
    return continueToGame();
  }

  PokiSDK.init()
    .then(() => {
      console.log("Poki SDK successfully initialized");
      return continueToGame();
    })
    .then(() => {
      PokiSDK.gameLoadingFinished();
    })
    .catch(() => {
      console.log("Initialized, something went wrong, load you game anyway");
      // fire your function to continue to game
      return continueToGame();
    });
}

export function handlePokiCommercial(): Promise<void> {
  if (!IS_POKI_ENABLED || !pokiSdk) return Promise.resolve();
  // pause your game here if it isn't already
  return pokiSdk
    .commercialBreak(() => {
      // you can pause any background music or other audio here
      pubSubService.publish(PubSubEvent.MUTE_MUSIC);
    })
    .then(() => {
      console.log("Commercial break finished, proceeding to game");
      // if the audio was paused you can resume it here (keep in mind that the function above to pause it might not always get called)
      // continue your game here
      pubSubService.publish(PubSubEvent.UNMUTE_MUSIC);
    })
    .catch((error: Error) => {
      console.error("Commercial break failed", error);
    });
}
