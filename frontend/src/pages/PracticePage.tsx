import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { piecesApi } from '@/services/api'
import { OSMDRenderer } from '@/lib/osmd'
import { MusicPlayer, PlayerState } from '@/lib/player'
import SheetViewer from '@/components/Practice/SheetViewer'
import Transport from '@/components/Practice/Transport'
import TempoControl from '@/components/Practice/TempoControl'

export default function PracticePage() {
  const { id } = useParams<{ id: string }>()
  const [osmdRenderer, setOsmdRenderer] = useState<OSMDRenderer | null>(null)
  const playerRef = useRef<MusicPlayer | null>(null)
  const [playerState, setPlayerState] = useState<PlayerState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    tempo: 120,
  })
  const [originalTempo, setOriginalTempo] = useState(120)
  const [metronomeEnabled, setMetronomeEnabled] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch piece
  const { data: piece, isLoading, error: fetchError } = useQuery({
    queryKey: ['piece', id],
    queryFn: () => piecesApi.get(id!),
    enabled: !!id,
  })

  // Get first version for playback
  const version = piece?.versions?.[0]
  const musicXmlAsset = version?.assets?.find((a) => a.kind === 'musicxml')
  const midiAsset = version?.assets?.find((a) => a.kind === 'midi')

  useEffect(() => {
    // Initialize player
    if (!playerRef.current) {
      const player = new MusicPlayer()
      playerRef.current = player

      // Set up callbacks
      player.setOnTimeUpdate((state) => {
        setPlayerState(state)

        // Sync cursor with playback
        if (osmdRenderer && state.isPlaying) {
          // Simple cursor sync - move cursor on beat
          // In production, you'd want more precise timing
          osmdRenderer.cursorNext()
        }
      })

      player.setOnPlaybackEnd(() => {
        if (osmdRenderer) {
          osmdRenderer.resetCursor()
        }
      })
    }

    // Load MIDI for Tone.js playback
    if (midiAsset && playerRef.current) {
      const fullUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${midiAsset.url}`
      playerRef.current.loadMIDI(fullUrl).catch((err) => {
        console.error('Failed to load MIDI:', err)
        setError('Failed to load audio playback.')
      })
    }

    // Set original tempo from version metadata
    if (version?.tempo) {
      setOriginalTempo(version.tempo)
      if (playerRef.current) {
        playerRef.current.setTempo(version.tempo)
      }
    }

    // Cleanup
    return () => {
      if (playerRef.current) {
        playerRef.current.destroy()
        playerRef.current = null
      }
    }
  }, [version, musicXmlAsset, osmdRenderer])

  const handleOSMDLoad = useCallback((renderer: OSMDRenderer) => {
    setOsmdRenderer(renderer)
    setError(null)
  }, [])

  const handleOSMDError = useCallback((err: Error) => {
    setError(err.message)
  }, [])

  const handlePlay = () => {
    if (playerRef.current) {
      playerRef.current.play()
    }
  }

  const handlePause = () => {
    if (playerRef.current) {
      playerRef.current.pause()
    }
  }

  const handleStop = () => {
    if (playerRef.current) {
      playerRef.current.stop()
      if (osmdRenderer) {
        osmdRenderer.resetCursor()
      }
    }
  }

  const handleSeek = (time: number) => {
    if (playerRef.current) {
      playerRef.current.seek(time)
    }
  }

  const handleTempoChange = (tempo: number) => {
    if (playerRef.current) {
      playerRef.current.setTempo(tempo)
      setPlayerState((prev) => ({ ...prev, tempo }))
    }
  }

  const handleMetronomeToggle = (enabled: boolean) => {
    setMetronomeEnabled(enabled)
    if (playerRef.current) {
      playerRef.current.toggleMetronome(enabled)
    }
  }

  if (!id) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-700">Invalid piece ID</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  if (fetchError || !piece) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-700">Piece not found</p>
          <Link to="/library" className="text-primary hover:underline mt-2 inline-block">
            Back to Library
          </Link>
        </div>
      </div>
    )
  }

  if (!version || !musicXmlAsset) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <p className="text-yellow-700">No sheet music available for this piece</p>
          <Link to="/library" className="text-primary hover:underline mt-2 inline-block">
            Back to Library
          </Link>
        </div>
      </div>
    )
  }

  const fullMusicXmlUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${musicXmlAsset.url}`

  return (
    <div className="px-4 py-6 sm:px-0">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link
              to="/library"
              className="text-gray-600 hover:text-gray-900 transition"
              title="Back to Library"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h2 className="text-3xl font-bold text-gray-900">{piece.title}</h2>
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
              Tone.js
            </span>
            <Link
              to={`/practice/${id}/alphatab`}
              className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium hover:bg-gray-200 transition"
              title="Switch to alphaTab renderer"
            >
              Try alphaTab
            </Link>
          </div>
          {piece.composer && (
            <p className="text-lg text-gray-600 ml-9">{piece.composer}</p>
          )}
        </div>

        {/* Metadata badges */}
        <div className="flex gap-2">
          {version.key && (
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
              {version.key}
            </span>
          )}
          {version.time_signature && (
            <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
              {version.time_signature}
            </span>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-700">⚠️ {error}</p>
        </div>
      )}

      {/* Playback Controls - Sticky at top */}
      <div className="sticky top-0 z-10 bg-gray-50 pb-4 mb-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Transport Controls */}
          <div className="lg:col-span-2">
            <Transport
              state={playerState}
              onPlay={handlePlay}
              onPause={handlePause}
              onStop={handleStop}
              onSeek={handleSeek}
            />
          </div>

          {/* Tempo Control */}
          <div>
            <TempoControl
              tempo={playerState.tempo}
              originalTempo={originalTempo}
              onTempoChange={handleTempoChange}
              metronomeEnabled={metronomeEnabled}
              onMetronomeToggle={handleMetronomeToggle}
            />
          </div>
        </div>
      </div>

      {/* Sheet Music Viewer */}
      <div className="mb-6">
        <SheetViewer
          musicXmlUrl={fullMusicXmlUrl}
          onLoad={handleOSMDLoad}
          onError={handleOSMDError}
        />
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-700">
          💡 <strong>Tip:</strong> Use the tempo slider to slow down difficult sections. The metronome helps you stay in time.
        </p>
        <p className="text-sm text-blue-600 mt-2">
          🎵 <strong>Sound:</strong> Using Tone.js with sampled instruments. For better guitar sound, try the{' '}
          <Link to={`/practice/${id}/alphatab`} className="underline font-medium">
            alphaTab version
          </Link>{' '}
          which uses SoundFont-based synthesis.
        </p>
      </div>
    </div>
  )
}
