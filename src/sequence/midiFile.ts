import { toMidiNote } from '../audio/notes'
import { sequenceSchema, type ControlEvent, type Sequence, type SequenceNote } from './sequence'

/** Export resolution and tempo. 480 ticks per quarter at 120 BPM is 960 ticks per second. */
export const PPQ = 480
export const TEMPO_MICROSECONDS = 500_000
const NOTE_VELOCITY = 100
const MIN_IMPORTED_SECONDS = 0.01

export type DecodeResult = { readonly ok: true; readonly sequence: Sequence } | { readonly ok: false; readonly error: string }

// ---- writing ----

function variableLength(value: number): number[] {
  const bytes = [value & 0x7f]
  let rest = value >> 7
  while (rest > 0) {
    bytes.unshift((rest & 0x7f) | 0x80)
    rest >>= 7
  }
  return bytes
}

function uint32(value: number): number[] {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]
}

function uint16(value: number): number[] {
  return [(value >>> 8) & 0xff, value & 0xff]
}

interface TrackEvent {
  readonly tick: number
  readonly order: number
  readonly bytes: readonly number[]
}

function secondsToTicks(seconds: number): number {
  return Math.round((seconds * PPQ * 1_000_000) / TEMPO_MICROSECONDS)
}

/** Standard MIDI File, format 0, one track on channel 1, tempo fixed at 120 BPM. */
export function encodeMidiFile(sequence: Sequence): Uint8Array<ArrayBuffer> {
  const events: TrackEvent[] = [{ tick: 0, order: 0, bytes: [0xff, 0x51, 0x03, ...uint32(TEMPO_MICROSECONDS).slice(1)] }]
  for (const c of sequence.controls) events.push({ tick: secondsToTicks(c.time), order: 2, bytes: [0xb0, c.controller, c.value] })
  for (const n of sequence.notes) {
    events.push({ tick: secondsToTicks(n.start), order: 3, bytes: [0x90, n.note, NOTE_VELOCITY] })
    events.push({ tick: secondsToTicks(n.start + n.duration), order: 1, bytes: [0x80, n.note, 0] })
  }
  events.sort((a, b) => a.tick - b.tick || a.order - b.order)

  const track: number[] = []
  let last = 0
  for (const e of events) {
    track.push(...variableLength(e.tick - last), ...e.bytes)
    last = e.tick
  }
  track.push(0x00, 0xff, 0x2f, 0x00)

  const header = [...'MThd'].map((ch) => ch.charCodeAt(0))
  header.push(...uint32(6), ...uint16(0), ...uint16(1), ...uint16(PPQ))
  const trackChunk = [...'MTrk'].map((ch) => ch.charCodeAt(0))
  trackChunk.push(...uint32(track.length), ...track)
  return new Uint8Array([...header, ...trackChunk])
}

// ---- reading ----

class Reader {
  private readonly bytes: Uint8Array
  pos: number
  readonly end: number
  constructor(bytes: Uint8Array, start = 0, end = bytes.length) {
    this.bytes = bytes
    this.pos = start
    this.end = end
  }
  get done(): boolean {
    return this.pos >= this.end
  }
  u8(): number {
    if (this.pos >= this.end) throw new Error('unexpected end of file')
    return this.bytes[this.pos++]!
  }
  u16(): number {
    return (this.u8() << 8) | this.u8()
  }
  u32(): number {
    return ((this.u8() << 24) | (this.u8() << 16) | (this.u8() << 8) | this.u8()) >>> 0
  }
  ascii(length: number): string {
    let s = ''
    for (let i = 0; i < length; i++) s += String.fromCharCode(this.u8())
    return s
  }
  variableLength(): number {
    let value = 0
    for (let i = 0; i < 4; i++) {
      const byte = this.u8()
      value = (value << 7) | (byte & 0x7f)
      if ((byte & 0x80) === 0) return value
    }
    throw new Error('bad variable-length quantity')
  }
  skip(length: number): void {
    this.pos += length
    if (this.pos > this.end) throw new Error('unexpected end of file')
  }
}

type RawEvent =
  | { readonly tick: number; readonly kind: 'on'; readonly channel: number; readonly note: number }
  | { readonly tick: number; readonly kind: 'off'; readonly channel: number; readonly note: number }
  | { readonly tick: number; readonly kind: 'control'; readonly controller: number; readonly value: number }
  | { readonly tick: number; readonly kind: 'tempo'; readonly microseconds: number }

const CHANNEL_DATA_BYTES: Readonly<Record<number, number>> = { 0x8: 2, 0x9: 2, 0xa: 2, 0xb: 2, 0xc: 1, 0xd: 1, 0xe: 2 }
const SYSTEM_DATA_BYTES: Readonly<Record<number, number>> = { 0xf1: 1, 0xf2: 2, 0xf3: 1 }

