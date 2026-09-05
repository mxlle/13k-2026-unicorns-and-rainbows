// "Candy Clouds" — background loop for Unicorns and Rainbows.
// C major, 90 BPM, 16 bars ≈ 42.7 s seamless loop. Sine-only (CPlayerSimple-safe).
// Cozy Sims-build-mode flavour: soft piano-ish melody over rolling maj7/9 broken chords,
// a walking-ish bass, light kick and ticks.
//
// Harmony trick: the chord channel is one instrument with a *major* arpeggio (root, +4, +7),
// so every chord is a major triad; the colour comes from which triad sits on which bass note:
//   C bass + C triad = C        A bass + C triad = Am7        F bass + F triad = F
//   G bass + F triad = G9sus    D bass + F triad = Dm7        G bass + G triad = G
//
// Slot plan (one pattern slot = 2 bars, one chord per bar):
//   slot:  1     2     3     4     5     6     7     8
//   chord: C Am  F G   C Am  F G   Dm G  C Am  F G   Dm G7   (ends on V -> loops to I)

// Warm sub bass: two sines an octave apart, soft attack, no delay.
const bassInstrument = [0, 140, 128, 0, 0, 90, 116, 3, 0, 0, 18, 40, 70, 0, 0, 0, 0, 0, 0, 0, 2, 70, 0, 0, 38, 20, 2, 0, 0];

// Piano-ish melody: osc2 one octave up, softly detuned, quick attack, long singing release,
// gentle exponential decay, half-bar echo and slow auto-pan.
const pianoInstrument = [0, 110, 128, 0, 0, 70, 140, 6, 0, 0, 4, 20, 90, 14, 0, 0, 0, 0, 0, 0, 2, 220, 0, 0, 36, 60, 3, 70, 8];

// Rolling chord: major arpeggio (0x47 = root, +4, +7) in eighth notes (ARP_SPEED 1),
// plucked twice a bar and left to fade — a harp/piano left hand.
const chordInstrument = [0, 95, 128, 0, 0, 55, 140, 4, 0, 0, 5, 30, 105, 6, 0x47, 1, 0, 0, 0, 0, 2, 180, 0, 0, 36, 70, 2, 40, 4];

// Airy tick: pure noise through a highpass, very short, touch of echo.
const tickInstrument = [0, 0, 128, 0, 0, 0, 128, 0, 0, 40, 3, 4, 25, 30, 0, 0, 0, 0, 0, 0, 1, 190, 0, 0, 34, 120, 5, 40, 3];

// Soft kick: low sine with pitch envelope (xenv) and exponential decay.
const kickInstrument = [0, 180, 128, 60, 0, 0, 128, 0, 0, 0, 2, 10, 45, 60, 0, 0, 0, 0, 0, 0, 2, 50, 0, 0, 26, 0, 0, 0, 0];

export const candyCloudsSong = {
  songData: [
    {
      // Bass — root on 1, again on the "and" of 2, fifth on 3, walk-up into the next bar.
      // Nothing later than row 28: the loop is a hard cut, and a bass note still sustaining there clicks.
      i: bassInstrument,
      p: [1, 2, 1, 2, 3, 1, 2, 3],
      c: [
        { n: [123, , , , , , 123, , , , , , 130, , , , 120, , , , , , 120, , , , , , 125, , 127] }, // C | Am (walks D-E up into F)
        { n: [128, , , , , , 128, , , , , , 123, , , , 118, , , , , , 118, , , , , , 120, , 122] }, // F | G (walks A-B up into C)
        { n: [125, , , , , , 125, , , , , , 120, , , , 118, , , , , , 118, , , , , , 125] }, // Dm | G (fifth on 4, then quiet into the loop seam)
      ],
    },
    {
      // Rolling chords — two plucks per bar, the arpeggio does the rest
      i: chordInstrument,
      p: [1, 2, 1, 2, 3, 1, 2, 3],
      c: [
        { n: [123, , , , , , , , 123, , , , , , , , 123, , , , , , , , 123] }, // C | Am7 (C triad over A)
        { n: [128, , , , , , , , 128, , , , , , , , 128, , , , , , , , 128] }, // F | G9sus (F triad over G)
        { n: [128, , , , , , , , 128, , , , , , , , 130, , , , , , , , 130] }, // Dm7 (F triad over D) | G
      ],
    },
    {
      // Melody. Slot 1 is the answer to slot 8: the closing phrase ends on the leading tone,
      // so the loop's first downbeat resolves it to C and then rests for a breather.
      i: pianoInstrument,
      p: [5, 1, 2, 1, 3, 2, 1, 4],
      c: [
        // A over F | G: lazy rise to C5, answered by a stepwise fall to G
        { n: [139, , 140, , 144, , , , 147, , 144, , , , 142, , 146, , 147, , 149, , , , 146, , 144, , 142] },
        // B over C | Am: sits on the chord tones, ends leaning on G into the F bar
        { n: [139, , , , 142, , 144, , 142, , , , 139, , , , 147, , , , 146, , 144, , , , 139, , 142] },
        // C over Dm | G: higher, questioning phrase, lands on the leading tone
        { n: [149, , 147, , 144, , , , 147, , , , 144, , , , 149, , , , 151, , 149, , , , 147, , 146] },
        // D over Dm | G7 (closing): descends to E, then the leading tone with a little turn
        { n: [144, , 147, , 149, , , , 147, , 144, , 142, , , , 139, , , , 142, , 144, , 142, , 139, , 146] },
        // E over C | Am (loop start): C5 on the downbeat, sighs down to E, silent through the Am bar
        { n: [147, , , , , , 144, , 142, , , , 139] },
      ],
    },
    {
      // Off-beat ticks, running through the whole loop so the seam has no texture jump
      i: tickInstrument,
      p: [1, 1, 1, 1, 1, 1, 1, 1],
      c: [{ n: [, , 140, , , , 140, , , , 140, , , , 140, , , , 140, , , , 140, , , , 140, , , , 140] }],
    },
    {
      // Kick on 1 and the "and" of 2 in bar one, 1 and 3 in bar two — a lazy two-bar groove
      i: kickInstrument,
      p: [1, 1, 1, 1, 1, 1, 1, 1],
      c: [{ n: [123, , , , , , 123, , , , , , , , , , 123, , , , , , , , 123] }],
    },
  ],
  rowLen: 7350, // 90 BPM, rows are 16th notes
  patternLen: 32, // 2 bars of 4/4 per pattern
  endPattern: 7,
  numChannels: 5,
};
