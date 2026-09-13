import { useCallback, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { isBlackKey, keyboardRange, midiToName, toMidiNote, type MidiNote } from '../audio/notes'
import { keyLabelForNote, type OctaveShift } from '../input/qwerty'

interface KeyboardProps {
  readonly low: MidiNote
  readonly high: MidiNote
  readonly activeNotes: ReadonlySet<MidiNote>
  /** Octave shift of the QWERTY rows, used to place the key hints. */
  readonly octave?: OctaveShift
  readonly onNoteOn: (note: MidiNote) => void
  readonly onNoteOff: (note: MidiNote) => void
}

interface KeyLayout {
  readonly note: MidiNote
  readonly black: boolean
  /** Position in white-key units from the left edge. */
  readonly offset: number
}

const BLACK_WIDTH = 0.62

function layoutKeys(low: MidiNote, high: MidiNote): { keys: readonly KeyLayout[]; whiteCount: number } {
  let whiteCount = 0
  const keys = keyboardRange(low, high).map((note): KeyLayout => {
    if (isBlackKey(note)) return { note, black: true, offset: whiteCount - BLACK_WIDTH / 2 }
    return { note, black: false, offset: whiteCount++ }
  })
  return { keys, whiteCount }
}

function noteAtPoint(x: number, y: number): MidiNote | undefined {
  const el = document.elementFromPoint(x, y)
  const raw = el instanceof HTMLElement ? el.closest<HTMLElement>('[data-midi]')?.dataset.midi : undefined
  return raw === undefined ? undefined : toMidiNote(Number(raw))
}

export function Keyboard({ low, high, activeNotes, octave = 0, onNoteOn, onNoteOff }: KeyboardProps) {
  const { keys, whiteCount } = layoutKeys(low, high)
  /** Note currently held by each pointer, so a drag glides across keys. */
  const pointers = useRef(new Map<number, MidiNote>())

  const press = useCallback(
    (pointerId: number, note: MidiNote | undefined) => {
      const previous = pointers.current.get(pointerId)
      if (previous === note) return
      if (previous !== undefined) onNoteOff(previous)
      if (note === undefined) pointers.current.delete(pointerId)
      else {
        pointers.current.set(pointerId, note)
        onNoteOn(note)
      }
    },
    [onNoteOn, onNoteOff],
  )

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    e.currentTarget.setPointerCapture(e.pointerId)
    press(e.pointerId, noteAtPoint(e.clientX, e.clientY))
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(e.pointerId)) return
    press(e.pointerId, noteAtPoint(e.clientX, e.clientY))
  }
  const onPointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    press(e.pointerId, undefined)
  }

  return (
    <div
      className="manual"
      role="group"
      aria-label="Keyboard"
      style={{ '--white-count': whiteCount } as CSSProperties}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      {keys.map((key) => {
        const label = keyLabelForNote(key.note, octave)
        const name = midiToName(key.note)
        return (
          <div
            key={key.note}
            data-midi={key.note}
            className={`key ${key.black ? 'key--black' : 'key--white'}${activeNotes.has(key.note) ? ' key--down' : ''}`}
            style={{ '--offset': key.offset } as CSSProperties}
            aria-label={name}
            aria-pressed={activeNotes.has(key.note)}
          >
            {!key.black && key.note % 12 === 0 && <span className="key__name">{name}</span>}
            {label && <span className="key__hint">{label}</span>}
          </div>
        )
      })}
    </div>
  )
}
