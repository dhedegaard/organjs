import { describe, expect, it } from 'vitest'
import {
  midiToFrequency,
  midiToName,
  isBlackKey,
  keyboardRange,
  toMidiNote,
  transpose,
  type MidiNote,
} from './notes'

function note(n: number): MidiNote {
  const parsed = toMidiNote(n)
  if (parsed === undefined) throw new Error(`invalid test note ${n}`)
  return parsed
}

describe('toMidiNote', () => {
  it('accepts 0..127 integers', () => {
    expect(toMidiNote(0)).toBe(0)
    expect(toMidiNote(127)).toBe(127)
  })
  it('rejects out-of-range or fractional values', () => {
    expect(toMidiNote(-1)).toBeUndefined()
    expect(toMidiNote(128)).toBeUndefined()
    expect(toMidiNote(60.5)).toBeUndefined()
  })
})

describe('midiToFrequency', () => {
  it('maps A4 (69) to 440 Hz', () => {
    expect(midiToFrequency(note(69))).toBeCloseTo(440)
  })
  it('maps C4 (60) to ~261.63 Hz', () => {
    expect(midiToFrequency(note(60))).toBeCloseTo(261.626, 2)
  })
  it('doubles per octave', () => {
    expect(midiToFrequency(note(81))).toBeCloseTo(880)
  })
})

describe('midiToName', () => {
  it('names middle C', () => {
    expect(midiToName(note(60))).toBe('C4')
  })
  it('names sharps', () => {
    expect(midiToName(note(61))).toBe('C#4')
    expect(midiToName(note(70))).toBe('A#4')
  })
})

describe('isBlackKey', () => {
  it('detects black keys within an octave', () => {
    const blacks = [61, 63, 66, 68, 70]
    for (let n = 60; n < 72; n++) {
      expect(isBlackKey(note(n))).toBe(blacks.includes(n))
    }
  })
})

describe('transpose', () => {
  it('shifts by semitones', () => {
    expect(transpose(note(60), 12)).toBe(72)
  })
  it('returns undefined when leaving the midi range', () => {
    expect(transpose(note(120), 12)).toBeUndefined()
  })
})

describe('keyboardRange', () => {
  it('returns inclusive midi numbers from low to high', () => {
    expect(keyboardRange(note(60), note(63))).toEqual([60, 61, 62, 63])
  })
})
