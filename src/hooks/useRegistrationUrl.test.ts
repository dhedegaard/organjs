import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, type OrganSettings } from '../audio/organ'
import { drawbarLevelsSchema } from '../audio/voicing'
import { initialSettingsFromUrl, useRegistrationUrl } from './useRegistrationUrl'

describe('initialSettingsFromUrl', () => {
  afterEach(() => {
    window.history.replaceState(null, '', window.location.pathname)
  })
  it('falls back to defaults when the hash is empty or invalid', () => {
    expect(initialSettingsFromUrl()).toEqual(DEFAULT_SETTINGS)
    window.location.hash = '#d=nonsense'
    expect(initialSettingsFromUrl()).toEqual(DEFAULT_SETTINGS)
  })
  it('applies a valid registration over the defaults, keeping default volume', () => {
    window.location.hash = '#d=008000000&t=1'
    expect(initialSettingsFromUrl()).toEqual({
      ...DEFAULT_SETTINGS,
      drawbars: [0, 0, 8, 0, 0, 0, 0, 0, 0],
      tremulant: true,
    })
  })
})

describe('useRegistrationUrl', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    window.history.replaceState(null, '', window.location.pathname)
  })

  it('writes the registration into the hash after settings settle', () => {
    const settings: OrganSettings = {
      ...DEFAULT_SETTINGS,
      drawbars: drawbarLevelsSchema.parse([8, 8, 8, 8, 0, 0, 0, 0, 0]),
    }
    renderHook(() => useRegistrationUrl(settings))
    act(() => {
      vi.runAllTimers()
    })
    expect(window.location.hash).toBe('#d=888800000&t=0&p=0&h=3&dc=fast&k=0')
  })

  it('does not push history entries', () => {
    const before = window.history.length
    renderHook(() => useRegistrationUrl(DEFAULT_SETTINGS))
    act(() => {
      vi.runAllTimers()
    })
    expect(window.history.length).toBe(before)
  })
})
