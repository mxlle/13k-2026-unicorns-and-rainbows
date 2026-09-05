// The game's sound effects, in the SoundBox format the music uses. Sine-only (CPlayerSimple-safe).
// Three instruments carry all of them: a bell, a whistle and a thump. Each effect is a tiny song
// of its own so it can have its own tempo (rowLen), which is what makes a run of bell notes a
// sparkle in one sound and a swoosh in another. Instruments cost bytes; notes are nearly free.
//
// The rival's versions of these are not composed: the same sound is played at a lower playback
// rate (see sound-control-box.ts), which is what makes it the dark cousin.
//
// The first three are indexed by what they announce: DROPS 0 and CANDY 1 match the currency
// indices (and so ChestLoot), UNICORN 2 matches ChestLoot.UNICORN — so a chest's loot value and a
// payout's currency are both already the sound to play. Keep SoundEffect in step.

// Bright bell: osc2 an octave up, instant attack, exponential decay, a little echo.
const bell = [0, 120, 128, 0, 0, 80, 140, 6, 0, 0, 3, 8, 50, 25, 0, 0, 0, 0, 0, 0, 2, 255, 0, 0, 50, 30, 3, 90, 2];

// Whistle: the pitch follows the envelope (xenv), so a slow attack is an upward glide and the
// short release a little drop at the end — a "wheee".
const whistle = [0, 130, 128, 30, 0, 60, 152, 8, 30, 0, 60, 14, 40, 6, 0, 0, 0, 0, 0, 0, 2, 255, 0, 0, 50, 30, 3, 60, 2];

// Thump: a low sine whose pitch falls with its envelope, over in a tenth of a second — a kick
// at a low note, a "plop" at a higher one.
const thump = [0, 200, 128, 60, 0, 0, 128, 0, 0, 0, 2, 8, 40, 60, 0, 0, 0, 0, 0, 0, 2, 60, 0, 0, 42, 0, 0, 0, 0];

// 0 — drops landing in the purse: a falling plink, E6 to B5 (water).
export const dropsSound = {
  songData: [{ i: bell, p: [1], c: [{ n: [164, 159] }] }],
  rowLen: 2756,
  patternLen: 10,
  endPattern: 0,
  numChannels: 1,
};

// 1 — sweets landing in the jar: a rising blip, B5 to E6 (the old coin sound).
export const candySound = {
  songData: [{ i: bell, p: [1], c: [{ n: [158, 163] }] }],
  rowLen: 2756,
  patternLen: 10,
  endPattern: 0,
  numChannels: 1,
};

// 2 — a new unicorn: a short fanfare — ta-ta-ta-DAA, three G5s and a C6 with an E6 on top.
// Two columns of patternLen rows: the second note of the chord sits at row 6 + patternLen.
export const unicornSound = {
  songData: [{ i: bell, p: [1], c: [{ n: [154, , 154, , 154, , 159, , , , , , , , , , , , 163] }] }],
  rowLen: 2200,
  patternLen: 12,
  endPattern: 0,
  numChannels: 1,
};

// 3 — a present opening: a single plop.
export const popSound = {
  songData: [{ i: thump, p: [1], c: [{ n: [140] }] }],
  rowLen: 2756,
  patternLen: 6,
  endPattern: 0,
  numChannels: 1,
};

// 4 — a rainbow lit: a rising C-major sparkle, C5 up to E6.
export const rainbowSound = {
  songData: [{ i: bell, p: [1], c: [{ n: [147, 151, 154, 159, 163] }] }],
  rowLen: 1500,
  patternLen: 16,
  endPattern: 0,
  numChannels: 1,
};

// 5 — something built: a thump with a two-note chime on top, C then G.
export const buildSound = {
  songData: [
    { i: thump, p: [1], c: [{ n: [123] }] },
    { i: bell, p: [1], c: [{ n: [147, , 154] }] },
  ],
  rowLen: 3300,
  patternLen: 10,
  endPattern: 0,
  numChannels: 2,
};

// 6 — the portal: one long upward glide — the classic teleport.
export const portalSound = {
  songData: [{ i: whistle, p: [1], c: [{ n: [152] }] }],
  rowLen: 2756,
  patternLen: 14,
  endPattern: 0,
  numChannels: 1,
};

// 7 — the run won: a C-major flourish, C E G C, then A up to C again.
export const winSound = {
  songData: [{ i: bell, p: [1], c: [{ n: [147, , 151, , 154, , 159, , , , , , 156, , 159] }] }],
  rowLen: 3300,
  patternLen: 24,
  endPattern: 0,
  numChannels: 1,
};

// 8 — the race lost: a slow sigh, E D C, down to A, back home to C.
export const loseSound = {
  songData: [{ i: bell, p: [1], c: [{ n: [151, , 149, , 147, , , , 144, , , , , , 147] }] }],
  rowLen: 4400,
  patternLen: 24,
  endPattern: 0,
  numChannels: 1,
};
