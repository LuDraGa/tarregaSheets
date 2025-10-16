import { PlayerState } from '@/lib/player'

interface TransportProps {
  state: PlayerState
  onPlay: () => void
  onPause: () => void
  onStop: () => void
  onSeek: (time: number) => void
  disabled?: boolean
}

export default function Transport({ state, onPlay, onPause, onStop, onSeek, disabled = false }: TransportProps) {
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleSeekbarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) {
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = x / rect.width
    const newTime = percentage * state.duration
    onSeek(newTime)
  }

  const progress = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0

  return (
    <div className="bg-white rounded-lg shadow p-4">
      {/* Time Display */}
      <div className="flex justify-between text-sm text-gray-600 mb-2">
        <span>{formatTime(state.currentTime)}</span>
        <span>{formatTime(state.duration)}</span>
      </div>

      {/* Seek Bar */}
      <div
        onClick={handleSeekbarClick}
        className={`w-full h-2 bg-gray-200 rounded-full mb-4 relative ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
      >
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{ width: `${progress}%` }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-primary rounded-full shadow-md"
          style={{ left: `${progress}%`, transform: 'translate(-50%, -50%)' }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        {/* Stop Button */}
        <button
          onClick={onStop}
          disabled={disabled}
          className="p-2 text-gray-600 hover:text-gray-900 transition disabled:opacity-50 disabled:cursor-not-allowed"
          title="Stop"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="1" />
          </svg>
        </button>

        {/* Play/Pause Button */}
        <button
          onClick={state.isPlaying ? onPause : onPlay}
          disabled={disabled}
          className="p-4 bg-primary text-white rounded-full hover:bg-primary-dark transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary"
          title={disabled ? 'Loading audio...' : (state.isPlaying ? 'Pause' : 'Play')}
        >
          {state.isPlaying ? (
            // Pause Icon
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
              <rect x="7" y="5" width="3" height="14" rx="1" />
              <rect x="14" y="5" width="3" height="14" rx="1" />
            </svg>
          ) : (
            // Play Icon
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
