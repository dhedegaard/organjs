interface TabProps {
  readonly label: string
  readonly on: boolean
  /** Text for the two rocker positions, off first. Defaults to Off/On. */
  readonly states?: readonly [off: string, on: string]
  readonly onToggle: (on: boolean) => void
}

/** A Hammond-style rocker tab: tilts when engaged and lights an indicator lamp. */
export function Tab({ label, on, states = ['Off', 'On'], onToggle }: TabProps) {
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
        <span className="tab__state">{on ? states[1] : states[0]}</span>
      </span>
    </button>
  )
}
