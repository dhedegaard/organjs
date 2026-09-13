import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CopyLink } from './CopyLink'

describe('CopyLink', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('copies the current URL and confirms', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(<CopyLink />)
    fireEvent.click(screen.getByRole('button', { name: /copy link/i }))
    expect(writeText).toHaveBeenCalledWith(window.location.href)
    await waitFor(() => expect(screen.getByRole('button')).toHaveTextContent('Copied'))
  })
})
