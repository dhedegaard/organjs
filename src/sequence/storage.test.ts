import { afterEach, describe, expect, it } from 'vitest'
import { midiNoteSchema } from '../audio/notes'
import type { Sequence } from './sequence'
import { deleteRecording, listRecordings, saveRecording } from './storage'

const seq: Sequence = { notes: [{ id: 'a', note: midiNoteSchema.parse(60), start: 0, duration: 1 }], controls: [] }

describe('recording storage', () => {
  afterEach(() => localStorage.clear())

  it('is empty to start with', () => {
    expect(listRecordings()).toEqual([])
  })

  it('saves newest first and replaces a recording with the same name', () => {
    saveRecording('one', seq, localStorage, new Date('2026-01-01T00:00:00Z'))
    saveRecording('two', seq, localStorage, new Date('2026-01-02T00:00:00Z'))
    saveRecording(' one ', { ...seq, notes: [] }, localStorage, new Date('2026-01-03T00:00:00Z'))
    expect(listRecordings().map((r) => [r.name, r.savedAt])).toEqual([
      ['one', '2026-01-03T00:00:00.000Z'],
      ['two', '2026-01-02T00:00:00.000Z'],
    ])
    expect(listRecordings()[0]?.sequence.notes).toEqual([])
  })

  it('deletes by name', () => {
    saveRecording('one', seq)
    saveRecording('two', seq)
    expect(deleteRecording('one').map((r) => r.name)).toEqual(['two'])
  })

  it('treats corrupt storage as empty', () => {
    localStorage.setItem('organjs.recordings', '{not json')
    expect(listRecordings()).toEqual([])
    localStorage.setItem('organjs.recordings', JSON.stringify([{ name: '', sequence: {} }]))
    expect(listRecordings()).toEqual([])
  })
})
