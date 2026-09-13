import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../audio/organ'
import {
  CC_PERCUSSION,
  CC_PERCUSSION_DECAY,
  CC_PERCUSSION_HARMONIC,
  ccToDrawbarLevel,
  ccToVolume,
  parseMidiMessage,
  settingsPatchForControlChange,
} from './midi'

const bytes = (...values: number[]) => new Uint8Array(values)

describe('parseMidiMessage', () => {
  it('parses note on with velocity', () => {
    expect(parseMidiMessage(bytes(0x90, 60, 100))).toEqual({ kind: 'noteOn', note: 60, velocity: 100 })
  })
  it('accepts note on from any channel', () => {
    expect(parseMidiMessage(bytes(0x9f, 60, 100))).toEqual({ kind: 'noteOn', note: 60, velocity: 100 })
  })
  it('treats note on with velocity 0 as note off', () => {
    expect(parseMidiMessage(bytes(0x90, 60, 0))).toEqual({ kind: 'noteOff', note: 60 })
  })
  it('parses note off', () => {
    expect(parseMidiMessage(bytes(0x80, 61, 64))).toEqual({ kind: 'noteOff', note: 61 })
  })
  it('parses control change', () => {
    expect(parseMidiMessage(bytes(0xb0, 11, 127))).toEqual({ kind: 'controlChange', controller: 11, value: 127 })
  })
  it('ignores messages it does not handle', () => {
    expect(parseMidiMessage(bytes(0xe0, 0, 64))).toEqual({ kind: 'unsupported' })
    expect(parseMidiMessage(bytes(0xf8))).toEqual({ kind: 'unsupported' })
  })
  it('ignores malformed messages', () => {
    expect(parseMidiMessage(bytes(0x90, 60))).toEqual({ kind: 'unsupported' })
    expect(parseMidiMessage(bytes(0x90, 200, 1))).toEqual({ kind: 'unsupported' })
  })
})

describe('ccToDrawbarLevel', () => {
  it('spreads 0..127 evenly over 0..8', () => {
    expect(ccToDrawbarLevel(0)).toBe(0)
    expect(ccToDrawbarLevel(127)).toBe(8)
    expect(ccToDrawbarLevel(64)).toBe(4)
    expect(ccToDrawbarLevel(15)).toBe(1)
  })
})

describe('ccToVolume', () => {
  it('maps 0..127 to 0..1', () => {
    expect(ccToVolume(0)).toBe(0)
    expect(ccToVolume(127)).toBe(1)
    expect(ccToVolume(64)).toBeCloseTo(0.504, 3)
  })
})

describe('settingsPatchForControlChange', () => {
  const settings = DEFAULT_SETTINGS
  it('maps expression (CC 11) to volume', () => {
    expect(settingsPatchForControlChange(settings, 11, 127)).toEqual({ volume: 1 })
  })
  it('maps CC 12..20 to the nine drawbars', () => {
    expect(settingsPatchForControlChange(settings, 12, 0)).toEqual({ drawbars: [0, 8, 8, 0, 0, 0, 0, 0, 0] })
    expect(settingsPatchForControlChange(settings, 20, 127)).toEqual({ drawbars: [8, 8, 8, 0, 0, 0, 0, 0, 8] })
  })
  it('switches tremulant at 64', () => {
    expect(settingsPatchForControlChange(settings, 92, 64)).toEqual({ tremulant: true })
    expect(settingsPatchForControlChange(settings, 92, 63)).toEqual({ tremulant: false })
  })
  it('ignores unmapped controllers', () => {
    expect(settingsPatchForControlChange(settings, 1, 100)).toBeUndefined()
  })
})

describe('percussion control changes', () => {
  it('CC 93 switches percussion on and off', () => {
    expect(settingsPatchForControlChange(DEFAULT_SETTINGS, CC_PERCUSSION, 127)).toEqual({
      percussion: { ...DEFAULT_SETTINGS.percussion, on: true },
    })
    expect(settingsPatchForControlChange(DEFAULT_SETTINGS, CC_PERCUSSION, 0)).toEqual({
      percussion: { ...DEFAULT_SETTINGS.percussion, on: false },
    })
  })
  it('CC 94 picks the 3rd harmonic above half, 2nd below', () => {
    expect(settingsPatchForControlChange(DEFAULT_SETTINGS, CC_PERCUSSION_HARMONIC, 100)).toEqual({
      percussion: { ...DEFAULT_SETTINGS.percussion, harmonic: 3 },
    })
    expect(settingsPatchForControlChange(DEFAULT_SETTINGS, CC_PERCUSSION_HARMONIC, 10)).toEqual({
      percussion: { ...DEFAULT_SETTINGS.percussion, harmonic: 2 },
    })
  })
  it('CC 95 picks slow decay above half, fast below', () => {
    expect(settingsPatchForControlChange(DEFAULT_SETTINGS, CC_PERCUSSION_DECAY, 64)).toEqual({
      percussion: { ...DEFAULT_SETTINGS.percussion, decay: 'slow' },
    })
    expect(settingsPatchForControlChange(DEFAULT_SETTINGS, CC_PERCUSSION_DECAY, 63)).toEqual({
      percussion: { ...DEFAULT_SETTINGS.percussion, decay: 'fast' },
    })
  })
})
