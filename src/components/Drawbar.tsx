import { useRef, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { DRAWBAR_MAX, drawbarLevelSchema, type Drawbar as DrawbarSpec, type DrawbarLevel } from '../audio/voicing'

type Cap = 'brown' | 'black' | 'white'

const CAP_BY_FOOTAGE: Readonly<Record<string, Cap>> = {
  "16'": 'brown',
  "5 1/3'": 'brown',
  "2 2/3'": 'black',
  "1 3/5'": 'black',
  "1 1/3'": 'black',
}

interface DrawbarProps {
  readonly spec: DrawbarSpec
  readonly level: DrawbarLevel
  readonly onChange: (level: DrawbarLevel) => void
}

function clampLevel(value: number): DrawbarLevel {
  const rounded = Math.round(Math.min(DRAWBAR_MAX, Math.max(0, value)))
  return drawbarLevelSchema.parse(rounded)
}

/** A Hammond-style drawbar: pull it toward you (down) to add the partial. */
export function Drawbar({ spec, level, onChange }: DrawbarProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const cap = CAP_BY_FOOTAGE[spec.footage] ?? 'white'

  const levelFromPointer = (clientY: number): DrawbarLevel => {
    const track = trackRef.current
    if (!track) return level
    const rect = track.getBoundingClientRect()
    const travel = rect.height
    const ratio = (clientY - rect.top) / travel
    return clampLevel(ratio * DRAWBAR_MAX)
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    e.currentTarget.focus()
    onChange(levelFromPointer(e.clientY))
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    onChange(levelFromPointer(e.clientY))
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step: Record<string, number> = { ArrowDown: 1, ArrowUp: -1, PageDown: 4, PageUp: -4 }
    if (e.key === 'Home') onChange(clampLevel(0))
    else if (e.key === 'End') onChange(clampLevel(DRAWBAR_MAX))
    else if (e.key in step) onChange(clampLevel(level + (step[e.key] ?? 0)))
    else return
    e.preventDefault()
  }

  return (
    <div
      className={`drawbar drawbar--${cap}`}
      role="slider"
      tabIndex={0}
      aria-label={`${spec.footage} drawbar`}
      aria-valuemin={0}
      aria-valuemax={DRAWBAR_MAX}
      aria-valuenow={level}
      aria-orientation="vertical"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onKeyDown={onKeyDown}
      style={{ '--level': level } as CSSProperties}
    >
      <div className="drawbar__track" ref={trackRef}>
        <div className="drawbar__shaft" />
        <div className="drawbar__cap">
          <span className="drawbar__footage">{spec.footage}</span>
        </div>
      </div>
      <span className="drawbar__level">{level}</span>
    </div>
  )
}
