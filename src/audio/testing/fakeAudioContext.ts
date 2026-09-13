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

export class FakeCompressorNode extends FakeNode {
  readonly threshold = new FakeAudioParam()
  readonly knee = new FakeAudioParam()
  readonly ratio = new FakeAudioParam()
  readonly attack = new FakeAudioParam()
  readonly release = new FakeAudioParam()
}

export class FakeAudioContext {
  currentTime = 0
  readonly destination = new FakeNode()
  readonly oscillators: FakeOscillatorNode[] = []
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
}

/** Structural cast: the Organ only touches the members the fake implements. */
export function fakeAudioContext(): AudioContext & FakeAudioContext {
  return new FakeAudioContext() as unknown as AudioContext & FakeAudioContext
}
