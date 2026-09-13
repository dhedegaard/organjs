import { useCallback, useEffect, useRef, useState } from 'react'
import type { MidiNote } from '../audio/notes'
import { DEFAULT_SETTINGS, Organ, type OrganSettings } from '../audio/organ'

export interface OrganController {
  readonly settings: OrganSettings
  readonly activeNotes: ReadonlySet<MidiNote>
  readonly noteOn: (note: MidiNote) => void
  readonly noteOff: (note: MidiNote) => void
  readonly allNotesOff: () => void
  readonly updateSettings: (patch: Partial<OrganSettings>) => void
}

/**
 * Owns the AudioContext and Organ; both are created lazily on the first note.
 * `initialSettings` may be a lazy initializer, like `useState`'s.
 */
export function useOrgan(initialSettings: OrganSettings | (() => OrganSettings) = DEFAULT_SETTINGS): OrganController {
  const organRef = useRef<Organ | null>(null)
  const [settings, setSettings] = useState<OrganSettings>(initialSettings)
  const [activeNotes, setActiveNotes] = useState<ReadonlySet<MidiNote>>(() => new Set())

  const ensureOrgan = useCallback((): Organ => {
    if (organRef.current) return organRef.current
    const ctx = new AudioContext({ latencyHint: 'interactive' })
    const organ = new Organ(ctx, settings)
    organRef.current = organ
    return organ
  }, [settings])

  useEffect(() => {
    organRef.current?.update(settings)
  }, [settings])

  const noteOn = useCallback(
    (note: MidiNote) => {
      const organ = ensureOrgan()
      organ.noteOn(note)
      setActiveNotes((prev) => (prev.has(note) ? prev : new Set(prev).add(note)))
    },
    [ensureOrgan],
  )

  const noteOff = useCallback((note: MidiNote) => {
    organRef.current?.noteOff(note)
    setActiveNotes((prev) => {
      if (!prev.has(note)) return prev
      const next = new Set(prev)
      next.delete(note)
      return next
    })
  }, [])

  const allNotesOff = useCallback(() => {
    organRef.current?.allNotesOff()
    setActiveNotes(new Set())
  }, [])

  const updateSettings = useCallback((patch: Partial<OrganSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }))
  }, [])

  return { settings, activeNotes, noteOn, noteOff, allNotesOff, updateSettings }
}
