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
- `src/input/` — QWERTY → note mapping, keyed on physical `KeyboardEvent.code`.
- `src/hooks/` — `useOrgan` owns the `AudioContext` (created lazily on first note, browsers need a gesture) and the settings state; `useQwertyKeys` wires window key events.
- `src/components/` — `Keyboard` (pointer glide via `elementFromPoint`, keys carry `data-midi`), `Drawbar`/`Drawbars` (custom `role=slider`, pull down = louder), `Tab` (rocker switch).
- `src/index.css` — single stylesheet, design tokens on `:root`. Dark room, walnut cabinet, ivory/ebony keys, Hammond cap colours (brown 16'/5⅓', black mutations, white unisons). One typeface: Instrument Sans.

## Conventions

- Raw numbers never reach the engine: parse with `midiNoteSchema` / `drawbarLevelsSchema` at boundaries (UI constants, DOM data attributes, key maps).
- Settings are immutable snapshots (`OrganSettings`); `Organ.update()` diffs by reference, so always create a new `drawbars` tuple (use `withLevel`).
- Pure logic (note math, voicing, key maps) gets a Vitest file next to it. Audio and UI are verified in a real browser; jsdom has no `AudioContext`.
- Design intent lives in `BACKLOG.md` (what's next) and the token block at the top of `index.css`.
