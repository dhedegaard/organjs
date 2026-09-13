import * as z from 'zod'
import { midiNoteSchema } from '../audio/notes'

/** A held note as an interval, in seconds from the start of the sequence. */
export const sequenceNoteSchema = z.object({
  id: z.string().min(1),
  note: midiNoteSchema,
  start: z.number().min(0),
  duration: z.number().positive(),
})
export interface SequenceNote extends z.infer<typeof sequenceNoteSchema> {}

/** A raw MIDI control change; the controller map in `input/midi.ts` gives it meaning. */
export const controlEventSchema = z.object({
  time: z.number().min(0),
  controller: z.number().int().min(0).max(127),
  value: z.number().int().min(0).max(127),
})
export interface ControlEvent extends z.infer<typeof controlEventSchema> {}

export const sequenceSchema = z.object({
  notes: z.array(sequenceNoteSchema),
  controls: z.array(controlEventSchema),
})
export interface Sequence extends z.infer<typeof sequenceSchema> {}

export const EMPTY_SEQUENCE: Sequence = { notes: [], controls: [] }

/** End of the last note or control event, in seconds. */
export function sequenceLength(sequence: Sequence): number {
  let end = 0
  for (const n of sequence.notes) end = Math.max(end, n.start + n.duration)
  for (const c of sequence.controls) end = Math.max(end, c.time)
  return end
}

export function newNoteId(): string {
  return crypto.randomUUID()
}
