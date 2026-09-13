import { useEffect } from 'react'
import { DEFAULT_SETTINGS, type OrganSettings } from '../audio/organ'
import { decodeRegistration, encodeRegistration } from '../state/registration'

const WRITE_DELAY_MS = 150

/** Defaults, overlaid with whatever valid registration the URL hash carries. */
export function initialSettingsFromUrl(): OrganSettings {
  const registration = decodeRegistration(window.location.hash)
  return registration ? { ...DEFAULT_SETTINGS, ...registration } : DEFAULT_SETTINGS
}

/** Mirrors the current registration into the hash so the URL is always shareable. */
export function useRegistrationUrl(settings: OrganSettings): void {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const hash = `#${encodeRegistration(settings)}`
      if (window.location.hash !== hash) window.history.replaceState(null, '', hash)
    }, WRITE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [settings])
}
