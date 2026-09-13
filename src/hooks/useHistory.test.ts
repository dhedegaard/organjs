import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useHistory } from './useHistory'

describe('useHistory', () => {
  it('undoes and redoes commits in order', () => {
    const { result } = renderHook(() => useHistory('a'))
    expect(result.current.canUndo).toBe(false)
    act(() => result.current.set('b'))
    act(() => result.current.set('c'))
    expect(result.current.present).toBe('c')
    act(() => result.current.undo())
    expect(result.current.present).toBe('b')
    expect(result.current.canRedo).toBe(true)
    act(() => result.current.undo())
    expect(result.current.present).toBe('a')
    act(() => result.current.undo())
    expect(result.current.present).toBe('a')
    act(() => result.current.redo())
    act(() => result.current.redo())
    expect(result.current.present).toBe('c')
    expect(result.current.canRedo).toBe(false)
  })
  it('drops the redo stack on a new commit and ignores identical values', () => {
    const { result } = renderHook(() => useHistory('a'))
    act(() => result.current.set('b'))
    act(() => result.current.undo())
    act(() => result.current.set('a'))
    expect(result.current.canRedo).toBe(true)
    act(() => result.current.set('z'))
    expect(result.current.canRedo).toBe(false)
    expect(result.current.canUndo).toBe(true)
  })
})
