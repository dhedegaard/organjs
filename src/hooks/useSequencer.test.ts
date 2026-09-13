import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { midiNoteSchema } from '../audio/notes'
import { FakeAudioContext } from '../audio/testing/fakeAudioContext'
import { CC_TREMULANT } from '../input/midi'
import { useOrgan } from './useOrgan'
import { useSequencer } from './useSequencer'

const note = (n: number) => midiNoteSchema.parse(n)

describe('useSequencer', () => {
  let now = 0
  const clock = () => now

  beforeEach(() => {
    now = 0
    Object.defineProperty(window, 'AudioContext', { value: FakeAudioContext, configurable: true })
  })
  afterEach(() => {
    Reflect.deleteProperty(window, 'AudioContext')
  })

  const setup = () =>
    renderHook(() => {
      const organ = useOrgan()
      return { organ, sequencer: useSequencer(organ, clock) }
    })

  it('plays notes through to the organ whether or not it is recording', () => {
    const { result } = setup()
    act(() => result.current.sequencer.noteOn(note(60)))
    expect(result.current.organ.activeNotes.has(note(60))).toBe(true)
    act(() => result.current.sequencer.noteOff(note(60)))
    expect(result.current.organ.activeNotes.size).toBe(0)
    expect(result.current.sequencer.sequence.notes).toEqual([])
  })

  it('captures notes played while recording', () => {
    const { result } = setup()
    act(() => result.current.sequencer.startRecording())
    expect(result.current.sequencer.recording).toBe(true)
    now = 1
    act(() => result.current.sequencer.noteOn(note(60)))
    now = 1.5
    act(() => result.current.sequencer.noteOff(note(60)))
    now = 2
    act(() => result.current.sequencer.stopRecording())
    expect(result.current.sequencer.recording).toBe(false)
    expect(result.current.sequencer.sequence.notes).toEqual([{ id: expect.any(String), note: 60, start: 1, duration: 0.5 }])
  })

  it('captures settings changes made through the organ', () => {
    const { result } = setup()
    act(() => result.current.sequencer.startRecording())
    now = 3
    act(() => result.current.organ.updateSettings({ tremulant: true }))
    act(() => result.current.sequencer.stopRecording())
    expect(result.current.sequencer.sequence.controls).toContainEqual({ time: 3, controller: CC_TREMULANT, value: 127 })
  })
})
