import { useId, useState, type ChangeEvent } from 'react'
import type { RecordingsController } from '../hooks/useRecordings'
import { decodeMidiFile, encodeMidiFile } from '../sequence/midiFile'
import type { Sequence } from '../sequence/sequence'

interface LibraryProps {
  readonly sequence: Sequence
  readonly onLoad: (sequence: Sequence) => void
  readonly recordings: RecordingsController
}

function safeFilename(name: string): string {
  const cleaned = name.trim().replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-')
  return `${cleaned || 'organjs-recording'}.mid`
}

/** Save and load named recordings from local storage; import and export Standard MIDI Files. */
export function Library({ sequence, onLoad, recordings }: LibraryProps) {
  const [name, setName] = useState('')
  const [selected, setSelected] = useState('')
  const [error, setError] = useState<string | null>(null)
  const fileId = useId()
  const empty = sequence.notes.length === 0 && sequence.controls.length === 0
  const current = recordings.recordings.find((r) => r.name === selected)

  const save = () => {
    if (name.trim() === '' || empty) return
    recordings.save(name, sequence)
    setSelected(name.trim())
  }

  const exportMidi = () => {
    const bytes = encodeMidiFile(sequence)
    const blob = new Blob([bytes], { type: 'audio/midi' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = safeFilename(name || selected)
    link.click()
    URL.revokeObjectURL(url)
  }

  const importMidi = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (!(reader.result instanceof ArrayBuffer)) return
      const result = decodeMidiFile(new Uint8Array(reader.result))
      if (result.ok) {
        setError(null)
        onLoad(result.sequence)
        setName(file.name.replace(/\.midi?$/i, ''))
      } else {
        setError(`${file.name}: ${result.error}`)
      }
    }
    reader.onerror = () => setError(`${file.name}: could not read file`)
    reader.readAsArrayBuffer(file)
  }

  return (
    <div className="library">
      <div className="library__row">
        <input
          className="library__name"
          type="text"
          placeholder="Recording name"
          aria-label="Recording name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />
        <button type="button" className="library__button" disabled={empty || name.trim() === ''} onClick={save}>
          Save
        </button>
        <button type="button" className="library__button" disabled={empty} onClick={exportMidi}>
          Export .mid
        </button>
        <label className="library__button" htmlFor={fileId}>
          Import .mid
        </label>
        <input id={fileId} className="library__file" type="file" accept=".mid,.midi,audio/midi" onChange={importMidi} />
      </div>
      <div className="library__row">
        <select
          aria-label="Saved recordings"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          disabled={recordings.recordings.length === 0}
        >
          <option value="">{recordings.recordings.length === 0 ? 'No saved recordings' : 'Saved recordings…'}</option>
          {recordings.recordings.map((r) => (
            <option key={r.name} value={r.name}>
              {r.name} ({r.sequence.notes.length} notes)
            </option>
          ))}
        </select>
        <button
          type="button"
          className="library__button"
          disabled={!current}
          onClick={() => {
            if (!current) return
            onLoad(current.sequence)
            setName(current.name)
          }}
        >
          Load
        </button>
        <button
          type="button"
          className="library__button"
          disabled={!current}
          onClick={() => {
            if (!current) return
            recordings.remove(current.name)
            setSelected('')
          }}
        >
          Delete
        </button>
      </div>
      {error && (
        <p className="library__error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
