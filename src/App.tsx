import { midiNoteSchema } from './audio/notes'
import { drawbarLevelsSchema } from './audio/voicing'
import { Drawbars } from './components/Drawbars'
import { Keyboard } from './components/Keyboard'
import { MidiPicker } from './components/MidiPicker'
import { Tab } from './components/Tab'
import { useMidiInput } from './hooks/useMidiInput'
import { useOrgan } from './hooks/useOrgan'
import { useQwertyKeys } from './hooks/useQwertyKeys'

const MANUAL_LOW = midiNoteSchema.parse(48)
const MANUAL_HIGH = midiNoteSchema.parse(84)

const PRESETS = {
  'Full organ': [8, 8, 8, 0, 0, 0, 0, 0, 0],
  'Jazz': [8, 8, 8, 8, 0, 0, 0, 0, 0],
  'Gospel': [8, 8, 8, 8, 8, 8, 8, 8, 8],
  'Flute': [0, 0, 8, 0, 0, 0, 0, 0, 0],
  'Principal chorus': [0, 0, 8, 6, 0, 4, 0, 0, 2],
} as const

export default function App() {
  const organ = useOrgan()
  useQwertyKeys(organ)
  const midi = useMidiInput(organ)

  return (
    <main className="console">
      <section className="rail">
        <h1 className="rail__title">organjs</h1>
        <Drawbars levels={organ.settings.drawbars} onChange={(drawbars) => organ.updateSettings({ drawbars })} />
        <div className="rail__controls">
          <div className="presets">
            {Object.entries(PRESETS).map(([name, levels]) => (
              <button
                key={name}
                type="button"
                className="preset"
                onClick={() => organ.updateSettings({ drawbars: drawbarLevelsSchema.parse(levels) })}
              >
                {name}
              </button>
            ))}
          </div>
          <Tab label="Tremulant" on={organ.settings.tremulant} onToggle={(tremulant) => organ.updateSettings({ tremulant })} />
          <label className="volume">
            <span>Volume</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={organ.settings.volume}
              onChange={(e) => organ.updateSettings({ volume: Number(e.target.value) })}
            />
          </label>
          <MidiPicker midi={midi} />
        </div>
      </section>
      <div className="fallboard" aria-hidden="true" />
      <Keyboard
        low={MANUAL_LOW}
        high={MANUAL_HIGH}
        activeNotes={organ.activeNotes}
        onNoteOn={organ.noteOn}
        onNoteOff={organ.noteOff}
      />
      <p className="hint">Click or drag across the keys, or play the Z and Q rows on your keyboard, or connect a MIDI keyboard. Pull the drawbars down to add harmonics.</p>
    </main>
  )
}
