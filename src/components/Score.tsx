import type { PointerEvent as ReactPointerEvent } from 'react'
import { midiToName, type MidiNote } from '../audio/notes'
import {
  spell,
  toScore,
  UNIT_SECONDS,
  UNITS_PER_MEASURE,
  valueGlyph,
  valueName,
  type ScoreChord,
  type ScoreEvent,
  type ScoreRest,
  type Staff,
} from '../sequence/notation'
import type { Sequence } from '../sequence/sequence'
import { formatSeconds } from '../sequence/time'
import { RULER_HEIGHT } from './timeline'

interface ScoreProps {
  readonly sequence: Sequence
  /** Playhead position in seconds. */
  readonly position: number
  readonly onSeek: (position: number) => void
  readonly pixelsPerSecond: number
  /** Fill at least this wide. */
  readonly minWidth: number
}

/** One staff space in pixels; SMuFL glyphs are drawn at 4 spaces per em. */
const SP = 8
const FONT_SIZE = 4 * SP
/** Room for the clef and time signature, the score's counterpart to the roll's key column. */
export const CLEF_WIDTH = 80
const TIME_SIGNATURE_X = 44
const STAFF_MARGIN = 7 * SP
const STEM_LENGTH = 3.5 * SP
const STEM_WIDTH = 0.12 * SP
const HEAD_WIDTH = 1.18 * SP
const WHOLE_HEAD_WIDTH = 1.688 * SP
const STEM_ANCHOR_Y = 0.168 * SP
const LEDGER_EXTENSION = 0.4 * SP

/** Bravura codepoints (SMuFL). */
const GLYPH = {
  gClef: '',
  fClef: '',
  four: '',
  whole: '',
  half: '',
  black: '',
  flagUp: ['', '', ''],
  flagDown: ['', '', ''],
  sharp: '',
  natural: '',
  dot: '',
  rest: { 16: '', 8: '', 4: '', 2: '', 1: '' } as const,
} as const

interface StaffGeometry {
  readonly top: number
  /** Diatonic step on the bottom line. */
  readonly bottomStep: number
  readonly middleStep: number
}

const TREBLE_BOTTOM_STEP = 37 // E4
const BASS_BOTTOM_STEP = 25 // G2

function staffGeometry(staff: Staff): StaffGeometry {
  const trebleTop = RULER_HEIGHT + STAFF_MARGIN
  if (staff === 'treble') return { top: trebleTop, bottomStep: TREBLE_BOTTOM_STEP, middleStep: TREBLE_BOTTOM_STEP + 4 }
  return { top: trebleTop + 4 * SP + STAFF_MARGIN, bottomStep: BASS_BOTTOM_STEP, middleStep: BASS_BOTTOM_STEP + 4 }
}

export const SCORE_HEIGHT = staffGeometry('bass').top + 4 * SP + STAFF_MARGIN

const stepY = (g: StaffGeometry, step: number) => g.top + 4 * SP - ((step - g.bottomStep) * SP) / 2

/** Heads a second apart sit on alternate sides of the stem. */
function displaced(steps: readonly number[], stemUp: boolean): boolean[] {
  const order = stemUp ? steps : [...steps].reverse()
  const out: boolean[] = []
  for (const [i, step] of order.entries()) {
    const previous = order[i - 1]
    out.push(previous !== undefined && Math.abs(step - previous) === 1 && !out[i - 1])
  }
  return stemUp ? out : out.reverse()
}

interface Placed {
  readonly pitch: MidiNote
  readonly step: number
  readonly x: number
  readonly y: number
}

function Glyph({ x, y, text, className }: { x: number; y: number; text: string; className?: string }) {
  return (
    <text className={`score__glyph${className ? ` ${className}` : ''}`} x={x} y={y} fontSize={FONT_SIZE}>
      {text}
    </text>
  )
}

