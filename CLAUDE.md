# organjs

A browser organ: Vite + React 19 + TypeScript, Web Audio additive synthesis, no backend.

## Commands

- `npm run dev` — dev server
- `npm run typecheck` — `tsc -b` (strict, `erasableSyntaxOnly`: no parameter properties or enums)
- `npm run lint` — oxlint
- `npm test` — Vitest (jsdom). `npm run test:watch` for watch mode
- `npm run build` — typecheck + production build

Run typecheck, lint and test before claiming work is done.

## Layout

- `src/audio/` — framework-free engine. `notes.ts` (branded `MidiNote`/`Hertz` via zod), `voicing.ts` (drawbars → partials), `organ.ts` (`Organ` class: one voice per held note, one sine oscillator per drawbar, envelope, tremulant LFO, key-click noise bursts from a shared buffer, master gain → compressor). Nothing in here imports React.
- `src/input/` — QWERTY → note mapping, keyed on physical `KeyboardEvent.code`; `midi.ts` parses raw Web MIDI bytes with zod and maps CCs (11 volume, 12–20 drawbars, 92 tremulant, 93 percussion, 94 harmonic 2nd/3rd, 95 decay fast/slow, 96 key click; switches flip at 64) to settings patches.
- `src/hooks/` — `useOrgan` owns the `AudioContext` (created lazily on first note, browsers need a gesture) and the settings state, mirroring the engine's voice set after every `noteOn` (voices can be stolen); `useQwertyKeys` wires window key events and owns the octave shift (`,`/`.`); `useMidiInput` requests Web MIDI on `connect()` and drives the organ from the selected input; `useRegistrationUrl` mirrors settings into the URL hash; `useSequencer` wraps the organ's `noteOn`/`noteOff` (all inputs play through it), records settings changes by diffing `organ.settings`, ticks the `Player` every 10 ms, and keeps the sequence in a `useHistory` undo stack; `useRecordings` is the local-storage library.
- `src/sequence/` — framework-free recording: `sequence.ts` (zod `Sequence`: notes as start/duration intervals, settings changes as raw CCs), `recorder.ts` (live events → sequence), `player.ts` (steps a sequence against an injected clock; off before CC before on at equal times), `edit.ts` (pure piano-roll edits, snap grid), `midiFile.ts` (SMF format 0 writer / format 0–2 reader, 480 PPQ at 120 BPM, tempo map honoured), `storage.ts` (named recordings in local storage), `time.ts`.
- `src/state/registration.ts` — encode/decode the shareable registration (`d=888000000&t=1&p=1&h=3&dc=fast&k=0`) with zod; volume is deliberately excluded.
- `src/components/` — `Keyboard` (pointer glide via `elementFromPoint`, keys carry `data-midi`), `Drawbar`/`Drawbars` (custom `role=slider`, pull down = louder), `Tab` (rocker switch, optional `states` labels), `CopyLink`, `Transport` (record/play/loop/tempo), `PianoRoll` (SVG editor; pointer maths from `getBoundingClientRect`, tests pin it with a spy), `Library` (save/load, .mid import/export).
- `src/index.css` — single stylesheet, design tokens on `:root`. Dark room, walnut cabinet, ivory/ebony keys, Hammond cap colours (brown 16'/5⅓', black mutations, white unisons). One typeface: Instrument Sans.

## Conventions

- Raw numbers never reach the engine: parse with `midiNoteSchema` / `drawbarLevelsSchema` at boundaries (UI constants, DOM data attributes, key maps).
- Settings are immutable snapshots (`OrganSettings`); `Organ.update()` diffs by reference, so always create a new `drawbars` tuple (use `withLevel`).
- Pure logic (note math, voicing, key maps) gets a Vitest file next to it. Engine bookkeeping (voice count, triggering) is tested against `src/audio/testing/fakeAudioContext.ts`, which records nodes and last-set param values; anything that actually needs sound is verified in a real browser.
- `src/test/setup.ts` loads jest-dom matchers and testing-library `cleanup` (globals are off, so cleanup is not automatic). Small component tests with `render`/`screen` are fine.
- Hooks over browser APIs jsdom lacks (Web MIDI) are tested with `renderHook` against a fake installed via `Object.defineProperty(navigator, …)` and removed in `afterEach`. Test files are typechecked by `tsc -b` too, so no parameter properties in fakes.
- Hooks that read time take an injectable `clock: () => number` (seconds) so tests set `now` directly; combine with `vi.useFakeTimers()` to drive the sequencer's intervals.
- `useOrgan` is testable by installing `FakeAudioContext` as `window.AudioContext` the same way. Key handling hooks are tested by dispatching `new KeyboardEvent('keydown', { code })` on `window` inside `act`. Hooks that write `location.hash` need `vi.useFakeTimers()` for the debounce and `history.replaceState(null, '', location.pathname)` in `afterEach`.
- oxlint enforces React purity: never write `ref.current` during render (do it in an effect), and keep mutable host objects (`MIDIAccess`, `AudioContext`) in refs, not state — mutating a `useState` value is flagged.
- Design intent lives in `BACKLOG.md` (what's next) and the token block at the top of `index.css`.
- Module-level `toMidiNote()` results don't narrow inside components (control flow stops at function boundaries); use `midiNoteSchema.parse(48)` for constants.
- Offline engine checks: call `ctx.suspend(t).then(...)` *before* `await ctx.startRendering()` on an `OfflineAudioContext`; awaiting the suspend first deadlocks.
- In component tests use `fireEvent.click(...)`, not `element.click()`: the latter runs outside `act`, so state set by the handler is not flushed before the next assertion.
- Bytes handed to `Blob`/`File` must be `Uint8Array<ArrayBuffer>`; build them with `new Uint8Array([...])`, not `Uint8Array.from(...)`, or `tsc` rejects the `BlobPart`.

## Verifying in a browser

- No Chrome on this machine; use Playwright's cached Chromium (`npx playwright install chromium` once). Run a throwaway script from the scratchpad, not the repo: `npm init -y && npm i playwright`, then drive `http://localhost:<port>` and screenshot.
- Playwright's Chromium rejects `requestMIDIAccess` even after `grantPermissions(['midi'])`; verify MIDI by stubbing `navigator.requestMIDIAccess` with a fake access object via `addInitScript` and pushing bytes to `input.onmidimessage`.
- Start the dev server on a fixed port (`npm run dev -- --port 5180`) and stop it by PID via `lsof -ti:5180`, never by name.
- After engine changes that affect which voices sound, assert the `.key--down` count against the engine in the Playwright pass; `activeNotes` in the UI is derived from the engine and can drift.
- Press keys with `page.mouse` on the key's `boundingBox()`; `locator.dispatchEvent('pointerdown')` has no coordinates, so the `elementFromPoint` hit-test finds nothing and no note plays.
- Exercise file import/export with `newPage({ acceptDownloads: true })` + `waitForEvent('download')` and `locator('.library__file').setInputFiles({ name, mimeType, buffer })`.
- When comparing levels in an offline render, schedule the first event at ~0.1 s, not 0: the compressor and filters have a startup transient that skews peaks at t=0.
