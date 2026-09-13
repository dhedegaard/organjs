import { toMidiNote, type MidiNote } from '../audio/notes'

/** Physical key codes for the two piano rows. Lower row starts at C3, upper at C4. */
const LOWER_ROW = [
  'KeyZ', 'KeyS', 'KeyX', 'KeyD', 'KeyC', 'KeyV', 'KeyG', 'KeyB', 'KeyH', 'KeyN', 'KeyJ', 'KeyM',
  'Comma', 'KeyL', 'Period', 'Semicolon', 'Slash',
] as const
const UPPER_ROW = [
  'KeyQ', 'Digit2', 'KeyW', 'Digit3', 'KeyE', 'KeyR', 'Digit5', 'KeyT', 'Digit6', 'KeyY', 'Digit7', 'KeyU',
  'KeyI', 'Digit9', 'KeyO', 'Digit0', 'KeyP',
] as const

const LOWER_BASE = 48
const UPPER_BASE = 60

const LABELS: Readonly<Record<string, string>> = {
  Comma: ',', Period: '.', Semicolon: ';', Slash: '/',
}

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

export const QWERTY_MAP = buildMap()

export function noteForKeyCode(code: string): MidiNote | undefined {
  return QWERTY_MAP.get(code)
}

/** Short label for the physical key that plays a note, if any. */
export function keyLabelForNote(note: MidiNote): string | undefined {
  for (const [code, mapped] of QWERTY_MAP) {
    if (mapped === note) return LABELS[code] ?? code.replace(/^(Key|Digit)/, '')
  }
  return undefined
}
