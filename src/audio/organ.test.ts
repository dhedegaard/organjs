import { describe, expect, it } from 'vitest'
import { midiNoteSchema } from './notes'
import { DEFAULT_SETTINGS, MAX_VOICES, Organ, PERCUSSION_DECAY_SECONDS } from './organ'
import { DRAWBAR_COUNT } from './voicing'
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

describe('percussion', () => {
  /** Percussion fires before the voice is built: index 0 is the LFO, index 1 the burst. */
  const percussionOscillator = (ctx: ReturnType<typeof fakeAudioContext>) => ctx.oscillators[1]!

  const withPercussion = (harmonic: 2 | 3 = 2, decay: 'fast' | 'slow' = 'fast') => ({
    ...DEFAULT_SETTINGS,
    percussion: { on: true, harmonic, decay },
  })

  it('is off by default and adds no oscillator', () => {
    const ctx = fakeAudioContext()
    const organ = new Organ(ctx)
    organ.noteOn(note(60))
    expect(DEFAULT_SETTINGS.percussion.on).toBe(false)
    expect(ctx.oscillators.length).toBe(1 + DRAWBAR_COUNT) // LFO + one per drawbar
  })

  it('fires an extra oscillator at the chosen harmonic on note on', () => {
    const ctx = fakeAudioContext()
    const organ = new Organ(ctx, withPercussion(3))
    organ.noteOn(note(69)) // A4 = 440 Hz
    expect(ctx.oscillators.length).toBe(1 + DRAWBAR_COUNT + 1)
    expect(percussionOscillator(ctx).frequency.value).toBeCloseTo(1320)
  })

  it('uses the 2nd harmonic when selected', () => {
    const ctx = fakeAudioContext()
    const organ = new Organ(ctx, withPercussion(2))
    organ.noteOn(note(69))
    expect(percussionOscillator(ctx).frequency.value).toBeCloseTo(880)
  })

  it('single-triggers: only fires when no other note is held', () => {
    const ctx = fakeAudioContext()
    const organ = new Organ(ctx, withPercussion())
    organ.noteOn(note(60))
    const afterFirst = ctx.oscillators.length
    organ.noteOn(note(64))
    expect(ctx.oscillators.length).toBe(afterFirst + DRAWBAR_COUNT)
  })

  it('re-arms after all notes are released', () => {
    const ctx = fakeAudioContext()
    const organ = new Organ(ctx, withPercussion())
    organ.noteOn(note(60))
    organ.noteOff(note(60))
    const before = ctx.oscillators.length
    organ.noteOn(note(62))
    expect(ctx.oscillators.length).toBe(before + DRAWBAR_COUNT + 1)
  })

  it('exposes distinct decay times for fast and slow', () => {
    expect(PERCUSSION_DECAY_SECONDS.fast).toBeLessThan(PERCUSSION_DECAY_SECONDS.slow)
  })
})
