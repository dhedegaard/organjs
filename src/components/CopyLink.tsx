import { useEffect, useState } from 'react'

const CONFIRM_MS = 1500

/** Copies the page URL, which always carries the current registration in its hash. */
export function CopyLink() {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), CONFIRM_MS)
    return () => window.clearTimeout(timer)
  }, [copied])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button type="button" className="preset" onClick={() => void copy()}>
      {copied ? 'Copied' : 'Copy link'}
    </button>
  )
}
