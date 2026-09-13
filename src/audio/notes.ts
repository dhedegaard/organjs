import * as z from 'zod'

export const midiNoteSchema = z.number().int().min(0).max(127).brand<'MidiNote'>()
export type MidiNote = z.infer<typeof midiNoteSchema>

export const hertzSchema = z.number().positive().brand<'Hertz'>()
export type Hertz = z.infer<typeof hertzSchema>

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const
const BLACK_PITCH_CLASSES: ReadonlySet<number> = new Set([1, 3, 6, 8, 10])

/** Parse a raw number into a MidiNote, or return undefined if out of range. */
export function toMidiNote(value: number): MidiNote | undefined {
  const result = midiNoteSchema.safeParse(value)
  return result.success ? result.data : undefined
}

export function midiToFrequency(midi: MidiNote): Hertz {
  return hertzSchema.parse(440 * 2 ** ((midi - 69) / 12))
}

export function midiToName(midi: MidiNote): string {
  const name = NOTE_NAMES[midi % 12]
  const octave = Math.floor(midi / 12) - 1
  return `${name}${octave}`
}

export function isBlackKey(midi: MidiNote): boolean {
  return BLACK_PITCH_CLASSES.has(midi % 12)
}

export function transpose(midi: MidiNote, semitones: number): MidiNote | undefined {
  return toMidiNote(midi + semitones)
}

/** Inclusive range of notes from low to high. */
export function keyboardRange(low: MidiNote, high: MidiNote): MidiNote[] {
  const notes: MidiNote[] = []
  for (let n = low; n <= high; n++) {
    const note = toMidiNote(n)
    if (note !== undefined) notes.push(note)
  }
  return notes
}
