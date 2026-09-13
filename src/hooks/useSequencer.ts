import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MidiNote } from '../audio/notes'
import type { OrganSettings } from '../audio/organ'
import { settingsPatchForControlChange } from '../input/midi'
import { Player, type PlayerState } from '../sequence/player'
import { Recorder } from '../sequence/recorder'
import { EMPTY_SEQUENCE, type Sequence } from '../sequence/sequence'
import { useHistory } from './useHistory'
import type { OrganController } from './useOrgan'

export interface PlaybackController {
  readonly state: PlayerState
  /** Current position in sequence seconds. */
  readonly position: number
  /** Length of the sequence in seconds. */
  readonly duration: number
  readonly rate: number
  readonly loop: boolean
  readonly play: () => void
  readonly pause: () => void
  readonly stop: () => void
  readonly seek: (position: number) => void
  readonly setRate: (rate: number) => void
  readonly setLoop: (loop: boolean) => void
}

export interface EditHistory {
  readonly undo: () => void
  readonly redo: () => void
  readonly canUndo: boolean
  readonly canRedo: boolean
}

export interface SequencerController {
  readonly sequence: Sequence
  /** Replace the sequence; each call is one undo step. */
  readonly setSequence: (sequence: Sequence) => void
  readonly history: EditHistory
  readonly recording: boolean
  /** Seconds since recording started; 0 when idle. */
  readonly recordingSeconds: number
  readonly startRecording: () => void
  readonly stopRecording: () => void
  readonly playback: PlaybackController
  /** Play through these instead of the organ's own so notes are captured. */
  readonly noteOn: (note: MidiNote) => void
  readonly noteOff: (note: MidiNote) => void
}

export type Clock = () => number

const performanceClock: Clock = () => performance.now() / 1000
const ELAPSED_REFRESH_MS = 100
const TICK_MS = 10
/** Position state is refreshed less often than the player ticks; React need not run at 100 Hz. */
const POSITION_REFRESH_MS = 33

/**
 * Records what is played on the organ into a `Sequence` and plays sequences
 * back through it. Notes are taken from the wrapped `noteOn`/`noteOff`;
 * settings changes are picked up by diffing the organ's settings, so drawbar
 * moves from the UI and MIDI are both captured. Recording and playback are
 * exclusive: starting one stops the other.
 */
export function useSequencer(organ: OrganController, clock: Clock = performanceClock): SequencerController {
  const { present: sequence, set: setSequence, undo, redo, canUndo, canRedo } = useHistory<Sequence>(EMPTY_SEQUENCE)
  const [recording, setRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const recorderRef = useRef<Recorder | null>(null)
  const settingsRef = useRef<OrganSettings>(organ.settings)
  const { noteOn: organNoteOn, noteOff: organNoteOff } = organ

  // The player drives the organ through this ref so it never needs rebuilding.
  const organRef = useRef(organ)
  useEffect(() => {
    organRef.current = organ
  })
  const playerRef = useRef<Player | null>(null)
  const player = (): Player => {
    if (!playerRef.current) {
      playerRef.current = new Player({
        noteOn: (note) => organRef.current.noteOn(note),
        noteOff: (note) => organRef.current.noteOff(note),
        allNotesOff: () => organRef.current.allNotesOff(),
        control: (controller, value) => {
          const patch = settingsPatchForControlChange(organRef.current.settings, controller, value)
          if (patch) organRef.current.updateSettings(patch)
        },
      })
    }
    return playerRef.current
  }
  const [playerState, setPlayerState] = useState<PlayerState>('stopped')
  const [position, setPosition] = useState(0)
  const [rate, setRateState] = useState(1)
  const [loop, setLoopState] = useState(false)
  const [duration, setDuration] = useState(0)

  const syncPlayer = useCallback(() => {
    const p = player()
    setPlayerState(p.state)
    setPosition(p.position(clock()))
    setDuration(p.duration)
  }, [clock])

  useEffect(() => {
    player().load(sequence, clock())
    syncPlayer()
  }, [sequence, clock, syncPlayer])

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

  useEffect(() => {
    if (playerState !== 'playing') return
    let lastRefresh = clock()
    const timer = window.setInterval(() => {
      const p = player()
      const now = clock()
      p.tick(now)
      if (p.state !== 'playing') {
        syncPlayer()
        return
      }
      if (now - lastRefresh >= POSITION_REFRESH_MS / 1000) {
        lastRefresh = now
        setPosition(p.position(now))
      }
    }, TICK_MS)
    return () => window.clearInterval(timer)
  }, [playerState, clock, syncPlayer])

  const stop = useCallback(() => {
    player().stop()
    syncPlayer()
  }, [syncPlayer])

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current
    if (!recorder) return
    recorderRef.current = null
    setSequence(recorder.finish(clock()))
    setRecording(false)
    setRecordingSeconds(0)
  }, [clock, setSequence])

  const startRecording = useCallback(() => {
    if (recorderRef.current) return
    stop()
    recorderRef.current = new Recorder(clock(), settingsRef.current)
    setRecordingSeconds(0)
    setRecording(true)
  }, [clock, stop])

  const play = useCallback(() => {
    stopRecording()
    player().play(clock())
    syncPlayer()
  }, [clock, stopRecording, syncPlayer])

  const pause = useCallback(() => {
    player().pause(clock())
    syncPlayer()
  }, [clock, syncPlayer])

  const seek = useCallback(
    (to: number) => {
      player().seek(to, clock())
      syncPlayer()
    },
    [clock, syncPlayer],
  )

  const setRate = useCallback(
    (next: number) => {
      player().setRate(next, clock())
      setRateState(player().rate)
    },
    [clock],
  )

  const setLoop = useCallback((next: boolean) => {
    player().loop = next
    setLoopState(next)
  }, [])

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

  const playback = useMemo<PlaybackController>(
    () => ({ state: playerState, position, duration, rate, loop, play, pause, stop, seek, setRate, setLoop }),
    [playerState, position, duration, rate, loop, play, pause, stop, seek, setRate, setLoop],
  )

  const history = useMemo<EditHistory>(() => ({ undo, redo, canUndo, canRedo }), [undo, redo, canUndo, canRedo])

  return {
    sequence,
    setSequence,
    history,
    recording,
    recordingSeconds,
    startRecording,
    stopRecording,
    playback,
    noteOn,
    noteOff,
  }
}
