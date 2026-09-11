// The game's sound effects, in the SoundBox format the music uses. Sine-only (CPlayerSimple-safe).
// Four instruments carry all of them: a bell, a whistle, a thump and a hi-hat. Each effect is a tiny song
// of its own so it can have its own tempo (rowLen), which is what makes a run of bell notes a
// sparkle in one sound and a swoosh in another. Instruments cost bytes; notes are nearly free.
//
// The rival's versions of these are not composed: the same sound is played at a lower playback
// rate (see sound-control-box.ts), which is what makes it the dark cousin.
//
// The first three are indexed by what they announce: DROPS 0 and CANDY 1 match the currency
// indices (and so ChestLoot) and are the same counting sound, UNICORN 2 matches ChestLoot.UNICORN —
// so a chest's loot value and a payout's currency are both already the sound to play. Keep
// SoundEffect in step.

// Bright bell: osc2 an octave up, instant attack, exponential decay, a little echo.
const bell = [0, 120, 128, 0, 0, 80, 140, 6, 0, 0, 3, 8, 50, 25, 0, 0, 0, 0, 0, 0, 2, 255, 0, 0, 50, 30, 3, 90, 2];

// Whistle: the pitch follows the envelope (xenv), so a slow attack is an upward glide and the
// short release a little drop at the end — a "wheee".
const whistle = [0, 130, 128, 30, 0, 60, 152, 8, 30, 0, 60, 14, 40, 6, 0, 0, 0, 0, 0, 0, 2, 255, 0, 0, 50, 30, 3, 60, 2];

// Hi-hat: pure noise through a highpass, a fast exponential decay of about 40 ms, no tone at all.
const hihat = [0, 0, 128, 0, 0, 0, 128, 0, 0, 70, 2, 3, 22, 30, 0, 0, 0, 0, 0, 0, 1, 170, 0, 0, 64, 0, 0, 0, 0];

// Dull: a low sine with a soft attack and no exponential decay, so it has neither an attack
// transient nor a sparkle — osc2 an octave under it, slightly detuned, for body, and a low
// lowpass. The one instrument here that is deliberately lifeless.
const dull = [0, 160, 128, 0, 0, 110, 116, 8, 0, 0, 10, 20, 45, 0, 0, 0, 0, 0, 0, 0, 2, 40, 0, 0, 40, 0, 0, 0, 0];

// Thump: a low sine whose pitch falls with its envelope, over in a tenth of a second — a kick
// at a low note.
const thump = [0, 200, 128, 60, 0, 0, 128, 0, 0, 0, 2, 8, 40, 60, 0, 0, 0, 0, 0, 0, 2, 60, 0, 0, 42, 0, 0, 0, 0];

// 0 and 1 — money being counted into the purse or the jar, drops and sweets alike: three hi-hat
// ticks a tenth of a second apart. Toneless on purpose — it plays every turn, and a tune that
// plays every turn is the one the player tires of. Noise ignores the note number; it only has
// to be non-zero.
export const countSound = {
  songData: [{ i: hihat, p: [1], c: [{ n: [1, 1, 1] }] }],
  rowLen: 4400,
  patternLen: 4,
  endPattern: 0,
  numChannels: 1,
};

// 2 — a new unicorn: a short fanfare — ta-DAA, a G5 and a C6 with an E6 on top.
// Two columns of patternLen rows: the second note of the chord sits at row 2 + patternLen.
export const unicornSound = {
  songData: [{ i: bell, p: [1], c: [{ n: [154, , 159, , , , , , , , 163] }] }],
  rowLen: 2200,
  patternLen: 8,
  endPattern: 0,
  numChannels: 1,
};

// 3 — a rainbow lit: a rising C-major sparkle, C5 up to E6.
export const rainbowSound = {
  songData: [{ i: bell, p: [1], c: [{ n: [147, 151, 154, 159, 163] }] }],
  rowLen: 1500,
  patternLen: 16,
  endPattern: 0,
  numChannels: 1,
};

// 4 — something built: a thump with a two-note chime on top, C then G.
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

// 5 — the portal: one long upward glide — the classic teleport.
export const portalSound = {
  songData: [{ i: whistle, p: [1], c: [{ n: [152] }] }],
  rowLen: 2756,
  patternLen: 14,
  endPattern: 0,
  numChannels: 1,
};

// 6 — the run won: a C-major flourish, C E G C, then A up to C again.
export const winSound = {
  songData: [{ i: bell, p: [1], c: [{ n: [147, , 151, , 154, , 159, , , , , , 156, , 159] }] }],
  rowLen: 3300,
  patternLen: 24,
  endPattern: 0,
  numChannels: 1,
};

// 7 — the race lost: a slow sigh, E D C, down to A, back home to C.
export const loseSound = {
  songData: [{ i: bell, p: [1], c: [{ n: [151, , 149, , 147, , , , 144, , , , , , 147] }] }],
  rowLen: 4400,
  patternLen: 24,
  endPattern: 0,
  numChannels: 1,
};

// 8 — a tap with nothing left to spend: two low notes a semitone apart, falling. It answers a
// tap on the board rather than an action, because when the turn is spent a tap is all there is —
// so it is deliberately soft and short: it says "nothing here", not "wrong".
export const stuckSound = {
  songData: [{ i: dull, p: [1], c: [{ n: [116, , 115] }] }],
  rowLen: 2200,
  patternLen: 8,
  endPattern: 0,
  numChannels: 1,
};
