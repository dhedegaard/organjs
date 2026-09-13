import * as z from 'zod'
import { midiNoteSchema, type MidiNote } from '../audio/notes'
import type { OrganSettings } from '../audio/organ'
import { DRAWBAR_COUNT, DRAWBAR_MAX, drawbarLevelSchema, withLevel, type DrawbarLevel } from '../audio/voicing'

const dataByteSchema = z.number().int().min(0).max(127)

const NOTE_OFF = 0x8
const NOTE_ON = 0x9
const CONTROL_CHANGE = 0xb

const threeByteSchema = z.tuple([z.number().int(), dataByteSchema, dataByteSchema])

export type MidiMessage =
  | { readonly kind: 'noteOn'; readonly note: MidiNote; readonly velocity: number }
  | { readonly kind: 'noteOff'; readonly note: MidiNote }
  | { readonly kind: 'controlChange'; readonly controller: number; readonly value: number }
  | { readonly kind: 'unsupported' }

const UNSUPPORTED: MidiMessage = { kind: 'unsupported' }

/** Parse raw MIDI bytes. Channel is ignored (omni); anything not note/CC is `unsupported`. */
export function parseMidiMessage(data: Uint8Array): MidiMessage {
  const parsed = threeByteSchema.safeParse(Array.from(data))
  if (!parsed.success) return UNSUPPORTED
  const [status, d1, d2] = parsed.data
  switch (status >> 4) {
    case NOTE_ON: {
      const note = midiNoteSchema.parse(d1)
      return d2 === 0 ? { kind: 'noteOff', note } : { kind: 'noteOn', note, velocity: d2 }
    }
    case NOTE_OFF:
      return { kind: 'noteOff', note: midiNoteSchema.parse(d1) }
    case CONTROL_CHANGE:
      return { kind: 'controlChange', controller: d1, value: d2 }
    default:
      return UNSUPPORTED
  }
}

export function ccToDrawbarLevel(value: number): DrawbarLevel {
  return drawbarLevelSchema.parse(Math.round((value / 127) * DRAWBAR_MAX))
}

export function ccToVolume(value: number): number {
  return value / 127
}

/** Fixed controller map: expression pedal, nine consecutive drawbar CCs, then the rocker tabs. */
export const CC_EXPRESSION = 11
export const CC_DRAWBAR_FIRST = 12
export const CC_TREMULANT = 92
export const CC_PERCUSSION = 93
export const CC_PERCUSSION_HARMONIC = 94
export const CC_PERCUSSION_DECAY = 95

const isOn = (value: number): boolean => value >= 64

export function settingsPatchForControlChange(
  settings: OrganSettings,
  controller: number,
  value: number,
): Partial<OrganSettings> | undefined {
  if (controller === CC_EXPRESSION) return { volume: ccToVolume(value) }
  if (controller === CC_TREMULANT) return { tremulant: isOn(value) }
  if (controller === CC_PERCUSSION) return { percussion: { ...settings.percussion, on: isOn(value) } }
  if (controller === CC_PERCUSSION_HARMONIC) {
    return { percussion: { ...settings.percussion, harmonic: isOn(value) ? 3 : 2 } }
  }
  if (controller === CC_PERCUSSION_DECAY) {
    return { percussion: { ...settings.percussion, decay: isOn(value) ? 'slow' : 'fast' } }
  }
  const index = controller - CC_DRAWBAR_FIRST
  if (index >= 0 && index < DRAWBAR_COUNT) {
    return { drawbars: withLevel(settings.drawbars, index, ccToDrawbarLevel(value)) }
  }
  return undefined
}
