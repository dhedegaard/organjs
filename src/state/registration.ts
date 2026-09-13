import * as z from 'zod'
import { DEFAULT_SETTINGS, type OrganSettings, type PercussionSettings } from '../audio/organ'
import { DRAWBAR_COUNT, drawbarLevelsSchema, type DrawbarLevels } from '../audio/voicing'

/** The shareable part of the settings: everything except device-specific volume. */
export interface Registration {
  readonly drawbars: DrawbarLevels
  readonly tremulant: boolean
  readonly percussion: PercussionSettings
  readonly keyClick: boolean
}

const flag = z.enum(['0', '1']).transform((v) => v === '1')

/** Nine digits like `888000000`, one per drawbar. */
const drawbarDigits = z
  .string()
  .regex(new RegExp(`^[0-8]{${DRAWBAR_COUNT}}$`))
  .transform((s) => drawbarLevelsSchema.parse([...s].map(Number)))

const paramsSchema = z.object({
  d: drawbarDigits.optional(),
  t: flag.optional(),
  p: flag.optional(),
  h: z.enum(['2', '3']).transform(Number).pipe(z.literal([2, 3])).optional(),
  dc: z.enum(['fast', 'slow']).optional(),
  k: flag.optional(),
})

export function encodeRegistration(settings: OrganSettings): string {
  const { drawbars, tremulant, percussion, keyClick } = settings
  return new URLSearchParams({
    d: drawbars.join(''),
    t: tremulant ? '1' : '0',
    p: percussion.on ? '1' : '0',
    h: String(percussion.harmonic),
    dc: percussion.decay,
    k: keyClick ? '1' : '0',
  }).toString()
}

/** Parse a hash or query string. Missing params fall back to defaults; anything malformed is rejected. */
export function decodeRegistration(hash: string): Registration | undefined {
  const query = hash.replace(/^#/, '')
  if (query === '') return undefined
  const raw = Object.fromEntries(new URLSearchParams(query))
  const parsed = paramsSchema.safeParse(raw)
  if (!parsed.success) return undefined
  const { d, t, p, h, dc, k } = parsed.data
  const base = DEFAULT_SETTINGS
  return {
    drawbars: d ?? base.drawbars,
    tremulant: t ?? base.tremulant,
    percussion: {
      on: p ?? base.percussion.on,
      harmonic: h ?? base.percussion.harmonic,
      decay: dc ?? base.percussion.decay,
    },
    keyClick: k ?? base.keyClick,
  }
}
