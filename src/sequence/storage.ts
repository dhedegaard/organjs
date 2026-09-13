import * as z from 'zod'
import { sequenceSchema, type Sequence } from './sequence'

const STORAGE_KEY = 'organjs.recordings'

export const savedRecordingSchema = z.object({
  name: z.string().min(1),
  savedAt: z.string(),
  sequence: sequenceSchema,
})
export interface SavedRecording extends z.infer<typeof savedRecordingSchema> {}

const librarySchema = z.array(savedRecordingSchema)

/** Everything saved so far, newest first. Corrupt or missing data reads as empty. */
export function listRecordings(storage: Storage = localStorage): SavedRecording[] {
  const raw = storage.getItem(STORAGE_KEY)
  if (raw === null) return []
  try {
    const parsed = librarySchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : []
  } catch {
    return []
  }
}

function write(recordings: SavedRecording[], storage: Storage): SavedRecording[] {
  storage.setItem(STORAGE_KEY, JSON.stringify(recordings))
  return recordings
}

/** Save under a name, replacing any recording already using it. */
export function saveRecording(
  name: string,
  sequence: Sequence,
  storage: Storage = localStorage,
  now: Date = new Date(),
): SavedRecording[] {
  const trimmed = name.trim()
  const rest = listRecordings(storage).filter((r) => r.name !== trimmed)
  return write([{ name: trimmed, savedAt: now.toISOString(), sequence }, ...rest], storage)
}

export function deleteRecording(name: string, storage: Storage = localStorage): SavedRecording[] {
  return write(
    listRecordings(storage).filter((r) => r.name !== name),
    storage,
  )
}
