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
- `src/input/` — QWERTY → note mapping, keyed on physical `KeyboardEvent.code`; `midi.ts` parses raw Web MIDI bytes with zod and maps CCs (11 volume, 12–20 drawbars, 92 tremulant) to settings patches.
- `src/hooks/` — `useOrgan` owns the `AudioContext` (created lazily on first note, browsers need a gesture) and the settings state; `useQwertyKeys` wires window key events; `useMidiInput` requests Web MIDI on `connect()` and drives the organ from the selected input.
- `src/components/` — `Keyboard` (pointer glide via `elementFromPoint`, keys carry `data-midi`), `Drawbar`/`Drawbars` (custom `role=slider`, pull down = louder), `Tab` (rocker switch).
- `src/index.css` — single stylesheet, design tokens on `:root`. Dark room, walnut cabinet, ivory/ebony keys, Hammond cap colours (brown 16'/5⅓', black mutations, white unisons). One typeface: Instrument Sans.

## Conventions

- Raw numbers never reach the engine: parse with `midiNoteSchema` / `drawbarLevelsSchema` at boundaries (UI constants, DOM data attributes, key maps).
- Settings are immutable snapshots (`OrganSettings`); `Organ.update()` diffs by reference, so always create a new `drawbars` tuple (use `withLevel`).
- Pure logic (note math, voicing, key maps) gets a Vitest file next to it. Audio and UI are verified in a real browser; jsdom has no `AudioContext`.
- Hooks over browser APIs jsdom lacks (Web MIDI) are tested with `renderHook` against a fake installed via `Object.defineProperty(navigator, …)` and removed in `afterEach`. Test files are typechecked by `tsc -b` too, so no parameter properties in fakes.
- oxlint enforces React purity: never write `ref.current` during render (do it in an effect), and keep mutable host objects (`MIDIAccess`, `AudioContext`) in refs, not state — mutating a `useState` value is flagged.
- Design intent lives in `BACKLOG.md` (what's next) and the token block at the top of `index.css`.
- Module-level `toMidiNote()` results don't narrow inside components (control flow stops at function boundaries); use `midiNoteSchema.parse(48)` for constants.
- Offline engine checks: call `ctx.suspend(t).then(...)` *before* `await ctx.startRendering()` on an `OfflineAudioContext`; awaiting the suspend first deadlocks.

## Verifying in a browser

- No Chrome on this machine; use Playwright's cached Chromium (`npx playwright install chromium` once). Run a throwaway script from the scratchpad, not the repo: `npm init -y && npm i playwright`, then drive `http://localhost:<port>` and screenshot.
- Playwright's Chromium rejects `requestMIDIAccess` even after `grantPermissions(['midi'])`; verify MIDI by stubbing `navigator.requestMIDIAccess` with a fake access object via `addInitScript` and pushing bytes to `input.onmidimessage`.
- Start the dev server on a fixed port (`npm run dev -- --port 5180`) and stop it by PID via `lsof -ti:5180`, never by name.
