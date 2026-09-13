/**
 * Minimal stand-in for the Web Audio graph so engine logic (voice bookkeeping,
 * triggering) can run under jsdom. Nodes record nothing but connections; params
 * keep their last set value so gain math can be asserted.
 */

export class FakeAudioParam {
  value: number
  constructor(value = 0) {
    this.value = value
  }
  setValueAtTime(value: number): this {
    this.value = value
    return this
  }
  linearRampToValueAtTime(value: number): this {
    this.value = value
    return this
  }
  exponentialRampToValueAtTime(value: number): this {
    this.value = value
    return this
  }
  setTargetAtTime(value: number): this {
    this.value = value
    return this
  }
  cancelScheduledValues(): this {
    return this
  }
}

class FakeNode {
  readonly connections: FakeNode[] = []
  connect(target: FakeNode): FakeNode {
    this.connections.push(target)
    return target
  }
  disconnect(): void {
    this.connections.length = 0
  }
}

export class FakeGainNode extends FakeNode {
  readonly gain = new FakeAudioParam(1)
}

export class FakeOscillatorNode extends FakeNode {
  type: OscillatorType = 'sine'
  readonly frequency = new FakeAudioParam(440)
  readonly detune = new FakeAudioParam(0)
  started = false
  stopped = false
  private readonly listeners: Array<() => void> = []
  start(): void {
    this.started = true
  }
  stop(): void {
    this.stopped = true
    for (const listener of this.listeners) listener()
  }
  addEventListener(_type: 'ended', listener: () => void): void {
    this.listeners.push(listener)
  }
}

export class FakeBiquadFilterNode extends FakeNode {
  type: BiquadFilterType = 'lowpass'
  readonly frequency = new FakeAudioParam(350)
  readonly Q = new FakeAudioParam(1)
}

export class FakeAudioBuffer {
  readonly numberOfChannels: number
  readonly length: number
  readonly sampleRate: number
  private readonly channels: Float32Array[]
  constructor(numberOfChannels: number, length: number, sampleRate: number) {
    this.numberOfChannels = numberOfChannels
    this.length = length
    this.sampleRate = sampleRate
    this.channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length))
  }
  getChannelData(channel: number): Float32Array {
    const data = this.channels[channel]
    if (!data) throw new RangeError(`no channel ${channel}`)
    return data
  }
}

export class FakeBufferSourceNode extends FakeNode {
  buffer: FakeAudioBuffer | null = null
  started = false
  stopped = false
  private readonly listeners: Array<() => void> = []
  start(): void {
    this.started = true
  }
  stop(): void {
    this.stopped = true
    for (const listener of this.listeners) listener()
  }
  addEventListener(_type: 'ended', listener: () => void): void {
    this.listeners.push(listener)
  }
}

export class FakeCompressorNode extends FakeNode {
  readonly threshold = new FakeAudioParam()
  readonly knee = new FakeAudioParam()
  readonly ratio = new FakeAudioParam()
  readonly attack = new FakeAudioParam()
  readonly release = new FakeAudioParam()
}

export class FakeAudioContext {
  currentTime = 0
  readonly sampleRate = 48_000
  readonly destination = new FakeNode()
  readonly oscillators: FakeOscillatorNode[] = []
  readonly bufferSources: FakeBufferSourceNode[] = []
  createGain(): FakeGainNode {
    return new FakeGainNode()
  }
  createOscillator(): FakeOscillatorNode {
    const osc = new FakeOscillatorNode()
    this.oscillators.push(osc)
    return osc
  }
  createDynamicsCompressor(): FakeCompressorNode {
    return new FakeCompressorNode()
  }
  createBiquadFilter(): FakeBiquadFilterNode {
    return new FakeBiquadFilterNode()
  }
  createBuffer(numberOfChannels: number, length: number, sampleRate: number): FakeAudioBuffer {
    return new FakeAudioBuffer(numberOfChannels, length, sampleRate)
  }
  createBufferSource(): FakeBufferSourceNode {
    const source = new FakeBufferSourceNode()
    this.bufferSources.push(source)
    return source
  }
}

/** Structural cast: the Organ only touches the members the fake implements. */
export function fakeAudioContext(): AudioContext & FakeAudioContext {
  return new FakeAudioContext() as unknown as AudioContext & FakeAudioContext
}
