import { midiToFrequency, type MidiNote } from './notes'
import {
  DEFAULT_LEVELS,
  DRAWBARS,
  levelToGain,
  partialsFor,
  type DrawbarLevels,
} from './voicing'

export type PercussionHarmonic = 2 | 3
export type PercussionDecay = 'fast' | 'slow'

export interface PercussionSettings {
  readonly on: boolean
  readonly harmonic: PercussionHarmonic
  readonly decay: PercussionDecay
}

export interface OrganSettings {
  readonly drawbars: DrawbarLevels
  readonly tremulant: boolean
  readonly percussion: PercussionSettings
  /** Hammond-style contact noise on key press and release. */
  readonly keyClick: boolean
  readonly volume: number
}

export const DEFAULT_PERCUSSION: PercussionSettings = { on: false, harmonic: 3, decay: 'fast' }

export const DEFAULT_SETTINGS: OrganSettings = {
  drawbars: DEFAULT_LEVELS,
  tremulant: false,
  percussion: DEFAULT_PERCUSSION,
  keyClick: false,
  volume: 0.6,
}

/** Voices held at once before the oldest is stolen; keeps a mashed keyboard from piling up oscillators. */
export const MAX_VOICES = 16

const ATTACK_SECONDS = 0.012
const RELEASE_SECONDS = 0.08
export const PERCUSSION_DECAY_SECONDS: Readonly<Record<PercussionDecay, number>> = { fast: 0.2, slow: 0.6 }
const PERCUSSION_GAIN = 0.35
/** Attack and release clicks; the release is softer, as on the real contacts. */
export const KEY_CLICK_GAIN: Readonly<Record<'on' | 'off', number>> = { on: 0.3, off: 0.15 }
const KEY_CLICK_SECONDS = 0.03
const KEY_CLICK_FILTER_HZ = 2_800
/** The shared noise buffer is longer than one click so each click can start from a different spot. */
const NOISE_BUFFER_SECONDS = 0.25
const TREMULANT_RATE_HZ = 5.8
const TREMULANT_DEPTH = 0.18
/** Cents of detune per partial index, giving a subtle pipe-like chorus. */
const DETUNE_CENTS = [0, 2, -1.5, 1, -2, 1.5, -1, 2.5, -2.5] as const

interface Voice {
  readonly oscillators: readonly OscillatorNode[]
  readonly partialGains: readonly GainNode[]
  readonly envelope: GainNode
}

/**
 * Additive-synthesis organ on the Web Audio API. One voice per held note; each
 * voice has one sine oscillator per drawbar feeding a shared envelope.
 */
export class Organ {
  private readonly voices = new Map<MidiNote, Voice>()
  private readonly master: GainNode
  private readonly tremulantLfo: OscillatorNode
  private readonly tremulantDepth: GainNode
  private readonly noise: AudioBuffer
  private readonly ctx: AudioContext
  private settings: OrganSettings

