// "Cozy Paws" — original background loop for the cat puzzle game.
// F major, ~100 BPM, 38.4 s seamless loop. Sine-only (CPlayerSimple-safe).
// Channels: sub bass, plucky melody, off-beat noise ticks, soft kick.

// Warm sub bass: two sines an octave apart, soft attack, no delay.
const bassInstrument = [0, 140, 128, 0, 0, 90, 116, 3, 0, 0, 18, 40, 70, 0, 0, 0, 0, 0, 0, 0, 2, 70, 0, 0, 38, 20, 2, 0, 0];

// Plucky bell-ish melody: osc2 +1 octave slightly detuned, fast envelope,
// exponential decay, dotted echo (6 rows) and gentle auto-pan.
const pluckInstrument = [0, 120, 128, 0, 0, 90, 140, 9, 0, 0, 5, 10, 70, 20, 0, 0, 0, 0, 0, 0, 2, 200, 0, 0, 38, 90, 4, 90, 6];

// Airy tick: pure noise through a highpass, very short, touch of echo.
const tickInstrument = [0, 0, 128, 0, 0, 0, 128, 0, 0, 45, 3, 4, 25, 30, 0, 0, 0, 0, 0, 0, 1, 190, 0, 0, 36, 120, 5, 40, 3];

// Soft kick: low sine with pitch envelope (xenv) and exponential decay.
const kickInstrument = [0, 180, 128, 60, 0, 0, 128, 0, 0, 0, 2, 10, 45, 60, 0, 0, 0, 0, 0, 0, 2, 50, 0, 0, 27, 0, 0, 0, 0];

// Chord plan per pattern slot (2 bars each):
//  slot: 1    2     3    4    5    6     7    8
//  bass: F C  Dm Bb F C  Bb C F C  Dm Bb F C  Bb C   (ends on V -> loops to I)
export const cozyPawsSong = {
  songData: [
    {
      // Bass
      i: bassInstrument,
      p: [1, 2, 1, 3, 1, 2, 1, 3],
      c: [
        { n: [116, , , , , , 116, , , , , , 123, , , , 123, , , , , , 123, , , , , , 118] }, // F | C
        { n: [125, , , , , , 125, , , , , , 120, , , , 121, , , , , , 121, , , , , , 116] }, // Dm | Bb
        { n: [121, , , , , , 121, , , , , , 116, , , , 123, , , , , , 123, , , , , , 118] }, // Bb | C
      ],
    },
    {
      // Melody (enters at slot 3)
      i: pluckInstrument,
      p: [, , 1, 3, 1, 2, 4, 3],
      c: [
        { n: [140, , 142, , 144, , , , 147, , , , 144, , , , 142, , 144, , 142, , , , 139] }, // A: rise F-G-A to C5, settle on E4
        { n: [149, , , , , , 147, , 144, , , , 142, , , , 145, , , , 149, , , , 147, , , , 145] }, // B: Dm/Bb answer
        { n: [145, , 147, , 149, , , , 145, , , , 147, , , , 142, , , , 144, , , , 142, , , , 139] }, // C: closing, ends on leading tone
        { n: [152, , 149, , 147, , , , 149, , , , 147, , , , 144, , , , 142, , 144, , 147] }, // D: high variation
      ],
    },
    {
      // Off-beat ticks (enter at slot 2)
      i: tickInstrument,
      p: [, 1, 1, 1, 1, 1, 1, 1],
      c: [{ n: [, , 140, , , , 140, , , , 140, , , , 140, , , , 140, , , , 140, , , , 140, , , , 140] }],
    },
    {
      // Kick on beats 1 & 3
      i: kickInstrument,
      p: [1, 1, 1, 1, 1, 1, 1, 1],
      c: [{ n: [123, , , , , , , , 123, , , , , , , , 123, , , , , , , , 123] }],
    },
  ],
  rowLen: 6615, // ~100 BPM, rows are 16th notes
  patternLen: 32, // 2 bars of 4/4 per pattern
  endPattern: 7,
  numChannels: 4,
};
