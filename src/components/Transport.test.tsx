import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { PlaybackController, SequencerController } from '../hooks/useSequencer'
import { EMPTY_SEQUENCE } from '../sequence/sequence'
import { formatSeconds } from '../sequence/time'
import { Transport } from './Transport'

const playback = (patch: Partial<PlaybackController> = {}): PlaybackController => ({
  state: 'stopped',
  position: 0,
  duration: 0,
  rate: 1,
  loop: false,
  play: vi.fn(),
  pause: vi.fn(),
  stop: vi.fn(),
  seek: vi.fn(),
  setRate: vi.fn(),
  setLoop: vi.fn(),
  ...patch,
})

const sequencer = (patch: Partial<SequencerController>): SequencerController => ({
  sequence: EMPTY_SEQUENCE,
  setSequence: vi.fn(),
  recording: false,
  recordingSeconds: 0,
  startRecording: vi.fn(),
  stopRecording: vi.fn(),
  playback: playback(),
  noteOn: vi.fn(),
  noteOff: vi.fn(),
  ...patch,
})

describe('formatSeconds', () => {
  it('shows minutes, seconds and tenths', () => {
    expect(formatSeconds(0)).toBe('0:00.0')
    expect(formatSeconds(65.27)).toBe('1:05.2')
  })
})

describe('Transport', () => {
  it('starts recording from the record button', () => {
    const start = vi.fn()
    render(<Transport sequencer={sequencer({ startRecording: start })} />)
    screen.getByRole('button', { name: 'Record' }).click()
    expect(start).toHaveBeenCalled()
  })
  it('shows the elapsed time and stops when pressed again', () => {
    const stop = vi.fn()
    render(<Transport sequencer={sequencer({ recording: true, recordingSeconds: 12.3, stopRecording: stop })} />)
    expect(screen.getByRole('timer')).toHaveTextContent('0:12.3')
    screen.getByRole('button', { name: 'Stop recording', pressed: true }).click()
    expect(stop).toHaveBeenCalled()
  })
  it('disables play with nothing recorded', () => {
    render(<Transport sequencer={sequencer({})} />)
    expect(screen.getByRole('button', { name: 'Play' })).toBeDisabled()
  })
  it('plays, pauses and shows position over duration', () => {
    const play = vi.fn()
    const pause = vi.fn()
    const seq = { notes: [{ id: 'a', note: 60 as never, start: 0, duration: 2 }], controls: [] }
    const { rerender } = render(
      <Transport sequencer={sequencer({ sequence: seq, playback: playback({ duration: 2, play, pause }) })} />,
    )
    screen.getByRole('button', { name: 'Play' }).click()
    expect(play).toHaveBeenCalled()
    rerender(
      <Transport
        sequencer={sequencer({ sequence: seq, playback: playback({ state: 'playing', position: 0.5, duration: 2, play, pause }) })}
      />,
    )
    expect(screen.getByRole('timer')).toHaveTextContent('0:00.5 / 0:02.0')
    screen.getByRole('button', { name: 'Pause' }).click()
    expect(pause).toHaveBeenCalled()
  })
  it('toggles loop and sets the rate', () => {
    const setLoop = vi.fn()
    const setRate = vi.fn()
    render(<Transport sequencer={sequencer({ playback: playback({ setLoop, setRate }) })} />)
    screen.getByRole('button', { name: 'Loop', pressed: false }).click()
    expect(setLoop).toHaveBeenCalledWith(true)
    expect(screen.getByRole('slider', { name: /Tempo/ })).toHaveValue('1')
  })
})
