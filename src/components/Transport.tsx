import type { SequencerController } from '../hooks/useSequencer'
import { formatSeconds } from '../sequence/time'

/** Record control and status for the sequencer. */
export function Transport({ sequencer }: { readonly sequencer: SequencerController }) {
  const { recording, recordingSeconds, sequence } = sequencer
  const toggleRecording = () => (recording ? sequencer.stopRecording() : sequencer.startRecording())
  return (
    <div className="transport">
      <button
        type="button"
        className={`transport__button transport__button--record${recording ? ' transport__button--active' : ''}`}
        aria-pressed={recording}
        onClick={toggleRecording}
      >
        <span className="transport__dot" aria-hidden="true" />
        {recording ? 'Stop recording' : 'Record'}
      </button>
      <span className="transport__time" role="timer" aria-live="off">
        {recording ? formatSeconds(recordingSeconds) : `${sequence.notes.length} notes`}
      </span>
    </div>
  )
}
