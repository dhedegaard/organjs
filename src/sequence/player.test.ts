import { beforeEach, describe, expect, it } from 'vitest'
import { midiNoteSchema } from '../audio/notes'
import { Player, type PlayerTarget } from './player'
import type { Sequence } from './sequence'

const note = (n: number) => midiNoteSchema.parse(n)

type Call = readonly [string, ...number[]]

function fakeTarget(): PlayerTarget & { readonly calls: Call[] } {
  const calls: Call[] = []
  return {
    calls,
    noteOn: (n) => calls.push(['on', n]),
    noteOff: (n) => calls.push(['off', n]),
    allNotesOff: () => calls.push(['allOff']),
    control: (c, v) => calls.push(['cc', c, v]),
  }
}

const sequence: Sequence = {
  notes: [
    { id: 'a', note: note(60), start: 0.5, duration: 1 },
    { id: 'b', note: note(64), start: 1.5, duration: 0.5 },
  ],
  controls: [{ time: 0, controller: 92, value: 127 }],
}

describe('Player', () => {
  let target: ReturnType<typeof fakeTarget>
  let player: Player
  beforeEach(() => {
    target = fakeTarget()
    player = new Player(target)
    player.load(sequence, 0)
  })

  it('is stopped with an empty sequence and refuses to play it', () => {
    const empty = new Player(target)
    empty.load({ notes: [], controls: [] }, 0)
    empty.play(0)
    expect(empty.state).toBe('stopped')
  })

  it('fires events as the clock passes their times', () => {
    player.play(10)
    player.tick(10)
    expect(target.calls).toEqual([['cc', 92, 127]])
    player.tick(10.4)
    expect(target.calls).toHaveLength(1)
    player.tick(10.5)
    expect(target.calls.at(-1)).toEqual(['on', 60])
    player.tick(11.6)
    expect(target.calls.slice(2)).toEqual([['off', 60], ['on', 64]])
    expect(player.position(11.6)).toBeCloseTo(1.6)
  })

  it('releases before striking when two events share an instant', () => {
    const p = new Player(target)
    p.load(
      {
        notes: [
          { id: 'a', note: note(60), start: 0, duration: 1 },
          { id: 'b', note: note(60), start: 1, duration: 1 },
        ],
        controls: [],
      },
      0,
    )
    p.play(0)
    p.tick(1)
    expect(target.calls).toEqual([['on', 60], ['off', 60], ['on', 60]])
  })

  it('stops at the end, releasing everything and rewinding', () => {
    player.play(0)
    player.tick(5)
    expect(player.state).toBe('stopped')
    expect(target.calls.at(-1)).toEqual(['allOff'])
    expect(player.position(5)).toBe(0)
  })

  it('wraps around when looping', () => {
    player.loop = true
    player.play(0)
    player.tick(2.6) // length is 2; 0.6 s into the second pass
    expect(player.state).toBe('playing')
    expect(player.position(2.6)).toBeCloseTo(0.6)
    // First pass, release at the wrap, then the registration and first note again.
    expect(target.calls.slice(-3)).toEqual([['allOff'], ['cc', 92, 127], ['on', 60]])
  })

  it('pauses holding its position and resumes from there', () => {
    player.play(0)
    player.tick(0.7)
    player.pause(0.7)
    expect(player.state).toBe('paused')
    expect(target.calls.at(-1)).toEqual(['allOff'])
    expect(player.position(5)).toBeCloseTo(0.7)
    player.play(20)
    player.tick(20.8) // position 1.5: 60 released, 64 struck
    expect(target.calls.slice(-2)).toEqual([['off', 60], ['on', 64]])
  })

  it('advances twice as fast at rate 2 and clamps the rate', () => {
    player.setRate(2, 0)
    player.play(0)
    expect(player.position(0.5)).toBeCloseTo(1)
    player.setRate(9, 0.5)
    expect(player.rate).toBe(2)
    player.setRate(0.1, 0.5)
    expect(player.rate).toBe(0.5)
  })

  it('seeks, restoring the registration set before that point', () => {
    player.play(0)
    player.tick(0.6)
    target.calls.length = 0
    player.seek(1.5, 0.6)
    expect(target.calls).toEqual([['allOff'], ['cc', 92, 127]])
    player.tick(0.6)
    expect(target.calls.at(-1)).toEqual(['on', 64])
  })

  it('keeps playing from the same position when a new sequence is loaded', () => {
    player.play(0)
    player.tick(0.6)
    target.calls.length = 0
    player.load({ ...sequence, notes: [{ id: 'c', note: note(67), start: 0.8, duration: 0.1 }] }, 0.6)
    expect(target.calls).toEqual([['allOff'], ['cc', 92, 127]])
    player.tick(0.85)
    expect(target.calls.at(-1)).toEqual(['on', 67])
  })
})
