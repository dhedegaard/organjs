import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { isBlackKey, midiToName, toMidiNote, type MidiNote } from '../audio/notes'
import { addNote, deleteNotes, GRID_OPTIONS, moveNote, resizeNote, snapTime } from '../sequence/edit'
import { sequenceLength, type Sequence, type SequenceNote } from '../sequence/sequence'
import { formatSeconds } from '../sequence/time'
import type { EditHistory } from '../hooks/useSequencer'

interface PianoRollProps {
  readonly sequence: Sequence
  readonly onChange: (sequence: Sequence) => void
  /** Playhead position in seconds. */
  readonly position: number
  readonly onSeek: (position: number) => void
  readonly low: MidiNote
  readonly high: MidiNote
  readonly history: EditHistory
}

export const ROW_HEIGHT = 12
export const RULER_HEIGHT = 20
export const KEYS_WIDTH = 36
const RESIZE_HANDLE = 7
const DEFAULT_ADD_SECONDS = 0.25
const MIN_VISIBLE_SECONDS = 8
const NUDGE_SECONDS = 0.1

interface Drag {
  readonly mode: 'move' | 'resize'
  readonly id: string
  readonly original: SequenceNote
  /** Sequence at the start of the gesture, including a freshly added note. */
  readonly base: Sequence
  readonly startX: number
  readonly startY: number
  readonly preview: Sequence
}

/**
 * Piano-roll editor. Click empty space to add a note (drag to set its length),
 * drag a note to move it, drag its right edge to resize, Delete removes the
 * selection. Arrow keys nudge the selection; Cmd/Ctrl+Z undoes.
 */
