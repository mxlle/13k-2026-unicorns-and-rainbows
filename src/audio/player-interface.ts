// Shape of the vendored SoundBox players. small-player*.ts are deliberately
// golfed third-party code excluded from strict checking (@ts-nocheck); this
// interface types them at the module boundary instead.
export interface SoundBoxPlayer {
  init(song: object): void;
  generate(): number;
  createWave(): Uint8Array<ArrayBuffer>;
}

export type SoundBoxPlayerClass = new () => SoundBoxPlayer;