  constructor(ctx: AudioContext, settings: OrganSettings = DEFAULT_SETTINGS) {
    this.ctx = ctx
    this.settings = settings

    const limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = -6
    limiter.knee.value = 6
    limiter.ratio.value = 12
    limiter.attack.value = 0.003
    limiter.release.value = 0.1
    limiter.connect(ctx.destination)

    this.master = ctx.createGain()
    this.master.gain.value = settings.volume
    this.master.connect(limiter)

    this.tremulantLfo = ctx.createOscillator()
    this.tremulantLfo.frequency.value = TREMULANT_RATE_HZ
    this.tremulantDepth = ctx.createGain()
    this.tremulantDepth.gain.value = settings.tremulant ? TREMULANT_DEPTH * settings.volume : 0
    this.tremulantLfo.connect(this.tremulantDepth)
    this.tremulantDepth.connect(this.master.gain)
    this.tremulantLfo.start()

    this.noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * NOISE_BUFFER_SECONDS), ctx.sampleRate)
    const samples = this.noise.getChannelData(0)
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1
  }

  get activeNotes(): ReadonlySet<MidiNote> {
    return new Set(this.voices.keys())
  }

  noteOn(note: MidiNote): void {
    if (this.voices.has(note)) return
    // Hammond single-trigger: percussion only sounds on a note struck from silence.
    if (this.settings.percussion.on && this.voices.size === 0) this.triggerPercussion(note)
    if (this.settings.keyClick) this.triggerKeyClick('on')
    if (this.voices.size >= MAX_VOICES) this.stealOldestVoice()
    const now = this.ctx.currentTime
    const partials = partialsFor(midiToFrequency(note), this.settings.drawbars)

    const envelope = this.ctx.createGain()
    envelope.gain.setValueAtTime(0, now)
    envelope.gain.linearRampToValueAtTime(1, now + ATTACK_SECONDS)
    envelope.connect(this.master)

    const oscillators: OscillatorNode[] = []
    const partialGains: GainNode[] = []
    partials.forEach((partial, i) => {
      const osc = this.ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = partial.frequency
      osc.detune.value = DETUNE_CENTS[i] ?? 0
      const gain = this.ctx.createGain()
      gain.gain.value = partial.gain
      osc.connect(gain)
      gain.connect(envelope)
      osc.start(now)
      oscillators.push(osc)
      partialGains.push(gain)
    })

    this.voices.set(note, { oscillators, partialGains, envelope })
  }

  noteOff(note: MidiNote): void {
    const voice = this.voices.get(note)
    if (!voice) return
    this.voices.delete(note)
    if (this.settings.keyClick) this.triggerKeyClick('off')
    const now = this.ctx.currentTime
    voice.envelope.gain.cancelScheduledValues(now)
    voice.envelope.gain.setValueAtTime(voice.envelope.gain.value, now)
    voice.envelope.gain.linearRampToValueAtTime(0, now + RELEASE_SECONDS)
    const stopAt = now + RELEASE_SECONDS + 0.02
    for (const osc of voice.oscillators) osc.stop(stopAt)
    voice.oscillators[0]?.addEventListener('ended', () => voice.envelope.disconnect())
  }

  /** A short sine burst at the 2nd or 3rd harmonic with an exponential decay. */
  private triggerPercussion(note: MidiNote): void {
    const { harmonic, decay } = this.settings.percussion
    const now = this.ctx.currentTime
    const seconds = PERCUSSION_DECAY_SECONDS[decay]
    const osc = this.ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = midiToFrequency(note) * harmonic
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(PERCUSSION_GAIN, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + seconds)
    osc.connect(gain)
    gain.connect(this.master)
    osc.start(now)
    osc.stop(now + seconds + 0.02)
    osc.addEventListener('ended', () => gain.disconnect())
  }

  /** A few milliseconds of band-passed noise, read from a random spot in the shared buffer. */
  private triggerKeyClick(edge: 'on' | 'off'): void {
    const now = this.ctx.currentTime
    const source = this.ctx.createBufferSource()
    source.buffer = this.noise
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = KEY_CLICK_FILTER_HZ
    filter.Q.value = 0.7
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(KEY_CLICK_GAIN[edge], now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + KEY_CLICK_SECONDS)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(this.master)
    const offset = Math.random() * (NOISE_BUFFER_SECONDS - KEY_CLICK_SECONDS)
    source.start(now, offset, KEY_CLICK_SECONDS)
    source.addEventListener('ended', () => gain.disconnect())
  }

  /** The Map keeps insertion order, so the first key is the longest-held note. */
  private stealOldestVoice(): void {
    const oldest = this.voices.keys().next()
    if (!oldest.done) this.noteOff(oldest.value)
  }

  allNotesOff(): void {
    for (const note of [...this.voices.keys()]) this.noteOff(note)
  }

  update(settings: OrganSettings): void {
    const now = this.ctx.currentTime
    if (settings.drawbars !== this.settings.drawbars) {
      for (const voice of this.voices.values()) {
        DRAWBARS.forEach((_, i) => {
          voice.partialGains[i]?.gain.setTargetAtTime(levelToGain(settings.drawbars[i]), now, 0.01)
        })
      }
    }
    this.master.gain.setTargetAtTime(settings.volume, now, 0.02)
    const depth = settings.tremulant ? TREMULANT_DEPTH * settings.volume : 0
    this.tremulantDepth.gain.setTargetAtTime(depth, now, 0.05)
    this.settings = settings
  }
}