function Ledgers({ g, step, x, width }: { g: StaffGeometry; step: number; x: number; width: number }) {
  const lines: number[] = []
  for (let s = g.bottomStep + 10; s <= step; s += 2) lines.push(s)
  for (let s = g.bottomStep - 2; s >= step; s -= 2) lines.push(s)
  return (
    <>
      {lines.map((s) => (
        <line key={s} className="score__ledger" x1={x - LEDGER_EXTENSION} x2={x + width + LEDGER_EXTENSION} y1={stepY(g, s)} y2={stepY(g, s)} />
      ))}
    </>
  )
}

function Rest({ rest, g, x }: { rest: ScoreRest; g: StaffGeometry; x: number }) {
  const { dotted } = valueGlyph(rest.duration)
  const base = dotted ? ((rest.duration * 2) / 3) : rest.duration
  const glyph = GLYPH.rest[base as keyof typeof GLYPH.rest]
  // Whole rests hang from the fourth line, half rests sit on the middle line, the rest are centred on it.
  const y = base === 16 ? g.top + SP : g.top + 2 * SP
  return (
    <g className="score__rest" aria-label={`${valueName(rest.duration)} rest at ${formatSeconds(rest.start * UNIT_SECONDS)}`}>
      <Glyph x={x} y={y} text={glyph} />
      {dotted && <Glyph x={x + 1.4 * SP} y={g.top + 1.5 * SP} text={GLYPH.dot} />}
    </g>
  )
}

function Chord({ chord, g, x, next, playing }: { chord: ScoreChord; g: StaffGeometry; x: number; next?: number; playing: boolean }) {
  const { head, flags, dotted } = valueGlyph(chord.duration)
  const headWidth = head === 'whole' ? WHOLE_HEAD_WIDTH : HEAD_WIDTH
  const steps = chord.pitches.map((p) => spell(p).step)
  const mean = steps.reduce((a, b) => a + b, 0) / steps.length
  const stemUp = head === 'whole' ? true : mean < g.middleStep
  const sides = displaced(steps, stemUp)
  const stemX = stemUp ? x + headWidth - STEM_WIDTH / 2 : x + STEM_WIDTH / 2
  const placed: Placed[] = chord.pitches.map((pitch, i) => {
    const step = steps[i]!
    const shift = sides[i] ? (stemUp ? headWidth - STEM_WIDTH : -(headWidth - STEM_WIDTH)) : 0
    return { pitch, step, x: x + shift, y: stepY(g, step) }
  })
  const highest = Math.min(...placed.map((p) => p.y))
  const lowest = Math.max(...placed.map((p) => p.y))
  const stemStart = stemUp ? lowest - STEM_ANCHOR_Y : highest + STEM_ANCHOR_Y
  const stemEnd = stemUp ? highest - STEM_LENGTH : lowest + STEM_LENGTH
  const label = `${chord.pitches.map(midiToName).join(' ')} ${valueName(chord.duration)} at ${formatSeconds(chord.start * UNIT_SECONDS)}`
  return (
    <g className={`score__chord${playing ? ' score__chord--playing' : ''}`} aria-label={label}>
      {placed.map((p, i) => {
        const accidental = chord.accidentals[i]
        const onLine = (p.step - g.bottomStep) % 2 === 0
        return (
          <g key={p.pitch}>
            <Ledgers g={g} step={p.step} x={p.x} width={headWidth} />
            {accidental && (
              <Glyph x={x - (accidental === 'sharp' ? 1.25 : 0.95) * SP} y={p.y} text={accidental === 'sharp' ? GLYPH.sharp : GLYPH.natural} />
            )}
            <Glyph x={p.x} y={p.y} text={GLYPH[head]} />
            {dotted && <Glyph x={Math.max(x, p.x) + headWidth + 0.35 * SP} y={onLine ? p.y - SP / 2 : p.y} text={GLYPH.dot} />}
            {chord.ties.includes(p.pitch) && next !== undefined && (
              <path
                className="score__tie"
                d={`M ${p.x + headWidth + 0.2 * SP} ${p.y} Q ${(p.x + headWidth + next) / 2} ${p.y + (stemUp ? 1 : -1) * SP} ${next - 0.2 * SP} ${p.y}`}
              />
            )}
          </g>
        )
      })}
      {head !== 'whole' && <line className="score__stem" x1={stemX} x2={stemX} y1={stemStart} y2={stemEnd} />}
      {flags > 0 && (
        <Glyph x={stemX - STEM_WIDTH / 2} y={stemEnd} text={stemUp ? GLYPH.flagUp[flags]! : GLYPH.flagDown[flags]!} />
      )}
    </g>
  )
}

