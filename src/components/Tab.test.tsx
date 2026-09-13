import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Tab } from './Tab'

describe('Tab', () => {
  it('shows On/Off by default', () => {
    render(<Tab label="Tremulant" on={false} onToggle={() => {}} />)
    expect(screen.getByRole('switch', { name: /Tremulant/ })).toHaveTextContent('Off')
  })
  it('uses custom state labels for the two positions', () => {
    const { rerender } = render(<Tab label="Harmonic" on={false} states={['2nd', '3rd']} onToggle={() => {}} />)
    expect(screen.getByRole('switch')).toHaveTextContent('2nd')
    rerender(<Tab label="Harmonic" on states={['2nd', '3rd']} onToggle={() => {}} />)
    expect(screen.getByRole('switch')).toHaveTextContent('3rd')
  })
})
