import { describe, expect, it } from 'vitest'
import { hertzSchema } from './notes'
import {
  DRAWBARS,
  DRAWBAR_COUNT,
  drawbarLevelsSchema,
  levelToGain,
  partialsFor,
  withLevel,
  type DrawbarLevels,
} from './voicing'

const hz = (n: number) => hertzSchema.parse(n)

describe('DRAWBARS', () => {
  it('lists the nine Hammond footages with correct frequency ratios', () => {
    expect(DRAWBAR_COUNT).toBe(9)
    expect(DRAWBARS.map((d) => d.footage)).toEqual([
      "16'", "5 1/3'", "8'", "4'", "2 2/3'", "2'", "1 3/5'", "1 1/3'", "1'",
    ])
    expect(DRAWBARS.map((d) => d.ratio)).toEqual([0.5, 1.5, 1, 2, 3, 4, 5, 6, 8])
  })
})

describe('drawbarLevelsSchema', () => {
  it('accepts nine integer levels 0..8', () => {
    expect(drawbarLevelsSchema.safeParse([8, 8, 8, 0, 0, 0, 0, 0, 0]).success).toBe(true)
  })
  it('rejects wrong length or out-of-range levels', () => {
    expect(drawbarLevelsSchema.safeParse([8, 8, 8]).success).toBe(false)
    expect(drawbarLevelsSchema.safeParse([9, 0, 0, 0, 0, 0, 0, 0, 0]).success).toBe(false)
  })
})

describe('partialsFor', () => {
  it('returns one partial per drawbar, in order, with scaled frequencies', () => {
    const levels: DrawbarLevels = [8, 0, 8, 0, 0, 0, 0, 0, 0]
    const partials = partialsFor(hz(200), levels)
    expect(partials).toHaveLength(9)
    expect(partials.map((p) => p.frequency)).toEqual([100, 300, 200, 400, 600, 800, 1000, 1200, 1600])
  })

  it('gives silent partials zero gain and open drawbars the full scaled gain', () => {
    const levels: DrawbarLevels = [8, 0, 4, 0, 0, 0, 0, 0, 0]
    const partials = partialsFor(hz(440), levels)
    expect(partials[0]?.gain).toBe(levelToGain(8))
    expect(partials[1]?.gain).toBe(0)
    expect(partials[2]?.gain).toBe(levelToGain(4))
    expect(levelToGain(4)).toBeCloseTo(levelToGain(8) / 2)
  })
})

describe('withLevel', () => {
  it('returns a new tuple with one level replaced', () => {
    const base: DrawbarLevels = [0, 0, 0, 0, 0, 0, 0, 0, 0]
    const next = withLevel(base, 3, 5)
    expect(next[3]).toBe(5)
    expect(base[3]).toBe(0)
  })
})
