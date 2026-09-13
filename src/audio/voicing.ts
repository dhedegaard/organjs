import * as z from 'zod'
import { hertzSchema, type Hertz } from './notes'

export interface Drawbar {
  readonly footage: string
  readonly ratio: number
}

/** Hammond drawbar footages in console order. Ratio is relative to the fundamental (8'). */
export const DRAWBARS = [
  { footage: "16'", ratio: 0.5 },
  { footage: "5 1/3'", ratio: 1.5 },
  { footage: "8'", ratio: 1 },
  { footage: "4'", ratio: 2 },
  { footage: "2 2/3'", ratio: 3 },
  { footage: "2'", ratio: 4 },
  { footage: "1 3/5'", ratio: 5 },
  { footage: "1 1/3'", ratio: 6 },
  { footage: "1'", ratio: 8 },
] as const satisfies readonly Drawbar[]

export const DRAWBAR_COUNT = DRAWBARS.length
export const DRAWBAR_MAX = 8

export const drawbarLevelSchema = z.number().int().min(0).max(DRAWBAR_MAX)
export type DrawbarLevel = z.infer<typeof drawbarLevelSchema>

const L = drawbarLevelSchema
/** Nine levels, 0 (pushed in) to 8 (fully out), one per drawbar. */
export const drawbarLevelsSchema = z.tuple([L, L, L, L, L, L, L, L, L]).readonly()
export type DrawbarLevels = z.infer<typeof drawbarLevelsSchema>

export interface Partial {
  readonly frequency: Hertz
  readonly gain: number
}

/** Classic "full organ" registration: 888 000 000. */
export const DEFAULT_LEVELS: DrawbarLevels = [8, 8, 8, 0, 0, 0, 0, 0, 0]

/**
 * Per-partial gain scale. Nine drawbars fully out sum to 9/4 = 2.25, which the
 * master compressor tames; typical registrations land comfortably below 1.
 */
const PARTIAL_SCALE = 0.25

/** One partial per drawbar, in drawbar order, so voices can map index to oscillator. */
export function partialsFor(fundamental: Hertz, levels: DrawbarLevels): readonly Partial[] {
  return DRAWBARS_INDEXED.map(([drawbar, i]) => ({
    frequency: hertzSchema.parse(fundamental * drawbar.ratio),
    gain: levelToGain(levels[i]),
  }))
}

export function levelToGain(level: DrawbarLevel): number {
  return (level / DRAWBAR_MAX) * PARTIAL_SCALE
}

const DRAWBARS_INDEXED = DRAWBARS.map((d, i) => [d, i] as const)

export function withLevel(levels: DrawbarLevels, index: number, level: DrawbarLevel): DrawbarLevels {
  const next = [...levels]
  next[index] = level
  return drawbarLevelsSchema.parse(next)
}
