---
name: soundbox-composer
description: Compose, edit, and preview music and sound effects for this game in the SoundBox format (the tiny synth player in src/audio/). Use this whenever the user wants game audio of any kind — background music, a jingle, win/lose/pickup/click sound effects, "make the music shorter/faster/happier", a new instrument sound, or anything touching song data or src/audio/songs/ — even if they don't say "SoundBox". Also use it to explain how the music system works.
---

# SoundBox Composer

This project generates all audio at runtime from tiny JS data objects, played by a
stripped-down [SoundBox](https://sb.bitsnbites.eu/) synth (~1.8 kB zipped). No audio
files exist — a "song" is a JS object describing instruments, patterns, and notes,
rendered to a WAV blob on startup. A full background track costs a few hundred bytes.

Read `references/song-format.md` before writing song data — it documents the song
object anatomy, all 29 instrument parameters, and the note-number table.

## The two players — compose full, trim to ship

- `src/audio/small-player.ts` (`CPlayer`) — **the template default**: all 4 oscillators
  (0 sin, 1 square, 2 saw, 3 tri), filter LFO, distortion. Compose freely against this.
- `src/audio/small-player-simple.ts` (`CPlayerSimple`) — the 2025-shipped trim
  (sine-only, no filter-LFO/distortion), kept as a worked example of trimming.

Before shipping, run `node scripts/audit-player-usage.mjs` — it scans all songs,
reports which features are actually used, and says what's safe to delete: either
switch the imports to `CPlayerSimple` (if everything is sine-only) or trim a copy of
the full player per its checklist. Trimming is a *ship-time size optimization*, not a
composing constraint.

Trap once trimmed: a waveform index the trimmed player lacks **crashes** it
(`mOscillators[1]` is undefined in the simple player) — not a graceful fallback.
After any trim, re-render every song (`--simple` for the simple player) and listen.

## Workflow

1. **Establish the musical direction before writing any notes.** Don't guess a style —
   derive it or ask:
   - Extract mood candidates from the game itself: theme and setting (`GAME_TITLE`,
     README, story), pace (turn-based/puzzle → calm, ambient; action → driving,
     rhythmic), and moment (background loop vs. win jingle vs. failure sting).
   - For background music the user will hear it hundreds of times — propose 2-3
     concrete directions (e.g. "calm nocturnal drone + sparse high melody" vs.
     "gentle rhythmic pulse with a folk-ish tune") and let the user pick, unless
     they already gave a brief.
   - For short sound effects, infer from the action (reward → rising/major,
     failure → falling/minor, UI tick → single short blip) and just build it.

2. **Write the song module.** Put songs in `src/audio/songs/<name>.ts` as plain
   `export const mySound = { ... }` with **no imports and no type annotations** — the
   render script loads these files directly in Node, and the game imports them as TS.
   Share one instrument array between songs where possible (bytes!).

3. **Render it:**
   ```sh
   node scripts/render-song.mjs src/audio/songs/<name>.ts <exportName>
   ```
   This uses the project's real player (full `CPlayer` by default, `--simple` for the
   trimmed one), writes `out/<name>-<export>.wav`, and prints:
   - duration + peak level — 0% = silence bug (wrong pattern index, `n` array
     misplaced, or the `FX_FILTER: 0` trap); ~100% = clipping (lower `OSC_VOL`/`FX_DRIVE`)
   - loop-seam tail RMS for longer tracks — background music ships as a hard loop, so
     a loud tail clicks at the seam; render with `--loop=2` and listen to the seam
   - the song data's zipped byte estimate — the whole 2025 background track is
     ~290 bytes, win/lose sounds ~160 each; if a track balloons past ~600 bytes,
     simplify patterns or reuse them via `p` before polishing further.

4. **Let the user listen:** play the WAV with the platform's CLI player — `afplay` on
   macOS, `aplay`/`paplay` on Linux, `Start-Process` in Windows PowerShell — unless the
   user asked you not to play audio, then report the file path instead. A rendered file they can hear
   beats any description of the sound. For loudness, aim for a peak around 50-90%.
   Iterate on the data until it's right.

5. **Wire it into the game** like the existing sounds: music via `initAudio`
   (`src/audio/music-control.ts`), one-shot effects via `initSoundEffect` in
   `src/audio/sound-control/sound-control-box.ts`.

6. **Check the byte cost** with `npm run build-js13k` — song data usually compresses
   very well (repetition!), but verify.

## Composition quick reference

- Note 144 = A4 = 440 Hz; 147 = C5; +1 = one semitone. Sparse array holes (`,`) are
  silent rows. Note 0/absent = no note.
- One pattern row lasts `rowLen / 44100` seconds. `rowLen: 5513` ≈ 120 BPM with rows
  as 16th notes (BPM ≈ 661500 / rowLen). The 2025 game used a slow `rowLen: 22050`.
- Song length = `rowLen × patternLen × (endPattern + 1)` samples. Keep sound effects
  to 1 pattern with a small `patternLen` — the tail is release + delay echoes.
- Melodies feel musical when they stay in one scale; end phrases on the root note.
  A rising major arpeggio reads as "win" (the 2025 win sound is C4-E4-G4-C5 =
  `[135, 139, 142, 147]`), a falling minor line as "lose".
- Percussion without square/saw: short noise bursts (`NOISE_VOL` high, xenv on, fast
  release) give hi-hats/snares; a low sine with `ENV_EXP_DECAY` gives a kick.
- Space/atmosphere comes from `FX_DELAY_AMT`/`FX_DELAY_TIME` and slow `FX_PAN_FREQ` —
  that's the entire trick behind the 2025 background track.
- Loop seams: delay/release tails are truncated at the buffer end (the game loops the
  WAV, it doesn't crossfade). Keep the final rows sparse and land the harmony so the
  restart downbeat masks the cut — verify by checking RMS over the last ~200 ms.
- Technique for calm/atmospheric briefs: a deep, slow foundation (low drone bass,
  long attack/release) with a light, sparse melody floating on top — and not much in
  between. Depth contrast beats layer count in a sine-only palette: two or three
  well-separated registers stay clearer than four layers competing in the middle.
  Leave rows empty; the delay fills them. (Match the technique to the brief from
  workflow step 1 — a driving action loop wants different tools.)

## Editing existing sounds

The current songs live in `src/audio/songs/music-and-sounds.ts` (`song`, `winSound`,
`loseSound`), all sharing one soft sine-pad instrument. To shorten/rearrange music,
edit the per-channel `p` arrays and `endPattern` — patterns are reusable building
blocks, so rearrangement is free; new patterns cost bytes.

The interactive editor at https://sb.bitsnbites.eu/ is the alternative for composing
by ear ("Export as JS" produces this exact format, minus our trimmed-player limits).
There is no tool to generate its `?data=` share-URLs from JS — to hand-audition a song
in the UI, recreate it there manually or just use the render script.
