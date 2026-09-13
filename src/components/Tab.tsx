interface TabProps {
  readonly label: string
  readonly on: boolean
  readonly onToggle: (on: boolean) => void
}

/** A Hammond-style rocker tab: tilts when engaged and lights an indicator lamp. */
export function Tab({ label, on, onToggle }: TabProps) {
  return (
    <button
      type="button"
      className={`tab${on ? ' tab--on' : ''}`}
      role="switch"
      aria-checked={on}
      onClick={() => onToggle(!on)}
    >
      <span className="tab__lamp" aria-hidden="true" />
      <span className="tab__rocker" aria-hidden="true">
        <span className="tab__face tab__face--top" />
        <span className="tab__face tab__face--bottom" />
      </span>
      <span className="tab__text">
        <span className="tab__label">{label}</span>
        <span className="tab__state">{on ? 'On' : 'Off'}</span>
      </span>
    </button>
  )
}
