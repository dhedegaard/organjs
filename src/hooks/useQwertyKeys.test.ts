import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useQwertyKeys } from './useQwertyKeys'

const key = (type: 'keydown' | 'keyup', code: string) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent(type, { code, cancelable: true }))
  })

function setup() {
  const handlers = { noteOn: vi.fn(), noteOff: vi.fn(), allNotesOff: vi.fn() }
  const hook = renderHook(() => useQwertyKeys(handlers))
  return { ...handlers, hook }
}

describe('useQwertyKeys', () => {
  it('plays and releases the mapped note', () => {
    const { noteOn, noteOff } = setup()
    key('keydown', 'KeyZ')
    key('keyup', 'KeyZ')
    expect(noteOn).toHaveBeenCalledWith(48)
    expect(noteOff).toHaveBeenCalledWith(48)
  })

  it('shifts octaves with , and . and reports the shift', () => {
    const { noteOn, hook } = setup()
    key('keydown', 'Period')
    expect(hook.result.current.octave).toBe(1)
    key('keydown', 'KeyZ')
    expect(noteOn).toHaveBeenCalledWith(60)
    key('keydown', 'Comma')
    key('keydown', 'Comma')
    key('keydown', 'Comma')
    key('keydown', 'Comma')
    expect(hook.result.current.octave).toBe(-2)
  })

  it('releases the note that was actually sounding when the shift changed mid-hold', () => {
    const { noteOn, noteOff } = setup()
    key('keydown', 'KeyZ')
    key('keydown', 'Period')
    key('keyup', 'KeyZ')
    expect(noteOn).toHaveBeenCalledTimes(1)
    expect(noteOff).toHaveBeenCalledWith(48)
  })
})
