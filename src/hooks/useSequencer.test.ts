import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { midiNoteSchema } from '../audio/notes'
import { FakeAudioContext } from '../audio/testing/fakeAudioContext'
import { CC_TREMULANT } from '../input/midi'
import type { Sequence } from '../sequence/sequence'
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

describe('useSequencer playback', () => {
  let now = 0
  const clock = () => now

  beforeEach(() => {
    now = 0
    vi.useFakeTimers()
    Object.defineProperty(window, 'AudioContext', { value: FakeAudioContext, configurable: true })
  })
  afterEach(() => {
    vi.useRealTimers()
    Reflect.deleteProperty(window, 'AudioContext')
  })

  const setup = () =>
    renderHook(() => {
      const organ = useOrgan()
      return { organ, sequencer: useSequencer(organ, clock) }
    })

  const recorded: Sequence = {
    notes: [{ id: 'a', note: note(60), start: 0.5, duration: 1 }],
    controls: [{ time: 0, controller: CC_TREMULANT, value: 127 }],
  }

  /** Advance the fake clock and the interval timers together. */
  const advance = (seconds: number) => {
    now += seconds
    act(() => vi.advanceTimersByTime(seconds * 1000))
  }

  it('plays the sequence through the organ, lighting the keys and applying controls', () => {
    const { result } = setup()
    act(() => result.current.sequencer.setSequence(recorded))
    expect(result.current.sequencer.playback.duration).toBe(1.5)
    act(() => result.current.sequencer.playback.play())
    expect(result.current.sequencer.playback.state).toBe('playing')
    advance(0.1)
    expect(result.current.organ.settings.tremulant).toBe(true)
    expect(result.current.organ.activeNotes.size).toBe(0)
    advance(0.5)
    expect(result.current.organ.activeNotes.has(note(60))).toBe(true)
    expect(result.current.sequencer.playback.position).toBeGreaterThan(0.5)
    advance(1.5)
    expect(result.current.organ.activeNotes.size).toBe(0)
    expect(result.current.sequencer.playback.state).toBe('stopped')
    expect(result.current.sequencer.playback.position).toBe(0)
  })

  it('loops when asked and stops on demand', () => {
    const { result } = setup()
    act(() => result.current.sequencer.setSequence(recorded))
    act(() => result.current.sequencer.playback.setLoop(true))
    act(() => result.current.sequencer.playback.play())
    advance(2.1)
    expect(result.current.sequencer.playback.state).toBe('playing')
    expect(result.current.organ.activeNotes.has(note(60))).toBe(true)
    act(() => result.current.sequencer.playback.stop())
    expect(result.current.sequencer.playback.state).toBe('stopped')
    expect(result.current.organ.activeNotes.size).toBe(0)
  })

  it('starting a recording stops playback, and playing stops a recording', () => {
    const { result } = setup()
    act(() => result.current.sequencer.setSequence(recorded))
    act(() => result.current.sequencer.playback.play())
    act(() => result.current.sequencer.startRecording())
    expect(result.current.sequencer.playback.state).toBe('stopped')
    expect(result.current.sequencer.recording).toBe(true)
    act(() => result.current.sequencer.playback.play())
    expect(result.current.sequencer.recording).toBe(false)
  })
})
