import { midiNoteSchema } from './audio/notes'
import type { PercussionSettings } from './audio/organ'
import { drawbarLevelsSchema } from './audio/voicing'
import { Drawbars } from './components/Drawbars'
import { Keyboard } from './components/Keyboard'
import { CopyLink } from './components/CopyLink'
import { MidiPicker } from './components/MidiPicker'
import { Tab } from './components/Tab'
import { Transport } from './components/Transport'
import { useMidiInput } from './hooks/useMidiInput'
import { useOrgan } from './hooks/useOrgan'
import { useQwertyKeys } from './hooks/useQwertyKeys'
import { useSequencer } from './hooks/useSequencer'
import { initialSettingsFromUrl, useRegistrationUrl } from './hooks/useRegistrationUrl'

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
  const organ = useOrgan(initialSettingsFromUrl)
  useRegistrationUrl(organ.settings)
  const sequencer = useSequencer(organ)
  // Every input plays through the sequencer so it can record.
  const player = { ...organ, noteOn: sequencer.noteOn, noteOff: sequencer.noteOff }
  const qwerty = useQwertyKeys(player)
  const midi = useMidiInput(player)
  const { percussion } = organ.settings
  const setPercussion = (patch: Partial<PercussionSettings>) =>
    organ.updateSettings({ percussion: { ...percussion, ...patch } })

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
          <div className="tabs">
            <Tab label="Tremulant" on={organ.settings.tremulant} onToggle={(tremulant) => organ.updateSettings({ tremulant })} />
            <Tab label="Percussion" on={percussion.on} onToggle={(on) => setPercussion({ on })} />
            <Tab
              label="Harmonic"
              on={percussion.harmonic === 3}
              states={['2nd', '3rd']}
              onToggle={(third) => setPercussion({ harmonic: third ? 3 : 2 })}
            />
            <Tab
              label="Decay"
              on={percussion.decay === 'slow'}
              states={['Fast', 'Slow']}
              onToggle={(slow) => setPercussion({ decay: slow ? 'slow' : 'fast' })}
            />
            <Tab label="Key click" on={organ.settings.keyClick} onToggle={(keyClick) => organ.updateSettings({ keyClick })} />
          </div>
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
          <CopyLink />
        </div>
      </section>
      <div className="fallboard" aria-hidden="true" />
      <Keyboard
        low={MANUAL_LOW}
        high={MANUAL_HIGH}
        activeNotes={organ.activeNotes}
        octave={qwerty.octave}
        onNoteOn={player.noteOn}
        onNoteOff={player.noteOff}
      />
      <section className="recorder" aria-label="Recorder">
        <Transport sequencer={sequencer} />
      </section>
      <p className="hint">
        Click or drag across the keys, or play the Z and Q rows on your keyboard, or connect a MIDI keyboard. Pull the
        drawbars down to add harmonics. <kbd>,</kbd> and <kbd>.</kbd> shift the rows an octave
        {qwerty.octave !== 0 && (
          <>
            {' '}
            (now <strong>{qwerty.octave > 0 ? `+${qwerty.octave}` : qwerty.octave}</strong>)
          </>
        )}
        .
      </p>
    </main>
  )
}
