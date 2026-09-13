import { toMidiNote, type MidiNote } from '../audio/notes'

/** Physical key codes for the two piano rows. Lower row is C3–B3, upper starts at C4. */
const LOWER_ROW = [
  'KeyZ', 'KeyS', 'KeyX', 'KeyD', 'KeyC', 'KeyV', 'KeyG', 'KeyB', 'KeyH', 'KeyN', 'KeyJ', 'KeyM',
] as const
const UPPER_ROW = [
  'KeyQ', 'Digit2', 'KeyW', 'Digit3', 'KeyE', 'KeyR', 'Digit5', 'KeyT', 'Digit6', 'KeyY', 'Digit7', 'KeyU',
  'KeyI', 'Digit9', 'KeyO', 'Digit0', 'KeyP',
] as const

const LOWER_BASE = 48
const UPPER_BASE = 60

/** Octave shift applied to both rows, in whole octaves. */
export type OctaveShift = number
export const OCTAVE_SHIFT_MIN = -2
export const OCTAVE_SHIFT_MAX = 2

const OCTAVE_STEPS: Readonly<Record<string, 1 | -1>> = { Comma: -1, Period: 1 }

function buildMap(): ReadonlyMap<string, MidiNote> {
  const map = new Map<string, MidiNote>()
  const add = (codes: readonly string[], base: number) => {
    codes.forEach((code, i) => {
      const note = toMidiNote(base + i)
      if (note !== undefined && !map.has(code)) map.set(code, note)
    })
  }
  add(UPPER_ROW, UPPER_BASE)
  add(LOWER_ROW, LOWER_BASE)
  return map
}

/** Unshifted map; callers apply the octave shift via `noteForKeyCode`. */
export const QWERTY_MAP = buildMap()

export function noteForKeyCode(code: string, octave: OctaveShift = 0): MidiNote | undefined {
  const base = QWERTY_MAP.get(code)
  return base === undefined ? undefined : toMidiNote(base + octave * 12)
}

/** −1 for the octave-down key, +1 for octave-up, undefined for anything else. */
export function octaveStepForKeyCode(code: string): 1 | -1 | undefined {
  return OCTAVE_STEPS[code]
}

export function clampOctave(octave: number): OctaveShift {
  return Math.min(OCTAVE_SHIFT_MAX, Math.max(OCTAVE_SHIFT_MIN, octave))
}

/** Short label for the physical key that plays a note at the current shift, if any. */
export function keyLabelForNote(note: MidiNote, octave: OctaveShift = 0): string | undefined {
  const unshifted = note - octave * 12
  for (const [code, mapped] of QWERTY_MAP) {
    if (mapped === unshifted) return code.replace(/^(Key|Digit)/, '')
  }
  return undefined
}
