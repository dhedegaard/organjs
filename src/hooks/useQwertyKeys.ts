import { useEffect } from 'react'
import type { MidiNote } from '../audio/notes'
import { noteForKeyCode } from '../input/qwerty'

interface Handlers {
  readonly noteOn: (note: MidiNote) => void
  readonly noteOff: (note: MidiNote) => void
  readonly allNotesOff: () => void
}

/** Plays notes from the physical keyboard. Ignores repeats and typing in form fields. */
export function useQwertyKeys({ noteOn, noteOff, allNotesOff }: Handlers): void {
  useEffect(() => {
    const isEditable = (target: EventTarget | null): boolean =>
      target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || isEditable(e.target)) return
      const note = noteForKeyCode(e.code)
      if (note === undefined) return
      e.preventDefault()
      noteOn(note)
    }
    const onKeyUp = (e: KeyboardEvent) => {
      const note = noteForKeyCode(e.code)
      if (note !== undefined) noteOff(note)
    }
    const onBlur = () => allNotesOff()

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [noteOn, noteOff, allNotesOff])
}
