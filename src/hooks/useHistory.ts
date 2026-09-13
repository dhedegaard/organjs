import { useCallback, useState } from 'react'

export interface History<T> {
  readonly present: T
  /** Commit a new state, clearing the redo stack. */
  readonly set: (next: T) => void
  readonly undo: () => void
  readonly redo: () => void
  readonly canUndo: boolean
  readonly canRedo: boolean
}

interface Stacks<T> {
  readonly past: readonly T[]
  readonly present: T
  readonly future: readonly T[]
}

const MAX_PAST = 100

/** Linear undo/redo over immutable snapshots. Setting the identical value is a no-op. */
export function useHistory<T>(initial: T): History<T> {
  const [stacks, setStacks] = useState<Stacks<T>>({ past: [], present: initial, future: [] })

  const set = useCallback((next: T) => {
    setStacks((s) => {
      if (next === s.present) return s
      return { past: [...s.past.slice(-(MAX_PAST - 1)), s.present], present: next, future: [] }
    })
  }, [])

  const undo = useCallback(() => {
    setStacks((s) => {
      const previous = s.past.at(-1)
      if (previous === undefined) return s
      return { past: s.past.slice(0, -1), present: previous, future: [s.present, ...s.future] }
    })
  }, [])

  const redo = useCallback(() => {
    setStacks((s) => {
      const [next, ...rest] = s.future
      if (next === undefined) return s
      return { past: [...s.past, s.present], present: next, future: rest }
    })
  }, [])

  return {
    present: stacks.present,
    set,
    undo,
    redo,
    canUndo: stacks.past.length > 0,
    canRedo: stacks.future.length > 0,
  }
}
