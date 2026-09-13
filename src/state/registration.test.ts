import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../audio/organ'
import { drawbarLevelsSchema } from '../audio/voicing'
import { decodeRegistration, encodeRegistration } from './registration'

describe('encodeRegistration', () => {
  it('writes drawbars, tremulant and percussion as plain query params', () => {
    const params = encodeRegistration({
      ...DEFAULT_SETTINGS,
      drawbars: drawbarLevelsSchema.parse([8, 0, 8, 6, 0, 4, 0, 0, 2]),
      tremulant: true,
      percussion: { on: true, harmonic: 2, decay: 'slow' },
      keyClick: true,
    })
    expect(params).toBe('d=808604002&t=1&p=1&h=2&dc=slow&k=1')
  })
  it('leaves volume out', () => {
    expect(encodeRegistration({ ...DEFAULT_SETTINGS, volume: 0.1 })).not.toContain('v=')
  })
})

describe('decodeRegistration', () => {
  it('round-trips what encode produced', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      drawbars: drawbarLevelsSchema.parse([0, 0, 8, 0, 0, 0, 0, 0, 0]),
      percussion: { on: true, harmonic: 3, decay: 'fast' } as const,
    }
    const decoded = decodeRegistration(encodeRegistration(settings))
    expect(decoded).toEqual({
      drawbars: settings.drawbars,
      tremulant: false,
      percussion: settings.percussion,
      keyClick: false,
    })
  })
  it('accepts a leading # and a partial set of params, filling the rest from defaults', () => {
    expect(decodeRegistration('#d=888888888')).toEqual({
      drawbars: [8, 8, 8, 8, 8, 8, 8, 8, 8],
      tremulant: DEFAULT_SETTINGS.tremulant,
      percussion: DEFAULT_SETTINGS.percussion,
      keyClick: DEFAULT_SETTINGS.keyClick,
    })
  })
  it('reads the key click flag', () => {
    expect(decodeRegistration('k=1')?.keyClick).toBe(true)
    expect(decodeRegistration('k=0')?.keyClick).toBe(false)
  })
  it('returns undefined for an empty hash', () => {
    expect(decodeRegistration('')).toBeUndefined()
    expect(decodeRegistration('#')).toBeUndefined()
  })
  it('rejects malformed drawbars rather than guessing', () => {
    expect(decodeRegistration('d=999')).toBeUndefined()
    expect(decodeRegistration('d=88800000x')).toBeUndefined()
    expect(decodeRegistration('h=4')).toBeUndefined()
    expect(decodeRegistration('dc=medium')).toBeUndefined()
    expect(decodeRegistration('k=yes')).toBeUndefined()
  })
})
