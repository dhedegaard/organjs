import { useCallback, useState } from 'react'
import type { Sequence } from '../sequence/sequence'
import { deleteRecording, listRecordings, saveRecording, type SavedRecording } from '../sequence/storage'

export interface RecordingsController {
  readonly recordings: readonly SavedRecording[]
  readonly save: (name: string, sequence: Sequence) => void
  readonly remove: (name: string) => void
}

/** Named recordings in local storage, kept in state so the list re-renders. */
export function useRecordings(): RecordingsController {
  const [recordings, setRecordings] = useState<readonly SavedRecording[]>(() => listRecordings())
  const save = useCallback((name: string, sequence: Sequence) => setRecordings(saveRecording(name, sequence)), [])
  const remove = useCallback((name: string) => setRecordings(deleteRecording(name)), [])
  return { recordings, save, remove }
}
