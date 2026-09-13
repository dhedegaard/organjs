import { useCallback, useEffect, useRef, useState } from 'react'
import type { MidiNote } from '../audio/notes'
import type { OrganSettings } from '../audio/organ'
import { parseMidiMessage, settingsPatchForControlChange } from '../input/midi'

interface MidiTarget {
  readonly settings: OrganSettings
  readonly noteOn: (note: MidiNote) => void
  readonly noteOff: (note: MidiNote) => void
  readonly allNotesOff: () => void
  readonly updateSettings: (patch: Partial<OrganSettings>) => void
}

export type MidiStatus = 'unsupported' | 'idle' | 'requesting' | 'denied' | 'ready'

export interface MidiInputInfo {
  readonly id: string
  readonly name: string
}

export interface MidiInputController {
  readonly status: MidiStatus
  readonly inputs: readonly MidiInputInfo[]
  readonly selectedId: string | null
  readonly connect: () => Promise<void>
  readonly select: (id: string | null) => void
}

function listInputs(access: MIDIAccess): MidiInputInfo[] {
  return [...access.inputs.values()].map((input) => ({ id: input.id, name: input.name ?? input.id }))
}

/**
 * Web MIDI input. Access is requested on `connect()` (Chrome prompts for permission);
 * the selected input's notes and control changes drive the organ.
 */
export function useMidiInput(target: MidiTarget): MidiInputController {
  const supported = typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator
  const [status, setStatus] = useState<MidiStatus>(supported ? 'idle' : 'unsupported')
  const accessRef = useRef<MIDIAccess | null>(null)
  const [inputs, setInputs] = useState<readonly MidiInputInfo[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // The message handler reads through this ref so it never has to be re-attached.
  const targetRef = useRef(target)
  useEffect(() => {
    targetRef.current = target
  })

  const connect = useCallback(async () => {
    if (!supported || accessRef.current) return
    setStatus('requesting')
    try {
      accessRef.current = await navigator.requestMIDIAccess()
      setStatus('ready')
    } catch {
      setStatus('denied')
    }
  }, [supported])

  // Track the device list, auto-selecting a lone device and dropping a vanished one
  // (the message effect's cleanup releases any notes it was holding).
  useEffect(() => {
    const access = accessRef.current
    if (status !== 'ready' || !access) return
    const refresh = () => {
      const list = listInputs(access)
      setInputs(list)
      setSelectedId((current) => {
        if (current !== null && list.some((input) => input.id === current)) return current
        return list.length === 1 ? list[0]!.id : null
      })
    }
    refresh()
    access.onstatechange = refresh
    return () => {
      access.onstatechange = null
    }
  }, [status])

  useEffect(() => {
    const access = accessRef.current
    if (!access || selectedId === null) return
    const input = access.inputs.get(selectedId)
    if (!input) return
    input.onmidimessage = (e: MIDIMessageEvent) => {
      if (!e.data) return
      const message = parseMidiMessage(e.data)
      const organ = targetRef.current
      switch (message.kind) {
        case 'noteOn':
          organ.noteOn(message.note)
          break
        case 'noteOff':
          organ.noteOff(message.note)
          break
        case 'controlChange': {
          const patch = settingsPatchForControlChange(organ.settings, message.controller, message.value)
          if (patch) organ.updateSettings(patch)
          break
        }
        case 'unsupported':
          break
      }
    }
    return () => {
      input.onmidimessage = null
      targetRef.current.allNotesOff()
    }
  }, [selectedId])

  const select = useCallback((id: string | null) => setSelectedId(id), [])

  return { status, inputs, selectedId, connect, select }
}
