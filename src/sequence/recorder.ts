import type { MidiNote } from '../audio/notes'
import type { OrganSettings } from '../audio/organ'
import { controlChangesForSettings } from '../input/midi'
import { newNoteId, type ControlEvent, type Sequence, type SequenceNote } from './sequence'

/** Shortest note kept when a key is tapped and released within the same instant. */
const MIN_DURATION = 0.01

/**
 * Turns live note and settings events into a `Sequence`. Times are absolute
 * seconds from any monotonic clock; the recorder subtracts its start time.
 * The registration at the start is written as control changes at 0 so
 * playback restores it.
 */
export class Recorder {
  private readonly startedAt: number
  private readonly held = new Map<MidiNote, { readonly id: string; readonly start: number }>()
  private readonly notes: SequenceNote[] = []
  private readonly controls: ControlEvent[] = []

  constructor(startedAt: number, settings: OrganSettings) {
    this.startedAt = startedAt
    for (const change of controlChangesForSettings(settings)) this.controls.push({ time: 0, ...change })
  }

  elapsed(now: number): number {
    return Math.max(0, now - this.startedAt)
  }

  noteOn(note: MidiNote, now: number): void {
    if (this.held.has(note)) return
    this.held.set(note, { id: newNoteId(), start: this.elapsed(now) })
  }

  noteOff(note: MidiNote, now: number): void {
    const open = this.held.get(note)
    if (!open) return
    this.held.delete(note)
    const duration = Math.max(MIN_DURATION, this.elapsed(now) - open.start)
    this.notes.push({ id: open.id, note, start: open.start, duration })
  }

  settingsChanged(previous: OrganSettings, next: OrganSettings, now: number): void {
    const time = this.elapsed(now)
    for (const change of controlChangesForSettings(next, previous)) this.controls.push({ time, ...change })
  }

  /** Closes any notes still held and returns the sequence, sorted by start time. */
  finish(now: number): Sequence {
    for (const note of [...this.held.keys()]) this.noteOff(note, now)
    return {
      notes: [...this.notes].sort((a, b) => a.start - b.start),
      controls: [...this.controls].sort((a, b) => a.time - b.time),
    }
  }
}
