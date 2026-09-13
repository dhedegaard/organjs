import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { midiNoteSchema } from '../audio/notes'
import type { Sequence } from '../sequence/sequence'
import { CLEF_WIDTH, Score } from './Score'

const note = (n: number) => midiNoteSchema.parse(n)
const chords: Sequence = {
  notes: [
    { id: 'a', note: note(60), start: 0, duration: 0.5 },
    { id: 'b', note: note(64), start: 0, duration: 0.5 },
    { id: 'c', note: note(43), start: 0, duration: 1 },
  ],
  controls: [],
}

beforeEach(() => {
  vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 0, left: 0, top: 0, right: 1000, bottom: 500, width: 1000, height: 500, toJSON: () => ({}),
  })
})
afterEach(() => vi.restoreAllMocks())

describe('Score', () => {
  it('labels chords and rests by pitch, value and time', () => {
    render(<Score sequence={chords} position={0} onSeek={() => {}} pixelsPerSecond={80} minWidth={0} />)
    expect(screen.getByLabelText('C4 E4 quarter at 0:00.0')).toBeInTheDocument()
    expect(screen.getByLabelText('G2 half at 0:00.0')).toBeInTheDocument()
    expect(screen.getByLabelText('dotted half rest at 0:00.5')).toBeInTheDocument()
  })

  it('lights the chord under the playhead', () => {
    render(<Score sequence={chords} position={0.25} onSeek={() => {}} pixelsPerSecond={80} minWidth={0} />)
    expect(screen.getByLabelText('C4 E4 quarter at 0:00.0')).toHaveClass('score__chord--playing')
    expect(screen.getByLabelText('G2 half at 0:00.0')).toHaveClass('score__chord--playing')
    render(<Score sequence={chords} position={0.75} onSeek={() => {}} pixelsPerSecond={80} minWidth={0} />)
    expect(screen.getAllByLabelText('C4 E4 quarter at 0:00.0')[1]).not.toHaveClass('score__chord--playing')
  })

  it('seeks to the clicked time', () => {
    const onSeek = vi.fn()
    const { container } = render(<Score sequence={chords} position={0} onSeek={onSeek} pixelsPerSecond={80} minWidth={0} />)
    fireEvent.pointerDown(container.querySelector('svg')!, { button: 0, clientX: CLEF_WIDTH + 160, clientY: 10 })
    expect(onSeek).toHaveBeenCalledWith(2)
  })
})
