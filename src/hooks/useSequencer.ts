import { useCallback, useEffect, useRef, useState } from 'react'
import type { MidiNote } from '../audio/notes'
import type { OrganSettings } from '../audio/organ'
import { Recorder } from '../sequence/recorder'
import { EMPTY_SEQUENCE, type Sequence } from '../sequence/sequence'
import type { OrganController } from './useOrgan'

export interface SequencerController {
  readonly sequence: Sequence
  readonly setSequence: (sequence: Sequence) => void
  readonly recording: boolean
  /** Seconds since recording started; 0 when idle. */
  readonly recordingSeconds: number
  readonly startRecording: () => void
  readonly stopRecording: () => void
  /** Play through these instead of the organ's own so notes are captured. */
  readonly noteOn: (note: MidiNote) => void
  readonly noteOff: (note: MidiNote) => void
}

export type Clock = () => number

const performanceClock: Clock = () => performance.now() / 1000
const ELAPSED_REFRESH_MS = 100

/**
 * Records what is played on the organ into a `Sequence`. Notes are taken from
 * the wrapped `noteOn`/`noteOff`; settings changes are picked up by diffing the
 * organ's settings, so drawbar moves from the UI and MIDI are both captured.
 */
export function useSequencer(organ: OrganController, clock: Clock = performanceClock): SequencerController {
  const [sequence, setSequence] = useState<Sequence>(EMPTY_SEQUENCE)
  const [recording, setRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const recorderRef = useRef<Recorder | null>(null)
  const settingsRef = useRef<OrganSettings>(organ.settings)
  const { noteOn: organNoteOn, noteOff: organNoteOff } = organ

  useEffect(() => {
    const previous = settingsRef.current
    settingsRef.current = organ.settings
    if (previous !== organ.settings) recorderRef.current?.settingsChanged(previous, organ.settings, clock())
  }, [organ.settings, clock])

  useEffect(() => {
    if (!recording) return
    const timer = window.setInterval(() => {
      setRecordingSeconds(recorderRef.current?.elapsed(clock()) ?? 0)
    }, ELAPSED_REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [recording, clock])

  const startRecording = useCallback(() => {
    if (recorderRef.current) return
    recorderRef.current = new Recorder(clock(), settingsRef.current)
    setRecordingSeconds(0)
    setRecording(true)
  }, [clock])

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current
    if (!recorder) return
    recorderRef.current = null
    setSequence(recorder.finish(clock()))
    setRecording(false)
    setRecordingSeconds(0)
  }, [clock])

  const noteOn = useCallback(
    (note: MidiNote) => {
      recorderRef.current?.noteOn(note, clock())
      organNoteOn(note)
    },
    [organNoteOn, clock],
  )
  const noteOff = useCallback(
    (note: MidiNote) => {
      recorderRef.current?.noteOff(note, clock())
      organNoteOff(note)
    },
    [organNoteOff, clock],
  )

  return { sequence, setSequence, recording, recordingSeconds, startRecording, stopRecording, noteOn, noteOff }
}