export function PianoRoll({ sequence, onChange, position, onSeek, low, high, history }: PianoRollProps) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set())
  const [gridIndex, setGridIndex] = useState(2)
  const [pixelsPerSecond, setPixelsPerSecond] = useState(80)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [viewportWidth, setViewportWidth] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const grid = GRID_OPTIONS[gridIndex]?.seconds ?? 0
  const shown = drag?.preview ?? sequence
  const top = Math.max(high, ...shown.notes.map((n) => n.note))
  const bottom = Math.min(low, ...shown.notes.map((n) => n.note))
  const rows = top - bottom + 1
  const seconds = Math.max(MIN_VISIBLE_SECONDS, sequenceLength(shown) + 2)
  const width = Math.max(viewportWidth, KEYS_WIDTH + seconds * pixelsPerSecond)
  const height = RULER_HEIGHT + rows * ROW_HEIGHT

  const xOf = (time: number) => KEYS_WIDTH + time * pixelsPerSecond
  const timeAt = (x: number) => (x - KEYS_WIDTH) / pixelsPerSecond
  const yOf = (note: number) => RULER_HEIGHT + (top - note) * ROW_HEIGHT
  const noteAt = (y: number) => toMidiNote(top - Math.floor((y - RULER_HEIGHT) / ROW_HEIGHT))

  // Fill the panel horizontally, whatever its width.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const measure = () => setViewportWidth(el.clientWidth)
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // Scroll vertically to the notes (or middle C when there are none) whenever a new sequence arrives.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const pitches = sequence.notes.map((n) => n.note)
    const centre = pitches.length > 0 ? (Math.max(...pitches) + Math.min(...pitches)) / 2 : 60
    const y = RULER_HEIGHT + (top - centre) * ROW_HEIGHT
    el.scrollTop = Math.max(0, y - el.clientHeight / 2)
    // Only the sequence identity should trigger this; `top` follows from it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sequence])

  // Keep the playhead in view while it moves.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const x = xOf(position)
    if (x < el.scrollLeft + KEYS_WIDTH || x > el.scrollLeft + el.clientWidth - 20) {
      el.scrollLeft = Math.max(0, x - KEYS_WIDTH - 40)
    }
    // xOf changes with zoom, which is covered by pixelsPerSecond.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position, pixelsPerSecond])

  const localPoint = (e: ReactPointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return
    const { x, y } = localPoint(e)
    if (y < RULER_HEIGHT) {
      onSeek(Math.max(0, timeAt(x)))
      return
    }
    if (x < KEYS_WIDTH) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const hit = e.target instanceof Element ? e.target.closest<SVGElement>('[data-id]')?.dataset.id : undefined
    if (hit !== undefined) {
      const original = sequence.notes.find((n) => n.id === hit)
      if (!original) return
      const nearEnd = x >= xOf(original.start + original.duration) - RESIZE_HANDLE
      setSelected(new Set([hit]))
      setDrag({ mode: nearEnd ? 'resize' : 'move', id: hit, original, base: sequence, startX: x, startY: y, preview: sequence })
      return
    }
    const pitch = noteAt(y)
    if (pitch === undefined) return
    const start = snapTime(timeAt(x), grid)
    const added = addNote(sequence, pitch, start, grid || DEFAULT_ADD_SECONDS)
    const original = added.sequence.notes.at(-1)!
    setSelected(new Set([added.id]))
    setDrag({ mode: 'resize', id: added.id, original, base: added.sequence, startX: x, startY: y, preview: added.sequence })
  }

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!drag) return
    const { x, y } = localPoint(e)
    if (drag.mode === 'move') {
      const start = snapTime(drag.original.start + (x - drag.startX) / pixelsPerSecond, grid)
      const semitones = -Math.round((y - drag.startY) / ROW_HEIGHT)
      setDrag({ ...drag, preview: moveNote(drag.base, drag.id, start - drag.original.start, semitones) })
    } else {
      const end = snapTime(timeAt(x), grid)
      setDrag({ ...drag, preview: resizeNote(drag.base, drag.id, end - drag.original.start) })
    }
  }

  const onPointerUp = () => {
    if (!drag) return
    if (drag.preview !== sequence) onChange(drag.preview)
    setDrag(null)
  }

  const deleteSelection = () => {
    if (selected.size === 0) return
    onChange(deleteNotes(sequence, selected))
    setSelected(new Set())
  }

  const nudge = (deltaSeconds: number, deltaSemitones: number) => {
    if (selected.size === 0) return
    let next = sequence
    for (const id of selected) next = moveNote(next, id, deltaSeconds, deltaSemitones)
    onChange(next)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const meta = e.metaKey || e.ctrlKey
    if (meta && e.key.toLowerCase() === 'z') {
      e.preventDefault()
      if (e.shiftKey) history.redo()
      else history.undo()
      return
    }
    if (meta && e.key.toLowerCase() === 'y') {
      e.preventDefault()
      history.redo()
      return
    }
    if (meta) return
    const step = grid || NUDGE_SECONDS
    const actions: Record<string, () => void> = {
      Delete: deleteSelection,
      Backspace: deleteSelection,
      ArrowLeft: () => nudge(-step, 0),
      ArrowRight: () => nudge(step, 0),
      ArrowUp: () => nudge(0, e.shiftKey ? 12 : 1),
      ArrowDown: () => nudge(0, e.shiftKey ? -12 : -1),
      Escape: () => setSelected(new Set()),
    }
    const action = actions[e.key]
    if (!action) return
    e.preventDefault()
    action()
  }

  const gridLines: number[] = []
  const lineEvery = grid || 0.5
  for (let t = 0; t <= seconds; t += lineEvery) gridLines.push(t)

  return (
    <div className="roll">
      <div className="roll__toolbar">
        <label className="roll__field">
          Grid
          <select value={gridIndex} onChange={(e) => setGridIndex(Number(e.target.value))}>
            {GRID_OPTIONS.map((g, i) => (
              <option key={g.label} value={i}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <label className="roll__field">
          Zoom
          <input
            type="range"
            min={30}
            max={300}
            step={10}
            value={pixelsPerSecond}
            onChange={(e) => setPixelsPerSecond(Number(e.target.value))}
          />
        </label>
        <button type="button" className="roll__button" disabled={!history.canUndo} onClick={history.undo}>
          Undo
        </button>
        <button type="button" className="roll__button" disabled={!history.canRedo} onClick={history.redo}>
          Redo
        </button>
        <button type="button" className="roll__button" disabled={selected.size === 0} onClick={deleteSelection}>
          Delete
        </button>
        <button
          type="button"
          className="roll__button"
          disabled={sequence.notes.length === 0}
          onClick={() => onChange({ ...sequence, notes: [] })}
        >
          Clear notes
        </button>
      </div>
      <div
        className="roll__scroll"
        ref={scrollRef}
        role="application"
        aria-label="Piano roll"
        tabIndex={0}
        onKeyDown={onKeyDown}
      >
        <svg
          className="roll__canvas"
          width={width}
          height={height}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {Array.from({ length: rows }, (_, i) => {
            const pitch = toMidiNote(top - i)
            if (pitch === undefined) return null
            const black = isBlackKey(pitch)
            return (
              <g key={pitch}>
                <rect
                  className={`roll__row${black ? ' roll__row--black' : ''}`}
                  x={KEYS_WIDTH}
                  y={yOf(pitch)}
                  width={width - KEYS_WIDTH}
                  height={ROW_HEIGHT}
                />
                {pitch % 12 === 0 && (
                  <text className="roll__key" x={4} y={yOf(pitch) + ROW_HEIGHT - 2}>
                    {midiToName(pitch)}
                  </text>
                )}
              </g>
            )
          })}
          {gridLines.map((t) => {
            const beat = Math.abs(t / 0.5 - Math.round(t / 0.5)) < 1e-6
            return (
              <line
                key={t}
                className={`roll__grid${beat ? ' roll__grid--beat' : ''}`}
                x1={xOf(t)}
                x2={xOf(t)}
                y1={beat ? 0 : RULER_HEIGHT}
                y2={height}
              />
            )
          })}
          {gridLines
            .filter((t) => Number.isInteger(t))
            .map((t) => (
              <text key={t} className="roll__ruler" x={xOf(t) + 3} y={13}>
                {formatSeconds(t).replace(/\.\d$/, '')}
              </text>
            ))}
          {shown.notes.map((n) => (
            <rect
              key={n.id}
              data-id={n.id}
              className={`roll__note${selected.has(n.id) ? ' roll__note--selected' : ''}`}
              x={xOf(n.start)}
              y={yOf(n.note) + 1}
              width={Math.max(2, n.duration * pixelsPerSecond)}
              height={ROW_HEIGHT - 2}
              rx={2}
              aria-label={`${midiToName(n.note)} at ${formatSeconds(n.start)}`}
            />
          ))}
          <line className="roll__playhead" x1={xOf(position)} x2={xOf(position)} y1={0} y2={height} />
        </svg>
      </div>
    </div>
  )
}
