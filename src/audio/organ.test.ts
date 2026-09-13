import { describe, expect, it } from 'vitest'
import { midiNoteSchema } from './notes'
import { MAX_VOICES, Organ } from './organ'
import { fakeAudioContext } from './testing/fakeAudioContext'

const note = (n: number) => midiNoteSchema.parse(n)

describe('polyphony guard', () => {
  it('never holds more than MAX_VOICES voices', () => {
    const organ = new Organ(fakeAudioContext())
    for (let n = 36; n < 36 + MAX_VOICES + 5; n++) organ.noteOn(note(n))
    expect(organ.activeNotes.size).toBe(MAX_VOICES)
  })

  it('steals the oldest voice when the cap is reached', () => {
    const organ = new Organ(fakeAudioContext())
    for (let n = 36; n < 36 + MAX_VOICES; n++) organ.noteOn(note(n))
    organ.noteOn(note(90))
    expect(organ.activeNotes.has(note(36))).toBe(false)
    expect(organ.activeNotes.has(note(37))).toBe(true)
    expect(organ.activeNotes.has(note(90))).toBe(true)
  })

  it('stops the stolen voice\'s oscillators', () => {
    const ctx = fakeAudioContext()
    const organ = new Organ(ctx)
    for (let n = 36; n < 36 + MAX_VOICES; n++) organ.noteOn(note(n))
    const firstVoiceOscillators = ctx.oscillators.slice(1, 10) // index 0 is the tremulant LFO
    organ.noteOn(note(90))
    expect(firstVoiceOscillators.every((osc) => osc.stopped)).toBe(true)
  })
})
