import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { midiNoteSchema } from '../audio/notes'
import type { RecordingsController } from '../hooks/useRecordings'
import { encodeMidiFile } from '../sequence/midiFile'
import { EMPTY_SEQUENCE, type Sequence } from '../sequence/sequence'
import { Library } from './Library'

const seq: Sequence = { notes: [{ id: 'a', note: midiNoteSchema.parse(60), start: 0, duration: 1 }], controls: [] }

const recordings = (patch: Partial<RecordingsController> = {}): RecordingsController => ({
  recordings: [],
  save: vi.fn(),
  remove: vi.fn(),
  ...patch,
})

afterEach(() => vi.restoreAllMocks())

describe('Library', () => {
  it('saves under the typed name and refuses an empty sequence', () => {
    const save = vi.fn()
    const { rerender } = render(<Library sequence={EMPTY_SEQUENCE} onLoad={() => {}} recordings={recordings({ save })} />)
    fireEvent.change(screen.getByLabelText('Recording name'), { target: { value: 'Riff' } })
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    rerender(<Library sequence={seq} onLoad={() => {}} recordings={recordings({ save })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(save).toHaveBeenCalledWith('Riff', seq)
  })

  it('loads and deletes the selected recording', () => {
    const onLoad = vi.fn()
    const remove = vi.fn()
    const saved = [{ name: 'Riff', savedAt: '2026-01-01T00:00:00Z', sequence: seq }]
    render(<Library sequence={EMPTY_SEQUENCE} onLoad={onLoad} recordings={recordings({ recordings: saved, remove })} />)
    fireEvent.change(screen.getByLabelText('Saved recordings'), { target: { value: 'Riff' } })
    fireEvent.click(screen.getByRole('button', { name: 'Load' }))
    expect(onLoad).toHaveBeenCalledWith(seq)
    expect(screen.getByLabelText('Recording name')).toHaveValue('Riff')
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(remove).toHaveBeenCalledWith('Riff')
  })

  it('exports the sequence as a MIDI file download', () => {
    const createObjectURL = vi.fn(() => 'blob:x')
    const revokeObjectURL = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(<Library sequence={seq} onLoad={() => {}} recordings={recordings()} />)
    fireEvent.change(screen.getByLabelText('Recording name'), { target: { value: 'My Riff!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Export .mid' }))
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(click).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:x')
    const anchor = click.mock.instances[0] as HTMLAnchorElement
    expect(anchor.download).toBe('My-Riff.mid')
  })

  it('imports a MIDI file and reports one it cannot read', async () => {
    const onLoad = vi.fn()
    render(<Library sequence={EMPTY_SEQUENCE} onLoad={onLoad} recordings={recordings()} />)
    const input = screen.getByLabelText('Import .mid')
    const good = new File([encodeMidiFile(seq)], 'riff.mid', { type: 'audio/midi' })
    fireEvent.change(input, { target: { files: [good] } })
    await waitFor(() => expect(onLoad).toHaveBeenCalled())
    expect(onLoad.mock.calls[0]![0].notes[0]).toMatchObject({ note: 60, start: 0, duration: 1 })
    expect(screen.getByLabelText('Recording name')).toHaveValue('riff')

    const bad = new File([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])], 'notes.txt')
    fireEvent.change(input, { target: { files: [bad] } })
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('notes.txt: Not a MIDI file'))
  })
})
