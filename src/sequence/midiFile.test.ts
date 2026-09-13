import { describe, expect, it } from 'vitest'
import { midiNoteSchema } from '../audio/notes'
import { CC_TREMULANT } from '../input/midi'
import { decodeMidiFile, encodeMidiFile, PPQ } from './midiFile'
import type { Sequence } from './sequence'

const note = (n: number) => midiNoteSchema.parse(n)

const sequence: Sequence = {
  notes: [
    { id: 'a', note: note(60), start: 0.5, duration: 1 },
    { id: 'b', note: note(64), start: 0.5, duration: 0.25 },
    { id: 'c', note: note(67), start: 2, duration: 0.125 },
  ],
  controls: [
    { time: 0, controller: CC_TREMULANT, value: 127 },
    { time: 1, controller: 12, value: 64 },
  ],
}

const strip = (s: Sequence) => ({
  notes: [...s.notes]
    .sort((a, b) => a.start - b.start || a.note - b.note)
    .map(({ note, start, duration }) => ({ note, start, duration })),
  controls: s.controls,
})

describe('encodeMidiFile', () => {
  it('writes a format 0 file with one track at the export resolution', () => {
    const bytes = encodeMidiFile(sequence)
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('MThd')
    expect(bytes.slice(8, 14)).toEqual(Uint8Array.from([0, 0, 0, 1, PPQ >> 8, PPQ & 0xff]))
    expect(String.fromCharCode(...bytes.slice(14, 18))).toBe('MTrk')
    expect([...bytes.slice(-4)]).toEqual([0x00, 0xff, 0x2f, 0x00])
  })
})

describe('decodeMidiFile', () => {
  it('round-trips what encode produced', () => {
    const result = decodeMidiFile(encodeMidiFile(sequence))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(strip(result.sequence)).toEqual(strip(sequence))
  })

  it('rejects things that are not MIDI files', () => {
    expect(decodeMidiFile(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]))).toEqual({ ok: false, error: 'Not a MIDI file' })
    expect(decodeMidiFile(encodeMidiFile(sequence).slice(0, 20)).ok).toBe(false)
  })

  it('honours tempo changes and running status in a format 1 file', () => {
    // Two tracks: a tempo track at 60 BPM switching to 120 BPM at beat 1, and a note track using running status.
    const ppq = 96
    const tempo = [0x00, 0xff, 0x51, 0x03, 0x0f, 0x42, 0x40, 96, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20, 0x00, 0xff, 0x2f, 0x00]
    const notes = [0x00, 0x90, 60, 100, 96, 60, 0, 0x00, 62, 100, 96, 62, 0, 0x00, 0xff, 0x2f, 0x00]
    const chunk = (id: string, body: number[]) => [...id].map((c) => c.charCodeAt(0)).concat([0, 0, 0, body.length], body)
    const file = Uint8Array.from([
      ...chunk('MThd', [0, 1, 0, 2, ppq >> 8, ppq & 0xff]),
      ...chunk('MTrk', tempo),
      ...chunk('MTrk', notes),
    ])
    const result = decodeMidiFile(file)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // Beat 0-1 lasts 1 s at 60 BPM, beat 1-2 lasts 0.5 s at 120 BPM.
    expect(strip(result.sequence).notes).toEqual([
      { note: 60, start: 0, duration: 1 },
      { note: 62, start: 1, duration: 0.5 },
    ])
  })

  it('closes notes still sounding at the end and skips unknown events', () => {
    const body = [0x00, 0xf0, 0x02, 0x01, 0xf7, 0x00, 0xc0, 5, 0x00, 0x90, 60, 100, 0x00, 0xff, 0x2f, 0x00]
    const chunk = (id: string, b: number[]) => [...id].map((c) => c.charCodeAt(0)).concat([0, 0, 0, b.length], b)
    const file = Uint8Array.from([...chunk('MThd', [0, 0, 0, 1, 0, 96]), ...chunk('MTrk', body)])
    const result = decodeMidiFile(file)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.sequence.notes).toHaveLength(1)
    expect(result.sequence.notes[0]?.duration).toBeGreaterThan(0)
  })
})
