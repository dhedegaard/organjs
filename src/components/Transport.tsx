import type { SequencerController } from '../hooks/useSequencer'
import { RATE_MAX, RATE_MIN } from '../sequence/player'
import { formatSeconds } from '../sequence/time'

/** Record and playback controls for the sequencer. */
export function Transport({ sequencer }: { readonly sequencer: SequencerController }) {
  const { recording, recordingSeconds, sequence, playback } = sequencer
  const empty = sequence.notes.length === 0 && sequence.controls.length === 0
  const playing = playback.state === 'playing'
  const toggleRecording = () => (recording ? sequencer.stopRecording() : sequencer.startRecording())
  const status = recording
    ? formatSeconds(recordingSeconds)
    : `${formatSeconds(playback.position)} / ${formatSeconds(playback.duration)}`
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
      <button
        type="button"
        className="transport__button"
        disabled={empty}
        onClick={() => (playing ? playback.pause() : playback.play())}
      >
        {playing ? 'Pause' : 'Play'}
      </button>
      <button type="button" className="transport__button" disabled={playback.state === 'stopped'} onClick={playback.stop}>
        Stop
      </button>
      <button
        type="button"
        className={`transport__button${playback.loop ? ' transport__button--on' : ''}`}
        aria-pressed={playback.loop}
        onClick={() => playback.setLoop(!playback.loop)}
      >
        Loop
      </button>
      <label className="transport__rate">
        <span>Tempo {playback.rate.toFixed(2)}×</span>
        <input
          type="range"
          min={RATE_MIN}
          max={RATE_MAX}
          step={0.05}
          value={playback.rate}
          onChange={(e) => playback.setRate(Number(e.target.value))}
        />
      </label>
      <span className="transport__time" role="timer" aria-live="off">
        {status}
      </span>
      <span className="transport__count">{sequence.notes.length} notes</span>
    </div>
  )
}
