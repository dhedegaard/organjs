import { describe, expect, it } from 'vitest'
import { toMidiNote } from '../audio/notes'
import { keyLabelForNote, noteForKeyCode } from './qwerty'

describe('noteForKeyCode', () => {
  it('maps the lower row from C3', () => {
    expect(noteForKeyCode('KeyZ')).toBe(48)
    expect(noteForKeyCode('KeyS')).toBe(49)
    expect(noteForKeyCode('KeyM')).toBe(59)
    expect(noteForKeyCode('Comma')).toBe(60)
  })
  it('maps the upper row from C4', () => {
    expect(noteForKeyCode('KeyQ')).toBe(60)
    expect(noteForKeyCode('KeyP')).toBe(76)
  })
  it('ignores unmapped keys', () => {
    expect(noteForKeyCode('KeyA')).toBeUndefined()
  })
})

describe('keyLabelForNote', () => {
  it('prefers the upper-row key where both rows overlap', () => {
    expect(keyLabelForNote(toMidiNote(60)!)).toBe('Q')
  })
  it('uses punctuation labels', () => {
    expect(keyLabelForNote(toMidiNote(59)!)).toBe('M')
    expect(keyLabelForNote(toMidiNote(40)!)).toBeUndefined()
  })
})
