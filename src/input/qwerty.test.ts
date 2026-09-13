import { describe, expect, it } from 'vitest'
import { toMidiNote } from '../audio/notes'
import { clampOctave, keyLabelForNote, noteForKeyCode, octaveStepForKeyCode } from './qwerty'

describe('noteForKeyCode', () => {
  it('maps the lower row from C3 to B3', () => {
    expect(noteForKeyCode('KeyZ')).toBe(48)
    expect(noteForKeyCode('KeyS')).toBe(49)
    expect(noteForKeyCode('KeyM')).toBe(59)
  })
  it('maps the upper row from C4', () => {
    expect(noteForKeyCode('KeyQ')).toBe(60)
    expect(noteForKeyCode('KeyP')).toBe(76)
  })
  it('no longer maps the punctuation keys, which shift octaves', () => {
    expect(noteForKeyCode('Comma')).toBeUndefined()
    expect(noteForKeyCode('Period')).toBeUndefined()
    expect(noteForKeyCode('Semicolon')).toBeUndefined()
    expect(noteForKeyCode('Slash')).toBeUndefined()
  })
  it('ignores unmapped keys', () => {
    expect(noteForKeyCode('KeyA')).toBeUndefined()
  })
  it('shifts by whole octaves', () => {
    expect(noteForKeyCode('KeyZ', 1)).toBe(60)
    expect(noteForKeyCode('KeyZ', -2)).toBe(24)
    expect(noteForKeyCode('KeyP', 2)).toBe(100)
  })
})

describe('octaveStepForKeyCode', () => {
  it('comma steps down, period steps up', () => {
    expect(octaveStepForKeyCode('Comma')).toBe(-1)
    expect(octaveStepForKeyCode('Period')).toBe(1)
    expect(octaveStepForKeyCode('KeyZ')).toBeUndefined()
  })
})

describe('clampOctave', () => {
  it('keeps the shift within two octaves either way', () => {
    expect(clampOctave(0)).toBe(0)
    expect(clampOctave(3)).toBe(2)
    expect(clampOctave(-5)).toBe(-2)
  })
})

describe('keyLabelForNote', () => {
  it('prefers the upper-row key where both rows overlap', () => {
    expect(keyLabelForNote(toMidiNote(60)!)).toBe('Q')
  })
  it('labels notes relative to the octave shift', () => {
    expect(keyLabelForNote(toMidiNote(59)!)).toBe('M')
    expect(keyLabelForNote(toMidiNote(71)!, 1)).toBe('M')
    expect(keyLabelForNote(toMidiNote(40)!)).toBeUndefined()
  })
})
