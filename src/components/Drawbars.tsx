import { DRAWBARS, withLevel, type DrawbarLevels } from '../audio/voicing'
import { Drawbar } from './Drawbar'

interface DrawbarsProps {
  readonly levels: DrawbarLevels
  readonly onChange: (levels: DrawbarLevels) => void
}

export function Drawbars({ levels, onChange }: DrawbarsProps) {
  return (
    <div className="drawbars" role="group" aria-label="Drawbars">
      {DRAWBARS.map((spec, i) => (
        <Drawbar
          key={spec.footage}
          spec={spec}
          level={levels[i] ?? 0}
          onChange={(level) => onChange(withLevel(levels, i, level))}
        />
      ))}
    </div>
  )
}
