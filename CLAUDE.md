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

- `src/audio/` — framework-free engine. `notes.ts` (branded `MidiNote`/`Hertz` via zod), `voicing.ts` (drawbars → partials), `organ.ts` (`Organ` class: one voice per held note, one sine oscillator per drawbar, envelope, tremulant LFO, master gain → compressor). Nothing in here imports React.
- `src/input/` — QWERTY → note mapping, keyed on physical `KeyboardEvent.code`; `midi.ts` parses raw Web MIDI bytes with zod and maps CCs (11 volume, 12–20 drawbars, 92 tremulant, 93 percussion, 94 harmonic 2nd/3rd, 95 decay fast/slow; switches flip at 64) to settings patches.
- `src/hooks/` — `useOrgan` owns the `AudioContext` (created lazily on first note, browsers need a gesture) and the settings state, mirroring the engine's voice set after every `noteOn` (voices can be stolen); `useQwertyKeys` wires window key events and owns the octave shift (`,`/`.`); `useMidiInput` requests Web MIDI on `connect()` and drives the organ from the selected input; `useRegistrationUrl` mirrors settings into the URL hash.
- `src/state/registration.ts` — encode/decode the shareable registration (`d=888000000&t=1&p=1&h=3&dc=fast`) with zod; volume is deliberately excluded.
- `src/components/` — `Keyboard` (pointer glide via `elementFromPoint`, keys carry `data-midi`), `Drawbar`/`Drawbars` (custom `role=slider`, pull down = louder), `Tab` (rocker switch, optional `states` labels), `CopyLink`.
- `src/index.css` — single stylesheet, design tokens on `:root`. Dark room, walnut cabinet, ivory/ebony keys, Hammond cap colours (brown 16'/5⅓', black mutations, white unisons). One typeface: Instrument Sans.

## Conventions

- Raw numbers never reach the engine: parse with `midiNoteSchema` / `drawbarLevelsSchema` at boundaries (UI constants, DOM data attributes, key maps).
- Settings are immutable snapshots (`OrganSettings`); `Organ.update()` diffs by reference, so always create a new `drawbars` tuple (use `withLevel`).
- Pure logic (note math, voicing, key maps) gets a Vitest file next to it. Engine bookkeeping (voice count, triggering) is tested against `src/audio/testing/fakeAudioContext.ts`, which records nodes and last-set param values; anything that actually needs sound is verified in a real browser.
- `src/test/setup.ts` loads jest-dom matchers and testing-library `cleanup` (globals are off, so cleanup is not automatic). Small component tests with `render`/`screen` are fine.
- Hooks over browser APIs jsdom lacks (Web MIDI) are tested with `renderHook` against a fake installed via `Object.defineProperty(navigator, …)` and removed in `afterEach`. Test files are typechecked by `tsc -b` too, so no parameter properties in fakes.
- `useOrgan` is testable by installing `FakeAudioContext` as `window.AudioContext` the same way. Key handling hooks are tested by dispatching `new KeyboardEvent('keydown', { code })` on `window` inside `act`. Hooks that write `location.hash` need `vi.useFakeTimers()` for the debounce and `history.replaceState(null, '', location.pathname)` in `afterEach`.
- oxlint enforces React purity: never write `ref.current` during render (do it in an effect), and keep mutable host objects (`MIDIAccess`, `AudioContext`) in refs, not state — mutating a `useState` value is flagged.
- Design intent lives in `BACKLOG.md` (what's next) and the token block at the top of `index.css`.
- Module-level `toMidiNote()` results don't narrow inside components (control flow stops at function boundaries); use `midiNoteSchema.parse(48)` for constants.
- Offline engine checks: call `ctx.suspend(t).then(...)` *before* `await ctx.startRendering()` on an `OfflineAudioContext`; awaiting the suspend first deadlocks.

## Verifying in a browser

- No Chrome on this machine; use Playwright's cached Chromium (`npx playwright install chromium` once). Run a throwaway script from the scratchpad, not the repo: `npm init -y && npm i playwright`, then drive `http://localhost:<port>` and screenshot.
- Playwright's Chromium rejects `requestMIDIAccess` even after `grantPermissions(['midi'])`; verify MIDI by stubbing `navigator.requestMIDIAccess` with a fake access object via `addInitScript` and pushing bytes to `input.onmidimessage`.
- Start the dev server on a fixed port (`npm run dev -- --port 5180`) and stop it by PID via `lsof -ti:5180`, never by name.
- After engine changes that affect which voices sound, assert the `.key--down` count against the engine in the Playwright pass; `activeNotes` in the UI is derived from the engine and can drift.
