// This music has been exported by SoundBox. You can use it with
// http://sb.bitsnbites.eu/player-small.js in your own product.

// See http://sb.bitsnbites.eu/demo.html for an example of how to
// use it in a demo.

const instrument = [
  0, // OSC1_WAVEFORM
  91, // OSC1_VOL
  128, // OSC1_SEMI
  0, // OSC1_XENV
  0, // OSC2_WAVEFORM
  95, // OSC2_VOL
  128, // OSC2_SEMI
  12, // OSC2_DETUNE
  0, // OSC2_XENV
  0, // NOISE_VOL
  12, // ENV_ATTACK
  0, // ENV_SUSTAIN
  72, // ENV_RELEASE
  0, // ENV_EXP_DECAY
  0, // ARP_CHORD
  0, // ARP_SPEED
  0, // LFO_WAVEFORM
  0, // LFO_AMT
  0, // LFO_FREQ
  0, // LFO_FX_FREQ
  2, // FX_FILTER
  255, // FX_FREQ
  0, // FX_RESONANCE
  0, // FX_DIST
  32, // FX_DRIVE
  83, // FX_PAN_AMT
  3, // FX_PAN_FREQ
  130, // FX_DELAY_AMT
  4, // FX_DELAY_TIME
];

export const winSound = {
  songData: [
    {
      // Instrument 1
      i: instrument,
      // Patterns
      p: [1],
      // Columns
      c: [{ n: [135, 139, 142, 147] }],
    },
  ],
  rowLen: 11025, // In sample lengths
  patternLen: 16, // Rows per pattern
  endPattern: 1, // End pattern
  numChannels: 1, // Number of channels
};

// Coin pickup sound effect — bright two-note rising blip (B5 -> E6).
// Composed with the soundbox-composer skill (iteration-2). Sine-only, so it
// stays safe if the player is trimmed to CPlayerSimple before shipping.
export const coinSound = {
  songData: [
    {
      i: [
        0, // OSC1_WAVEFORM (sine — required by simple player)
        140, // OSC1_VOL
        128, // OSC1_SEMI
        0, // OSC1_XENV
        0, // OSC2_WAVEFORM (sine)
        90, // OSC2_VOL
        140, // OSC2_SEMI (+1 octave — adds brightness/shimmer)
        6, // OSC2_DETUNE (slight fattening)
        0, // OSC2_XENV
        0, // NOISE_VOL
        3, // ENV_ATTACK (~36 samples, instant)
        10, // ENV_SUSTAIN (short)
        45, // ENV_RELEASE (~0.18 s tail)
        25, // ENV_EXP_DECAY (plucky, bell-like)
        0, // ARP_CHORD
        0, // ARP_SPEED
        0, // LFO_WAVEFORM
        0, // LFO_AMT
        0, // LFO_FREQ
        0, // LFO_FX_FREQ
        2, // FX_FILTER (lowpass wide open — filter path is always applied, so 0/0 would be silence)
        255, // FX_FREQ (fully open)
        0, // FX_RESONANCE
        0, // FX_DIST
        48, // FX_DRIVE
        30, // FX_PAN_AMT (gentle stereo)
        3, // FX_PAN_FREQ
        90, // FX_DELAY_AMT (sparkle echo)
        2, // FX_DELAY_TIME (2 rows)
      ],
      p: [1],
      c: [{ n: [158, 163] }], // B5 then E6 — classic rising coin blip
    },
  ],
  rowLen: 2756, // ~62 ms per row — fast
  patternLen: 10, // 2 note rows + room for release/delay tail
  endPattern: 0,
  numChannels: 1,
};

export const loseSound = {
  songData: [
    {
      // Instrument 1
      i: instrument,
      // Patterns
      p: [1],
      // Columns
      c: [{ n: [129, 126, 123, , , , , , , , , , , , , , , , 126, , , , , , , , , , , , , , , , 129] }],
    },
  ],
  rowLen: 11025, // In sample lengths
  patternLen: 16, // Rows per pattern
  endPattern: 1, // End pattern
  numChannels: 1, // Number of channels
};
