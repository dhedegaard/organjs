import type { MidiNote } from '../audio/notes'
import { sequenceLength, type Sequence } from './sequence'

export interface PlayerTarget {
  readonly noteOn: (note: MidiNote) => void
  readonly noteOff: (note: MidiNote) => void
  readonly allNotesOff: () => void
  readonly control: (controller: number, value: number) => void
}

export type PlayerState = 'stopped' | 'playing' | 'paused'

type Event =
  | { readonly time: number; readonly kind: 'off'; readonly note: MidiNote }
  | { readonly time: number; readonly kind: 'control'; readonly controller: number; readonly value: number }
  | { readonly time: number; readonly kind: 'on'; readonly note: MidiNote }

/** At the same instant: release first, then set controls, then strike. */
const KIND_ORDER: Readonly<Record<Event['kind'], number>> = { off: 0, control: 1, on: 2 }

export const RATE_MIN = 0.5
export const RATE_MAX = 2

function eventsFor(sequence: Sequence): Event[] {
  const events: Event[] = []
  for (const n of sequence.notes) {
    events.push({ time: n.start, kind: 'on', note: n.note })
    events.push({ time: n.start + n.duration, kind: 'off', note: n.note })
  }
  for (const c of sequence.controls) events.push({ time: c.time, kind: 'control', controller: c.controller, value: c.value })
  return events.sort((a, b) => a.time - b.time || KIND_ORDER[a.kind] - KIND_ORDER[b.kind])
}

/**
 * Steps through a sequence against an external clock (seconds). Call `tick(now)`
 * regularly; events whose time has passed are sent to the target. Position is
 * in sequence seconds; `rate` scales how fast it advances.
 */
export class Player {
  private readonly target: PlayerTarget
  private events: Event[] = []
  private length = 0
  private next = 0
  private _state: PlayerState = 'stopped'
  private _rate = 1
  private anchorPosition = 0
  private anchorTime = 0
  loop = false

  constructor(target: PlayerTarget) {
    this.target = target
  }

  get state(): PlayerState {
    return this._state
  }

  get rate(): number {
    return this._rate
  }

  /** Length of the loaded sequence in seconds. */
  get duration(): number {
    return this.length
  }

  position(now: number): number {
    if (this._state !== 'playing') return this.anchorPosition
    return this.anchorPosition + (now - this.anchorTime) * this._rate
  }

  /** Swap the sequence; playback continues from the same position with all notes released. */
  load(sequence: Sequence, now: number): void {
    this.events = eventsFor(sequence)
    this.length = sequenceLength(sequence)
    if (this._state !== 'stopped') this.seek(Math.min(this.position(now), this.length), now)
  }

  play(now: number): void {
    if (this._state === 'playing' || this.length === 0) return
    this.anchorTime = now
    this._state = 'playing'
    this.restoreControls(this.next)
  }

  pause(now: number): void {
    if (this._state !== 'playing') return
    this.anchorPosition = this.position(now)
    this._state = 'paused'
    this.target.allNotesOff()
  }

  stop(): void {
    if (this._state === 'stopped') return
    this._state = 'stopped'
    this.target.allNotesOff()
    this.anchorPosition = 0
    this.next = 0
  }

  seek(position: number, now: number): void {
    const target = Math.max(0, Math.min(this.length, position))
    this.target.allNotesOff()
    this.anchorPosition = target
    this.anchorTime = now
    this.next = this.events.findIndex((e) => e.time >= target)
    if (this.next === -1) this.next = this.events.length
    if (this._state === 'playing') this.restoreControls(this.next)
  }

  setRate(rate: number, now: number): void {
    this.anchorPosition = this.position(now)
    this.anchorTime = now
    this._rate = Math.max(RATE_MIN, Math.min(RATE_MAX, rate))
  }

  tick(now: number): void {
    if (this._state !== 'playing') return
    const position = this.position(now)
    this.fireUntil(position)
    if (position < this.length) return
    if (!this.loop) {
      this.stop()
      return
    }
    this.target.allNotesOff()
    this.anchorPosition = position - this.length
    this.anchorTime = now
    this.next = 0
    this.fireUntil(this.anchorPosition)
  }

  private fireUntil(position: number): void {
    while (this.next < this.events.length) {
      const event = this.events[this.next]!
      if (event.time > position) break
      this.next++
      switch (event.kind) {
        case 'on':
          this.target.noteOn(event.note)
          break
        case 'off':
          this.target.noteOff(event.note)
          break
        case 'control':
          this.target.control(event.controller, event.value)
          break
      }
    }
  }

  /** Re-send the latest value of every control set before `index`, so a seek lands on the right registration. */
  private restoreControls(index: number): void {
    const latest = new Map<number, number>()
    for (const event of this.events.slice(0, index)) {
      if (event.kind === 'control') latest.set(event.controller, event.value)
    }
    for (const [controller, value] of latest) this.target.control(controller, value)
  }
}
