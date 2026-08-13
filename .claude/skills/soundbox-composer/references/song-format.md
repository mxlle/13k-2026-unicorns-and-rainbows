# SoundBox song format

A song is a plain JS object rendered offline (not real-time) by `CPlayerSimple` /
`CPlayer` into 44.1 kHz 16-bit stereo WAV data.

```js
export const song = {
  songData: [ /* one entry per channel — a channel = one instrument + its patterns */
    {
      i: [ /* 29 instrument parameters, see table below */ ],
      p: [1, 2, 2, , 1],   // pattern sequence: 1-based indices into c; hole/0 = silent pattern
      c: [                  // the patterns
        {
          n: [135, , 139, , 142],  // notes, see below
          f: [],                   // effect automation, see below
        },
      ],
    },
  ],
  rowLen: 5513,     // samples per pattern row (44100 * 60 / (4 * BPM))
  patternLen: 32,   // rows per pattern
  endPattern: 4,    // p is played from index 0..endPattern INCLUSIVE
  numChannels: 1,   // must equal songData.length
};
```

Total duration in seconds = `rowLen * patternLen * (endPattern + 1) / 44100`.
The player renders one channel per `generate()` call; the game loops it until it
returns 1 (`generateUntilDone` in `music-control.ts`). Because that progress ratio is
`renderedChannels / numChannels`, **`numChannels` must equal `songData.length`** —
it is load-bearing, not just metadata (wrong value = truncated render or a crash).

## Notes (`c[x].n`)

- Value `n` plays frequency `174.61 Hz * 2^((n - 128) / 12)` — i.e. **128 = F3**,
  each step is a semitone. Useful anchors:

  | n   | note  | n   | note |
  |-----|-------|-----|------|
  | 123 | C3    | 140 | F4   |
  | 128 | F3    | 142 | G4   |
  | 135 | C4    | 144 | **A4 (440 Hz)** |
  | 137 | D4    | 147 | C5   |
  | 139 | E4    | 152 | F5   |

- Array holes (`,`) or 0 = no note on that row. Trailing holes can be omitted.
- **Polyphony:** the `n` array is up to 4 concatenated columns of `patternLen` entries
  each. Row `r`, column `col` is `n[r + col * patternLen]`. A chord needs the pattern
  padded to full `patternLen` per column. (All 2025 sounds are monophonic.)
  Counting holes in sparse literals is error-prone — before rendering polyphonic
  patterns, verify alignment with a quick check, e.g.:
  `node -e 'const n=[/* paste */]; console.log(n.length, "cols:", Math.ceil(n.length/PATLEN))'`
  or build columns as separate arrays and concatenate:
  `n: [...col1, ...col2]` with each column padded to exactly `patternLen` entries.
- Each note is rendered once and cached — long notes overlapping the next row simply
  mix additively.

## Instrument parameters (`i`, 29 entries)

Index constants as in the SoundBox export comments:

| #  | name          | meaning / formula |
|----|---------------|-------------------|
| 0  | OSC1_WAVEFORM | 0 sin, 1 square, 2 saw, 3 tri — **simple player: only 0 works** |
| 1  | OSC1_VOL      | 0-255 oscillator 1 volume |
| 2  | OSC1_SEMI     | pitch offset in semitones, 128 = none |
| 3  | OSC1_XENV     | >0: envelope also drives pitch (kick drums!), scale /32 |
| 4  | OSC2_WAVEFORM | like #0 |
| 5  | OSC2_VOL      | like #1 |
| 6  | OSC2_SEMI     | like #2 |
| 7  | OSC2_DETUNE   | fine detune of osc2, ~0.08 %/unit — small values (5-15) fatten the sound |
| 8  | OSC2_XENV     | like #3 |
| 9  | NOISE_VOL     | 0-255 white noise mixed in — percussion, wind, splashes |
| 10 | ENV_ATTACK    | samples = value² × 4 (e.g. 12 → ~0.01 s, 100 → ~0.9 s) |
| 11 | ENV_SUSTAIN   | same scale |
| 12 | ENV_RELEASE   | same scale (72 → ~0.47 s) |
| 13 | ENV_EXP_DECAY | >0: exponential decay curve in release (punchier) |
| 14 | ARP_CHORD     | two nibbles = semitone offsets alternated as arpeggio (0x47 = +4/+7 = major) |
| 15 | ARP_SPEED     | arpeggio note length = rowLen × 2^(2 − value) |
| 16 | LFO_WAVEFORM  | (simple player: unused) |
| 17 | LFO_AMT       | (simple player: unused) |
| 18 | LFO_FREQ      | (simple player: unused) |
| 19 | LFO_FX_FREQ   | (simple player: unused — filter LFO is commented out in BOTH players) |
| 20 | FX_FILTER     | 1 highpass, 2 lowpass, 3 bandpass — **CAUTION: the filter path always runs.** `FX_FILTER: 0` with `FX_FREQ: 0` silences everything (0 falls into the lowpass branch with a zero coefficient). For "no filter" use `FX_FILTER: 2, FX_FREQ: 255` (wide-open lowpass), like the 2025 instrument. |
| 21 | FX_FREQ       | filter cutoff, 0-255 (× 43.24 Hz ≈ Hz) — never leave at 0 |
| 22 | FX_RESONANCE  | 0-254, higher = more resonance (q = 1 − v/255) |
| 23 | FX_DIST       | distortion — **commented out in both players, has no effect** |
| 24 | FX_DRIVE      | output gain /32 (32 = 1.0) — main loudness control |
| 25 | FX_PAN_AMT    | stereo auto-pan depth /512 |
| 26 | FX_PAN_FREQ   | pan LFO speed = 2^(v−9) / rowLen |
| 27 | FX_DELAY_AMT  | echo feedback /255 |
| 28 | FX_DELAY_TIME | echo time in rows (rounded to even sample count) |

The 2025 shared instrument (soft stereo sine pad):
`[0, 91, 128, 0, 0, 95, 128, 12, 0, 0, 12, 0, 72, 0, 0, 0, 0, 0, 0, 0, 2, 255, 0, 0, 32, 83, 3, 130, 4]`

## Effect automation (`c[x].f`) — advanced

`f` holds 2 × patternLen entries: `f[row]` = instrument parameter index **+ 1** to
change on that row, `f[row + patternLen]` = the new value. It permanently mutates the
instrument mid-song (also for all later patterns). Changing params 1-16 clears the
note cache. Leave `f: []` unless automation is really needed.

## Size notes

- Reuse one instrument array across songs/channels (`const instrument = [...]`).
- Rearranging existing patterns via `p` is nearly free; each new pattern costs bytes.
- Repetition compresses: a 4-pattern loop played 8× costs the same zipped as played 2×.
- `render-song.mjs` prints each song's zipped byte estimate. Reference points: the
  2025 background track ≈ 290 B, win/lose sfx ≈ 160 B each. More channels ≈ linear
  cost growth — 6 channels of data is roughly twice 3.
- Before shipping, `node scripts/audit-player-usage.mjs` lists which player features
  the songs use, so unused oscillator/effect code can be trimmed from the player.
- Song modules must stay import-free and annotation-free so `scripts/render-song.mjs`
  can execute them directly.
