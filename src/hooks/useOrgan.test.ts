import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { midiNoteSchema } from '../audio/notes'
import { MAX_VOICES } from '../audio/organ'
import { FakeAudioContext } from '../audio/testing/fakeAudioContext'
import { useOrgan } from './useOrgan'

const note = (n: number) => midiNoteSchema.parse(n)

describe('useOrgan', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'AudioContext', { value: FakeAudioContext, configurable: true })
  })
  afterEach(() => {
    Reflect.deleteProperty(window, 'AudioContext')
  })

  it('mirrors the engine when a voice is stolen, so the manual lights only sounding keys', () => {
    const { result } = renderHook(() => useOrgan())
    act(() => {
      for (let n = 36; n < 36 + MAX_VOICES + 4; n++) result.current.noteOn(note(n))
    })
    expect(result.current.activeNotes.size).toBe(MAX_VOICES)
    expect(result.current.activeNotes.has(note(36))).toBe(false)
    expect(result.current.activeNotes.has(note(36 + MAX_VOICES + 3))).toBe(true)
  })
})