function StaffLines({ g, width }: { g: StaffGeometry; width: number }) {
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <line key={i} className="score__line" x1={0} x2={width} y1={g.top + i * SP} y2={g.top + i * SP} />
      ))}
    </>
  )
}

/** Read-only grand-staff view of a sequence, laid out proportionally to time. */
export function Score({ sequence, position, onSeek, pixelsPerSecond, minWidth }: ScoreProps) {
  const score = toScore(sequence)
  const seconds = (score.measures * UNITS_PER_MEASURE + 4) * UNIT_SECONDS
  const width = Math.max(minWidth, CLEF_WIDTH + seconds * pixelsPerSecond)
  const xOf = (time: number) => CLEF_WIDTH + time * pixelsPerSecond
  const xOfUnits = (units: number) => xOf(units * UNIT_SECONDS)
  const treble = staffGeometry('treble')
  const bass = staffGeometry('bass')
  const bottom = bass.top + 4 * SP

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    onSeek(Math.max(0, (e.clientX - rect.left - CLEF_WIDTH) / pixelsPerSecond))
  }

  const renderStaff = (staff: Staff, g: StaffGeometry) => {
    const events = score.staves[staff]
    return events.map((event: ScoreEvent, i) => {
      const x = xOfUnits(event.start)
      if (event.kind === 'rest') return <Rest key={event.start} rest={event} g={g} x={x} />
      const following = events[i + 1]
      const next = following?.kind === 'chord' ? xOfUnits(following.start) : undefined
      const start = event.start * UNIT_SECONDS
      const playing = position >= start && position < start + event.duration * UNIT_SECONDS
      return <Chord key={event.start} chord={event} g={g} x={x} next={next} playing={playing} />
    })
  }

  const beats: number[] = []
  for (let t = 0; t <= seconds; t += 0.5) beats.push(t)

  return (
    <svg className="roll__canvas score" width={width} height={SCORE_HEIGHT} onPointerDown={onPointerDown}>
      {beats.map((t) => (
        <line key={t} className="roll__grid roll__grid--beat" x1={xOf(t)} x2={xOf(t)} y1={0} y2={RULER_HEIGHT} />
      ))}
      {beats
        .filter((t) => Number.isInteger(t))
        .map((t) => (
          <text key={t} className="roll__ruler" x={xOf(t) + 3} y={13}>
            {formatSeconds(t).replace(/\.\d$/, '')}
          </text>
        ))}
      <StaffLines g={treble} width={width} />
      <StaffLines g={bass} width={width} />
      <line className="score__barline" x1={0.5} x2={0.5} y1={treble.top} y2={bottom} />
      {Array.from({ length: score.measures }, (_, m) => (m + 1) * UNITS_PER_MEASURE).map((units) => (
        <line key={units} className="score__barline" x1={xOfUnits(units)} x2={xOfUnits(units)} y1={treble.top} y2={bottom} />
      ))}
      <Glyph x={8} y={treble.top + 3 * SP} text={GLYPH.gClef} />
      <Glyph x={8} y={bass.top + SP} text={GLYPH.fClef} />
      {[treble, bass].map((g) => (
        <g key={g.top}>
          <Glyph x={TIME_SIGNATURE_X} y={g.top + SP} text={GLYPH.four} />
          <Glyph x={TIME_SIGNATURE_X} y={g.top + 3 * SP} text={GLYPH.four} />
        </g>
      ))}
      {renderStaff('treble', treble)}
      {renderStaff('bass', bass)}
      <line className="roll__playhead" x1={xOf(position)} x2={xOf(position)} y1={0} y2={SCORE_HEIGHT} />
    </svg>
  )
}
