import { describe, expect, it } from 'vitest'
import { midiNoteSchema } from '../audio/notes'
import { EMPTY_SEQUENCE, newNoteId, sequenceLength, sequenceSchema } from './sequence'

const note = (n: number) => midiNoteSchema.parse(n)

describe('sequenceLength', () => {
  it('is zero for an empty sequence', () => {
    expect(sequenceLength(EMPTY_SEQUENCE)).toBe(0)
  })
  it('ends at the tail of the last note or control, whichever is later', () => {
    expect(
      sequenceLength({
        notes: [{ id: 'a', note: note(60), start: 1, duration: 2 }],
        controls: [{ time: 2.5, controller: 92, value: 127 }],
      }),
    ).toBe(3)
    expect(sequenceLength({ notes: [], controls: [{ time: 4, controller: 92, value: 0 }] })).toBe(4)
  })
})

describe('sequenceSchema', () => {
  it('rejects zero-length notes and out-of-range bytes', () => {
    expect(sequenceSchema.safeParse({ notes: [{ id: 'a', note: 60, start: 0, duration: 0 }], controls: [] }).success).toBe(false)
    expect(sequenceSchema.safeParse({ notes: [], controls: [{ time: 0, controller: 128, value: 0 }] }).success).toBe(false)
  })
})

describe('newNoteId', () => {
  it('is unique', () => {
    expect(newNoteId()).not.toBe(newNoteId())
  })
})
