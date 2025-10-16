interface TempoControlProps {
  tempo: number
  originalTempo: number
  onTempoChange: (tempo: number) => void
  metronomeEnabled: boolean
  onMetronomeToggle: (enabled: boolean) => void
}

export default function TempoControl({
  tempo,
  originalTempo,
  onTempoChange,
  metronomeEnabled,
  onMetronomeToggle,
}: TempoControlProps) {
  const minTempo = Math.max(30, Math.floor(originalTempo * 0.5))
  const maxTempo = Math.max(300, Math.ceil(originalTempo * 3))
  const percentage = ((tempo - minTempo) / (maxTempo - minTempo)) * 100

  const handleReset = () => {
    onTempoChange(originalTempo)
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Tempo Control</h3>
        <div className="flex items-center gap-3">
          {/* Metronome Toggle */}
          <button
            onClick={() => onMetronomeToggle(!metronomeEnabled)}
            className={`p-2 rounded-md transition ${
              metronomeEnabled
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title={metronomeEnabled ? 'Metronome On' : 'Metronome Off'}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tempo Display */}
      <div className="text-center mb-3">
        <div className="text-3xl font-bold text-gray-900">{tempo}</div>
        <div className="text-sm text-gray-500">BPM</div>
      </div>

      {/* Tempo Slider */}
      <div className="mb-3">
        <input
          type="range"
          min={minTempo}
          max={maxTempo}
          value={tempo}
          onChange={(e) => onTempoChange(Number(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
          style={{
            background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${percentage}%, #E5E7EB ${percentage}%, #E5E7EB 100%)`,
          }}
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{minTempo}</span>
          <span>{originalTempo}</span>
          <span>{maxTempo}</span>
        </div>
      </div>

      {/* Preset Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => onTempoChange(Math.floor(originalTempo * 0.5))}
          className="flex-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200 transition"
        >
          50%
        </button>
        <button
          onClick={() => onTempoChange(Math.floor(originalTempo * 0.75))}
          className="flex-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200 transition"
        >
          75%
        </button>
        <button
          onClick={handleReset}
          className="flex-1 px-3 py-1.5 bg-primary text-white rounded text-sm hover:bg-primary-dark transition"
        >
          100%
        </button>
        <button
          onClick={() => onTempoChange(Math.ceil(originalTempo * 1.25))}
          className="flex-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200 transition"
        >
          125%
        </button>
      </div>
    </div>
  )
}
