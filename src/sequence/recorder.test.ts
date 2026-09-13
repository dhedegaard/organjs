import { describe, expect, it } from 'vitest'
import { midiNoteSchema } from '../audio/notes'
import { DEFAULT_SETTINGS } from '../audio/organ'
import { drawbarLevelsSchema } from '../audio/voicing'
import { CC_DRAWBAR_FIRST, CC_TREMULANT } from '../input/midi'
import { Recorder } from './recorder'

const note = (n: number) => midiNoteSchema.parse(n)

describe('Recorder', () => {
  it('measures notes relative to its start time', () => {
    const recorder = new Recorder(10, DEFAULT_SETTINGS)
    recorder.noteOn(note(60), 10.5)
    recorder.noteOff(note(60), 11.25)
    const { notes } = recorder.finish(12)
    expect(notes).toEqual([{ id: expect.any(String), note: 60, start: 0.5, duration: 0.75 }])
  })

  it('closes notes still held when finished', () => {
    const recorder = new Recorder(0, DEFAULT_SETTINGS)
    recorder.noteOn(note(60), 1)
    recorder.noteOn(note(64), 2)
    const { notes } = recorder.finish(5)
    expect(notes.map((n) => [n.note, n.start, n.duration])).toEqual([
      [60, 1, 4],
      [64, 2, 3],
    ])
  })

  it('ignores a note off without a matching note on and a repeated note on', () => {
    const recorder = new Recorder(0, DEFAULT_SETTINGS)
    recorder.noteOff(note(60), 1)
    recorder.noteOn(note(60), 2)
    recorder.noteOn(note(60), 3)
    recorder.noteOff(note(60), 4)
    expect(recorder.finish(5).notes).toEqual([{ id: expect.any(String), note: 60, start: 2, duration: 2 }])
  })

  it('gives a tap with no measurable length a minimum duration', () => {
    const recorder = new Recorder(0, DEFAULT_SETTINGS)
    recorder.noteOn(note(60), 1)
    recorder.noteOff(note(60), 1)
    expect(recorder.finish(2).notes[0]?.duration).toBeGreaterThan(0)
  })

  it('writes the starting registration as control changes at time 0', () => {
    const recorder = new Recorder(0, { ...DEFAULT_SETTINGS, tremulant: true })
    const { controls } = recorder.finish(1)
    expect(controls.every((c) => c.time === 0)).toBe(true)
    expect(controls).toContainEqual({ time: 0, controller: CC_TREMULANT, value: 127 })
    expect(controls).toContainEqual({ time: 0, controller: CC_DRAWBAR_FIRST, value: 127 })
  })

  it('records only what changed when settings are updated', () => {
    const recorder = new Recorder(0, DEFAULT_SETTINGS)
    const before = recorder.finish(0).controls.length
    const next = { ...DEFAULT_SETTINGS, drawbars: drawbarLevelsSchema.parse([8, 8, 8, 4, 0, 0, 0, 0, 0]) }
    recorder.settingsChanged(DEFAULT_SETTINGS, next, 2)
    const { controls } = recorder.finish(3)
    expect(controls.length).toBe(before + 1)
    expect(controls.at(-1)).toEqual({ time: 2, controller: CC_DRAWBAR_FIRST + 3, value: 64 })
  })
})
