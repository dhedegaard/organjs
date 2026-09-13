import type { MidiInputController } from '../hooks/useMidiInput'

interface MidiPickerProps {
  readonly midi: MidiInputController
}

/** Connect button, then a device list. Says so plainly when the browser has no Web MIDI. */
export function MidiPicker({ midi }: MidiPickerProps) {
  const { status, inputs, selectedId, connect, select } = midi

  if (status === 'unsupported') {
    return <p className="midi midi__note">MIDI input isn't available in this browser.</p>
  }
  if (status === 'denied') {
    return <p className="midi midi__note">MIDI access was denied. Allow it in the site settings and reload.</p>
  }
  if (status !== 'ready') {
    return (
      <button type="button" className="preset midi" onClick={() => void connect()} disabled={status === 'requesting'}>
        {status === 'requesting' ? 'Connecting MIDI…' : 'Connect MIDI'}
      </button>
    )
  }
  if (inputs.length === 0) {
    return <p className="midi midi__note">No MIDI devices found. Plug one in and it will appear here.</p>
  }
  return (
    <label className="midi">
      <span>MIDI in</span>
      <select value={selectedId ?? ''} onChange={(e) => select(e.target.value === '' ? null : e.target.value)}>
        <option value="">None</option>
        {inputs.map((input) => (
          <option key={input.id} value={input.id}>
            {input.name}
          </option>
        ))}
      </select>
    </label>
  )
}
