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

- [ ] Score view: beam eighths/sixteenths within a beat instead of flags; separate voices when a held note overlaps a moving line (today everything is cut into tied chords).
- [ ] Score view: quantise action that writes the snapped timing back to the sequence.
- [ ] Editing in the score (click a staff position to add, drag to move) — the piano roll stays the primary editor.

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
