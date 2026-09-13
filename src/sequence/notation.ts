import { isBlackKey, type MidiNote } from '../audio/notes'
import type { Sequence } from './sequence'

/**
 * Turns a sequence into simple 4/4 staff notation at the fixed 120 BPM the MIDI
 * export uses: a sixteenth is the smallest unit, a bar is 16 units. Everything is
 * one voice per staff; overlapping notes are cut at every onset and release into
 * chord segments and tied where a pitch carries on.
 */
export const UNIT_SECONDS = 0.125
export const UNITS_PER_BEAT = 4
export const UNITS_PER_MEASURE = 16

export type Staff = 'treble' | 'bass'
export type Accidental = 'sharp' | 'natural' | null

/** Writable note lengths in units, longest first. */
export const NOTE_VALUES = [16, 12, 8, 6, 4, 3, 2, 1] as const
export type NoteValue = (typeof NOTE_VALUES)[number]

export interface ScoreChord {
  readonly kind: 'chord'
  /** Absolute position in units from the start of the sequence. */
  readonly start: number
  readonly duration: NoteValue
  readonly pitches: readonly MidiNote[]
  /** Parallel to `pitches`. */
  readonly accidentals: readonly Accidental[]
  /** Pitches that continue into the next chord on this staff. */
  readonly ties: readonly MidiNote[]
}

export interface ScoreRest {
  readonly kind: 'rest'
  readonly start: number
  readonly duration: NoteValue
}

export type ScoreEvent = ScoreChord | ScoreRest

export interface Score {
  readonly measures: number
  readonly staves: Readonly<Record<Staff, readonly ScoreEvent[]>>
}

/** Diatonic step (C-1 = 0, one per letter) and whether it carries a sharp. */
export function spell(pitch: MidiNote): { step: number; sharp: boolean } {
  const letters = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6]
  const octave = Math.floor(pitch / 12)
  return { step: octave * 7 + letters[pitch % 12]!, sharp: isBlackKey(pitch) }
}

export function staffOf(pitch: MidiNote): Staff {
  return pitch >= 60 ? 'treble' : 'bass'
}

export function valueGlyph(value: NoteValue): { head: 'whole' | 'half' | 'black'; flags: 0 | 1 | 2; dotted: boolean } {
  const dotted = value === 12 || value === 6 || value === 3
  const base = dotted ? (value * 2) / 3 : value
  const head = base === 16 ? 'whole' : base === 8 ? 'half' : 'black'
  const flags = base === 2 ? 1 : base === 1 ? 2 : 0
  return { head, flags, dotted }
}

/** Largest value that fits in `remaining` and sits on a position it may start from. */
function pickValue(position: number, remaining: number): NoteValue {
  const alignment: Record<NoteValue, number> = { 16: 16, 12: 4, 8: 4, 6: 2, 4: 2, 3: 1, 2: 1, 1: 1 }
  for (const v of NOTE_VALUES) {
    if (v <= remaining && position % alignment[v] === 0) return v
  }
  return 1
}

/** Split [start, end) into writable values that never cross a barline. */
function splitSpan(start: number, end: number): Array<{ start: number; duration: NoteValue }> {
  const parts: Array<{ start: number; duration: NoteValue }> = []
  let at = start
  while (at < end) {
    const inBar = at % UNITS_PER_MEASURE
    const room = Math.min(end - at, UNITS_PER_MEASURE - inBar)
    const duration = pickValue(inBar, room)
    parts.push({ start: at, duration })
    at += duration
  }
  return parts
}

interface Segment {
  readonly start: number
  readonly end: number
  readonly pitches: readonly MidiNote[]
}

/** Cut a staff's notes at every onset and release into non-overlapping chord/rest segments. */
function segments(notes: ReadonlyArray<{ pitch: MidiNote; start: number; end: number }>, length: number): Segment[] {
  const cuts = new Set<number>([0, length])
  for (const n of notes) cuts.add(n.start).add(n.end)
  const times = [...cuts].sort((a, b) => a - b)
  const out: Segment[] = []
  for (let i = 0; i < times.length - 1; i++) {
    const start = times[i]!
    const end = times[i + 1]!
    const pitches = [...new Set(notes.filter((n) => n.start <= start && n.end >= end).map((n) => n.pitch))].sort((a, b) => a - b)
    out.push({ start, end, pitches })
  }
  return out
}

function staffEvents(segs: readonly Segment[]): ScoreEvent[] {
  const events: ScoreEvent[] = []
  // Accidental state per step, reset every bar.
  let bar = -1
  let shown = new Map<number, boolean>()
  for (const [i, seg] of segs.entries()) {
    const parts = splitSpan(seg.start, seg.end)
    if (seg.pitches.length === 0) {
      for (const p of parts) events.push({ kind: 'rest', ...p })
      continue
    }
    const next = segs[i + 1]
    const carried = next ? seg.pitches.filter((p) => next.pitches.includes(p)) : []
    for (const [j, p] of parts.entries()) {
      const thisBar = Math.floor(p.start / UNITS_PER_MEASURE)
      if (thisBar !== bar) {
        bar = thisBar
        shown = new Map()
      }
      const accidentals = seg.pitches.map((pitch): Accidental => {
        const { step, sharp } = spell(pitch)
        const was = shown.get(step) ?? false
        if (was === sharp) return null
        shown.set(step, sharp)
        return sharp ? 'sharp' : 'natural'
      })
      const last = j === parts.length - 1
      events.push({ kind: 'chord', ...p, pitches: seg.pitches, accidentals, ties: last ? carried : seg.pitches })
    }
  }
  return events
}

export function toScore(sequence: Sequence): Score {
  const quantised = sequence.notes.map((n) => {
    const start = Math.round(n.start / UNIT_SECONDS)
    const end = Math.max(start + 1, Math.round((n.start + n.duration) / UNIT_SECONDS))
    return { pitch: n.note, start, end }
  })
  const last = Math.max(0, ...quantised.map((n) => n.end))
  const measures = Math.max(1, Math.ceil(last / UNITS_PER_MEASURE))
  const length = measures * UNITS_PER_MEASURE
  const byStaff = (staff: Staff) => staffEvents(segments(quantised.filter((n) => staffOf(n.pitch) === staff), length))
  return { measures, staves: { treble: byStaff('treble'), bass: byStaff('bass') } }
}

export function valueName(value: NoteValue): string {
  const names: Record<NoteValue, string> = {
    16: 'whole',
    12: 'dotted half',
    8: 'half',
    6: 'dotted quarter',
    4: 'quarter',
    3: 'dotted eighth',
    2: 'eighth',
    1: 'sixteenth',
  }
  return names[value]
}
