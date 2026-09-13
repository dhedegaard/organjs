import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { midiNoteSchema } from '../audio/notes'
import type { Sequence } from '../sequence/sequence'
import { KEYS_WIDTH, PianoRoll, ROW_HEIGHT, RULER_HEIGHT } from './PianoRoll'

const note = (n: number) => midiNoteSchema.parse(n)
const low = note(48)
const high = note(84)
const history = { undo: vi.fn(), redo: vi.fn(), canUndo: false, canRedo: false }
const one: Sequence = { notes: [{ id: 'a', note: note(60), start: 1, duration: 0.5 }], controls: [] }

/** jsdom has no layout; pin the SVG at the origin so pointer maths works. */
beforeEach(() => {
  vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 0, left: 0, top: 0, right: 1000, bottom: 500, width: 1000, height: 500, toJSON: () => ({}),
  })
})
afterEach(() => vi.restoreAllMocks())

const pixelsPerSecond = 80
const yFor = (pitch: number) => RULER_HEIGHT + (high - pitch) * ROW_HEIGHT + ROW_HEIGHT / 2

describe('PianoRoll', () => {
  it('draws one bar per note, labelled with its name and start', () => {
    render(<PianoRoll sequence={one} onChange={() => {}} position={0} onSeek={() => {}} low={low} high={high} history={history} />)
    expect(screen.getByLabelText('C4 at 0:01.0')).toBeInTheDocument()
  })

  it('adds a note where empty space is clicked, snapped to the grid', () => {
    const onChange = vi.fn()
    const { container } = render(
      <PianoRoll sequence={one} onChange={onChange} position={0} onSeek={() => {}} low={low} high={high} history={history} />,
    )
    const svg = container.querySelector('svg')!
    // 2.3 s on an E4 row; default grid is 1/8 = 0.25 s.
    const x = KEYS_WIDTH + 2.3 * pixelsPerSecond
    fireEvent.pointerDown(svg, { button: 0, clientX: x, clientY: yFor(64) })
    fireEvent.pointerUp(svg)
    expect(onChange).toHaveBeenCalledTimes(1)
    const next: Sequence = onChange.mock.calls[0]![0]
    expect(next.notes).toHaveLength(2)
    expect(next.notes[1]).toMatchObject({ note: 64, start: 2.25, duration: 0.25 })
  })

  it('deletes the selected note with the Delete key', () => {
    const onChange = vi.fn()
    render(<PianoRoll sequence={one} onChange={onChange} position={0} onSeek={() => {}} low={low} high={high} history={history} />)
    const bar = screen.getByLabelText('C4 at 0:01.0')
    fireEvent.pointerDown(bar, { button: 0, clientX: KEYS_WIDTH + 1.1 * pixelsPerSecond, clientY: yFor(60) })
    fireEvent.pointerUp(bar)
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.keyDown(screen.getByRole('application', { name: 'Piano roll' }), { key: 'Delete' })
    expect(onChange).toHaveBeenCalledWith({ notes: [], controls: [] })
  })

  it('moves a dragged note in time and pitch', () => {
    const onChange = vi.fn()
    render(<PianoRoll sequence={one} onChange={onChange} position={0} onSeek={() => {}} low={low} high={high} history={history} />)
    const bar = screen.getByLabelText('C4 at 0:01.0')
    const startX = KEYS_WIDTH + 1.1 * pixelsPerSecond
    fireEvent.pointerDown(bar, { button: 0, clientX: startX, clientY: yFor(60) })
    fireEvent.pointerMove(bar, { clientX: startX + 0.5 * pixelsPerSecond, clientY: yFor(62) })
    fireEvent.pointerUp(bar)
    expect(onChange.mock.calls[0]![0].notes[0]).toMatchObject({ note: 62, start: 1.5 })
  })

  it('resizes when the right edge is dragged', () => {
    const onChange = vi.fn()
    render(<PianoRoll sequence={one} onChange={onChange} position={0} onSeek={() => {}} low={low} high={high} history={history} />)
    const bar = screen.getByLabelText('C4 at 0:01.0')
    const endX = KEYS_WIDTH + 1.5 * pixelsPerSecond
    fireEvent.pointerDown(bar, { button: 0, clientX: endX - 2, clientY: yFor(60) })
    fireEvent.pointerMove(bar, { clientX: KEYS_WIDTH + 2 * pixelsPerSecond, clientY: yFor(60) })
    fireEvent.pointerUp(bar)
    expect(onChange.mock.calls[0]![0].notes[0]).toMatchObject({ start: 1, duration: 1 })
  })

  it('seeks from the ruler and undoes with Cmd+Z', () => {
    const onSeek = vi.fn()
    const undo = vi.fn()
    const { container } = render(
      <PianoRoll sequence={one} onChange={() => {}} position={0} onSeek={onSeek} low={low} high={high} history={{ ...history, undo, canUndo: true }} />,
    )
    fireEvent.pointerDown(container.querySelector('svg')!, { button: 0, clientX: KEYS_WIDTH + 3 * pixelsPerSecond, clientY: 5 })
    expect(onSeek).toHaveBeenCalledWith(3)
    fireEvent.keyDown(screen.getByRole('application'), { key: 'z', metaKey: true })
    expect(undo).toHaveBeenCalled()
  })
})
