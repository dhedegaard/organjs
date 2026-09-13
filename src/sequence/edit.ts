import { toMidiNote, type MidiNote } from '../audio/notes'
import { newNoteId, type Sequence, type SequenceNote } from './sequence'

/** Shortest note the editor will produce. */
export const MIN_NOTE_SECONDS = 0.05

/** Snap grids in seconds; at the 120 BPM the MIDI export uses these are 1/4, 1/8 and 1/16 notes. */
export const GRID_OPTIONS = [
  { label: 'Off', seconds: 0 },
  { label: '1/4', seconds: 0.5 },
  { label: '1/8', seconds: 0.25 },
  { label: '1/16', seconds: 0.125 },
] as const

export type GridSeconds = (typeof GRID_OPTIONS)[number]['seconds']

export function snapTime(time: number, grid: number): number {
  if (grid <= 0) return Math.max(0, time)
  return Math.max(0, Math.round(time / grid) * grid)
}

export function addNote(sequence: Sequence, note: MidiNote, start: number, duration: number): { sequence: Sequence; id: string } {
  const id = newNoteId()
  const added: SequenceNote = { id, note, start: Math.max(0, start), duration: Math.max(MIN_NOTE_SECONDS, duration) }
  return { sequence: { ...sequence, notes: [...sequence.notes, added] }, id }
}

function updateNote(sequence: Sequence, id: string, change: (note: SequenceNote) => SequenceNote): Sequence {
  let touched = false
  const notes = sequence.notes.map((n) => {
    if (n.id !== id) return n
    touched = true
    return change(n)
  })
  return touched ? { ...sequence, notes } : sequence
}

/** Shift a note in time and pitch. Pitch changes that leave the MIDI range are dropped, time is clamped at 0. */
export function moveNote(sequence: Sequence, id: string, deltaSeconds: number, deltaSemitones: number): Sequence {
  return updateNote(sequence, id, (n) => ({
    ...n,
    start: Math.max(0, n.start + deltaSeconds),
    note: toMidiNote(n.note + deltaSemitones) ?? n.note,
  }))
}

export function resizeNote(sequence: Sequence, id: string, duration: number): Sequence {
  return updateNote(sequence, id, (n) => ({ ...n, duration: Math.max(MIN_NOTE_SECONDS, duration) }))
}

export function deleteNotes(sequence: Sequence, ids: ReadonlySet<string>): Sequence {
  if (ids.size === 0) return sequence
  return { ...sequence, notes: sequence.notes.filter((n) => !ids.has(n.id)) }
}
