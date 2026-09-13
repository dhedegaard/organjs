import { useEffect, useRef, useState } from 'react'
import type { MidiNote } from '../audio/notes'
import { clampOctave, noteForKeyCode, octaveStepForKeyCode, type OctaveShift } from '../input/qwerty'

interface Handlers {
  readonly noteOn: (note: MidiNote) => void
  readonly noteOff: (note: MidiNote) => void
  readonly allNotesOff: () => void
}

export interface QwertyController {
  /** Current octave shift of both rows, in whole octaves. */
  readonly octave: OctaveShift
}

/**
 * Plays notes from the physical keyboard; `,` and `.` shift both rows an octave.
 * Ignores repeats and typing in form fields.
 */
export function useQwertyKeys({ noteOn, noteOff, allNotesOff }: Handlers): QwertyController {
  const [octave, setOctave] = useState<OctaveShift>(0)
  const octaveRef = useRef(octave)
  /** Note sounding for each held key, so a shift mid-hold still releases the right one. */
  const held = useRef(new Map<string, MidiNote>())

  useEffect(() => {
    octaveRef.current = octave
  }, [octave])

  useEffect(() => {
    const isEditable = (target: EventTarget | null): boolean =>
      target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || isEditable(e.target)) return
      const step = octaveStepForKeyCode(e.code)
      if (step !== undefined) {
        e.preventDefault()
        setOctave((prev) => clampOctave(prev + step))
        return
      }
      if (held.current.has(e.code)) return
      const note = noteForKeyCode(e.code, octaveRef.current)
      if (note === undefined) return
      e.preventDefault()
      held.current.set(e.code, note)
      noteOn(note)
    }
    const onKeyUp = (e: KeyboardEvent) => {
      const note = held.current.get(e.code)
      if (note === undefined) return
      held.current.delete(e.code)
      noteOff(note)
    }
    const onBlur = () => {
      held.current.clear()
      allNotesOff()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [noteOn, noteOff, allNotesOff])

  return { octave }
}