function readTrack(reader: Reader, out: RawEvent[]): void {
  let tick = 0
  let status = 0
  while (!reader.done) {
    tick += reader.variableLength()
    let byte = reader.u8()
    if (byte < 0x80) {
      // Running status: this byte is already the first data byte.
      if (status === 0) throw new Error('data byte without status')
      reader.pos--
      byte = status
    }
    if (byte === 0xff) {
      const type = reader.u8()
      const length = reader.variableLength()
      if (type === 0x51 && length === 3) {
        out.push({ tick, kind: 'tempo', microseconds: (reader.u8() << 16) | (reader.u8() << 8) | reader.u8() })
      } else if (type === 0x2f) {
        return
      } else {
        reader.skip(length)
      }
      continue
    }
    if (byte === 0xf0 || byte === 0xf7) {
      reader.skip(reader.variableLength())
      continue
    }
    if (byte >= 0xf0) {
      reader.skip(SYSTEM_DATA_BYTES[byte] ?? 0)
      continue
    }
    status = byte
    const kind = byte >> 4
    const channel = byte & 0x0f
    const d1 = reader.u8()
    const d2 = (CHANNEL_DATA_BYTES[kind] ?? 1) === 2 ? reader.u8() : 0
    if (kind === 0x9) out.push({ tick, kind: d2 === 0 ? 'off' : 'on', channel, note: d1 })
    else if (kind === 0x8) out.push({ tick, kind: 'off', channel, note: d1 })
    else if (kind === 0xb) out.push({ tick, kind: 'control', controller: d1, value: d2 })
  }
}

/** Ticks to seconds across a tempo map; SMPTE divisions are a fixed rate. */
function secondsAtTick(division: number): (events: readonly RawEvent[]) => Map<RawEvent, number> {
  return (events) => {
    const times = new Map<RawEvent, number>()
    if (division & 0x8000) {
      const framesPerSecond = -((division >> 8) << 24 >> 24)
      const ticksPerFrame = division & 0xff
      for (const e of events) times.set(e, e.tick / (framesPerSecond * ticksPerFrame))
      return times
    }
    let tempo = TEMPO_MICROSECONDS
    let lastTick = 0
    let lastSeconds = 0
    for (const e of events) {
      const seconds = lastSeconds + ((e.tick - lastTick) * tempo) / (division * 1_000_000)
      times.set(e, seconds)
      lastTick = e.tick
      lastSeconds = seconds
      if (e.kind === 'tempo') tempo = e.microseconds
    }
    return times
  }
}

/** Parse a Standard MIDI File (format 0, 1 or 2; all tracks merged). Unknown events are skipped. */
export function decodeMidiFile(bytes: Uint8Array): DecodeResult {
  try {
    const reader = new Reader(bytes)
    if (reader.ascii(4) !== 'MThd') return { ok: false, error: 'Not a MIDI file' }
    const headerLength = reader.u32()
    reader.u16() // format: every format is read the same way, tracks merged
    const trackCount = reader.u16()
    const division = reader.u16()
    reader.skip(headerLength - 6)

    const raw: RawEvent[] = []
    for (let i = 0; i < trackCount && !reader.done; i++) {
      const id = reader.ascii(4)
      const length = reader.u32()
      const start = reader.pos
      if (id === 'MTrk') readTrack(new Reader(bytes, start, start + length), raw)
      reader.pos = start + length
    }
    raw.sort((a, b) => a.tick - b.tick)
    const times = secondsAtTick(division)(raw)

    const notes: SequenceNote[] = []
    const controls: ControlEvent[] = []
    const open = new Map<string, { readonly note: number; readonly start: number }>()
    let lastTime = 0
    for (const e of raw) {
      const time = times.get(e) ?? 0
      lastTime = Math.max(lastTime, time)
      if (e.kind === 'control') {
        controls.push({ time, controller: e.controller, value: e.value })
        continue
      }
      if (e.kind === 'tempo') continue
      const key = `${e.channel}:${e.note}`
      if (e.kind === 'on') {
        if (!open.has(key)) open.set(key, { note: e.note, start: time })
        continue
      }
      const started = open.get(key)
      if (!started) continue
      open.delete(key)
      pushNote(notes, started.note, started.start, time)
    }
    for (const started of open.values()) pushNote(notes, started.note, started.start, lastTime + 0.5)
    notes.sort((a, b) => a.start - b.start || a.note - b.note)

    const parsed = sequenceSchema.safeParse({ notes, controls })
    if (!parsed.success) return { ok: false, error: 'MIDI file contains values the organ cannot play' }
    return { ok: true, sequence: parsed.data }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not read MIDI file' }
  }
}

function pushNote(notes: SequenceNote[], pitch: number, start: number, end: number): void {
  const note = toMidiNote(pitch)
  if (note === undefined) return
  notes.push({ id: crypto.randomUUID(), note, start, duration: Math.max(MIN_IMPORTED_SECONDS, end - start) })
}
