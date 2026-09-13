import { describe, expect, it } from 'vitest'
import { midiNoteSchema } from '../audio/notes'
import { spell, staffOf, toScore, UNIT_SECONDS, valueGlyph, type ScoreEvent } from './notation'
import type { Sequence } from './sequence'

const n = (v: number) => midiNoteSchema.parse(v)
const seq = (notes: ReadonlyArray<readonly [pitch: number, start: number, duration: number]>): Sequence => ({
  notes: notes.map(([pitch, start, duration], i) => ({ id: String(i), note: n(pitch), start, duration })),
  controls: [],
})
const shape = (events: readonly ScoreEvent[]) =>
  events.map((e) => (e.kind === 'rest' ? `r${e.start}+${e.duration}` : `c${e.start}+${e.duration}:${e.pitches.join(',')}${e.ties.length ? '~' : ''}`))

describe('spell', () => {
  it('spells white keys as naturals on their diatonic step', () => {
    expect(spell(n(60))).toEqual({ step: 35, sharp: false }) // C4
    expect(spell(n(64))).toEqual({ step: 37, sharp: false }) // E4
    expect(spell(n(71))).toEqual({ step: 41, sharp: false }) // B4
  })
  it('spells black keys as the sharp of the step below', () => {
    expect(spell(n(61))).toEqual({ step: 35, sharp: true }) // C#4
    expect(spell(n(70))).toEqual({ step: 40, sharp: true }) // A#4
  })
})

describe('staffOf', () => {
  it('puts middle C and above on the treble staff', () => {
    expect(staffOf(n(60))).toBe('treble')
    expect(staffOf(n(59))).toBe('bass')
  })
})

describe('valueGlyph', () => {
  it('maps unit counts to head, flags and dot', () => {
    expect(valueGlyph(16)).toEqual({ head: 'whole', flags: 0, dotted: false })
    expect(valueGlyph(12)).toEqual({ head: 'half', flags: 0, dotted: true })
    expect(valueGlyph(3)).toEqual({ head: 'black', flags: 1, dotted: true })
    expect(valueGlyph(1)).toEqual({ head: 'black', flags: 2, dotted: false })
  })
})

describe('toScore', () => {
  it('has one whole-bar rest per staff for an empty sequence', () => {
    const score = toScore({ notes: [], controls: [] })
    expect(score.measures).toBe(1)
    expect(shape(score.staves.treble)).toEqual(['r0+16'])
    expect(shape(score.staves.bass)).toEqual(['r0+16'])
  })

  it('quantises a note to sixteenths and pads the bar with rests', () => {
    // A quarter note on beat 2 of bar 1, slightly early and short.
    const score = toScore(seq([[60, 0.49, 0.47]]))
    expect(shape(score.staves.treble)).toEqual(['r0+4', 'c4+4:60', 'r8+8'])
    expect(shape(score.staves.bass)).toEqual(['r0+16'])
  })

  it('groups notes with the same span into a chord', () => {
    const score = toScore(seq([[60, 0, 0.5], [64, 0, 0.5], [67, 0, 0.5]]))
    expect(shape(score.staves.treble)).toEqual(['c0+4:60,64,67', 'r4+12'])
  })

  it('splits a note that crosses the barline and ties the halves', () => {
    const score = toScore(seq([[60, 1.5, 1]]))
    expect(score.measures).toBe(2)
    expect(shape(score.staves.treble)).toEqual(['r0+12', 'c12+4:60~', 'c16+4:60', 'r20+12'])
    expect(score.staves.treble[1]).toMatchObject({ ties: [60] })
  })

  it('breaks unrepresentable lengths into tied note values', () => {
    // 5 sixteenths from the downbeat: quarter + sixteenth.
    const score = toScore(seq([[60, 0, 5 * UNIT_SECONDS]]))
    expect(shape(score.staves.treble)).toEqual(['c0+4:60~', 'c4+1:60', 'r5+3', 'r8+8'])
  })

  it('cuts overlapping notes into chord segments tied where a pitch continues', () => {
    // C held for a half note, E joins for the second quarter.
    const score = toScore(seq([[60, 0, 1], [64, 0.5, 0.5]]))
    expect(shape(score.staves.treble)).toEqual(['c0+4:60~', 'c4+4:60,64', 'r8+8'])
  })

  it('never lets a short note vanish', () => {
    const score = toScore(seq([[48, 0.01, 0.01]]))
    expect(shape(score.staves.bass)).toEqual(['c0+1:48', 'r1+3', 'r4+12'])
  })

  it('marks sharps once per bar and naturals when the step reverts', () => {
    const score = toScore(seq([[61, 0, 0.5], [61, 0.5, 0.5], [60, 1, 0.5], [61, 2, 0.5]]))
    const chords = score.staves.treble.filter((e) => e.kind === 'chord')
    expect(chords.map((c) => c.accidentals)).toEqual([['sharp'], [null], ['natural'], ['sharp']])
  })
})
