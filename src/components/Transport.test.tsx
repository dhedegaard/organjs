import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { SequencerController } from '../hooks/useSequencer'
import { EMPTY_SEQUENCE } from '../sequence/sequence'
import { formatSeconds } from '../sequence/time'
import { Transport } from './Transport'

const sequencer = (patch: Partial<SequencerController>): SequencerController => ({
  sequence: EMPTY_SEQUENCE,
  setSequence: vi.fn(),
  recording: false,
  recordingSeconds: 0,
  startRecording: vi.fn(),
  stopRecording: vi.fn(),
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
})
