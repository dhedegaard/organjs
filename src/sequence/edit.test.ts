import { describe, expect, it } from 'vitest'
import { midiNoteSchema } from '../audio/notes'
import { addNote, deleteNotes, MIN_NOTE_SECONDS, moveNote, resizeNote, snapTime } from './edit'
import { EMPTY_SEQUENCE, type Sequence } from './sequence'

const note = (n: number) => midiNoteSchema.parse(n)
const one: Sequence = { notes: [{ id: 'a', note: note(60), start: 1, duration: 0.5 }], controls: [] }

describe('snapTime', () => {
  it('rounds to the nearest grid line and never goes negative', () => {
    expect(snapTime(0.6, 0.5)).toBe(0.5)
    expect(snapTime(0.76, 0.5)).toBe(1)
    expect(snapTime(-0.2, 0.5)).toBe(0)
  })
  it('leaves time alone with the grid off', () => {
    expect(snapTime(0.61, 0)).toBe(0.61)
    expect(snapTime(-1, 0)).toBe(0)
  })
})

describe('addNote', () => {
  it('appends a note with a fresh id and a minimum length', () => {
    const { sequence, id } = addNote(EMPTY_SEQUENCE, note(62), 2, 0)
    expect(sequence.notes).toEqual([{ id, note: 62, start: 2, duration: MIN_NOTE_SECONDS }])
    expect(EMPTY_SEQUENCE.notes).toEqual([])
  })
})

describe('moveNote', () => {
  it('shifts start and pitch', () => {
    expect(moveNote(one, 'a', 0.25, 2).notes[0]).toMatchObject({ start: 1.25, note: 62 })
  })
  it('clamps the start at zero and keeps the pitch when it would leave the range', () => {
    expect(moveNote(one, 'a', -5, 100).notes[0]).toMatchObject({ start: 0, note: 60 })
  })
  it('returns the same sequence for an unknown id', () => {
    expect(moveNote(one, 'zzz', 1, 1)).toBe(one)
  })
})

describe('resizeNote', () => {
  it('sets the duration, not shorter than the minimum', () => {
    expect(resizeNote(one, 'a', 2).notes[0]?.duration).toBe(2)
    expect(resizeNote(one, 'a', -1).notes[0]?.duration).toBe(MIN_NOTE_SECONDS)
  })
})

describe('deleteNotes', () => {
  it('removes the given ids and leaves controls alone', () => {
    const seq = { ...one, controls: [{ time: 0, controller: 92, value: 127 }] }
    expect(deleteNotes(seq, new Set(['a']))).toEqual({ notes: [], controls: seq.controls })
    expect(deleteNotes(seq, new Set())).toBe(seq)
  })
})
