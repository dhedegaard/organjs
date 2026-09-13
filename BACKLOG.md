# Backlog

Rough order of value. Done items move to git history, not here.

## Sound

- [ ] Rotary speaker / chorus-vibrato (Leslie): stereo, slow/fast with ramp between speeds.
- [ ] Pipe-organ mode: sampled or wavetable stops (principal, flute, reed) as an alternative to drawbars.
- [ ] Reverb (convolution with a hall impulse) with a wet/dry control.
- [ ] Tune the compressor and per-partial scale by ear on real speakers; the limiter currently does a lot of work at 888 888 888.
- [ ] Expression pedal (volume swell) — MIDI CC 11 is already wired to volume; this is about an on-screen control.

## Playing

- [ ] Sustain / hold toggle so chords can be held while adjusting drawbars.
- [ ] Second manual (Swell/Great) and a pedalboard with their own drawbar sets.
- [ ] Touch: multi-finger chords on tablets (pointer map already supports multiple pointers; needs testing on device).

## Recording and editing

- [ ] Note record: capture note on/off (and drawbar/tremulant changes) with timestamps into an in-memory sequence while playing; start/stop control and a recording indicator.
- [ ] Note playback: play a recorded sequence back through the engine with the keys lighting up; play/pause/stop, loop, and tempo scaling.
- [ ] Note editor: piano-roll view of a recording where notes can be added, moved, resized and deleted, with snap-to-grid and undo. Save/load sequences (local storage first, file export later, MIDI file import/export as a stretch).

## Console UI

- [ ] Save/load named registrations (local storage). The URL hash already carries the current one.
- [ ] Drawbar numbers editable by typing; show the classic `888 000 000` string.
- [ ] Visual level meter so the user sees when the limiter engages.
- [ ] Keyboard-navigable manual (arrow keys move focus, Space plays) for accessibility.
- [ ] Reduced-motion and high-contrast passes.

## Engineering

- [ ] Browser-level tests (Playwright) for press/glide/QWERTY/drawbar flows — the checks done manually during the first build.
- [ ] Offline-render regression test for the engine (render 1s through `OfflineAudioContext`, assert RMS/peak bounds).
- [ ] AudioWorklet engine if oscillator-per-partial gets expensive with more manuals.
- [ ] PWA manifest + offline caching so it works as an installed instrument.
- [ ] Deploy (static hosting) and add a CI workflow running typecheck, lint, test, build.
