import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { piecesApi } from '@/services/api'
import { AlphaTabRenderer, AlphaTabPlayerState } from '@/lib/alphatab-renderer'
import Transport from '@/components/Practice/Transport'
import TempoControl from '@/components/Practice/TempoControl'
import InstrumentSelector from '@/components/Practice/InstrumentSelector'

export default function PracticePageAlphaTab() {
  const { id } = useParams<{ id: string }>()
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<AlphaTabRenderer | null>(null)
  const [playerState, setPlayerState] = useState<AlphaTabPlayerState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    tempo: 120,
  })
  const [originalTempo, setOriginalTempo] = useState(120)
  const [metronomeEnabled, setMetronomeEnabled] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPlayerReady, setIsPlayerReady] = useState(false)
  const [soundFontProgress, setSoundFontProgress] = useState(0)
  const [selectedInstrument, setSelectedInstrument] = useState(24) // Default: Acoustic Guitar (nylon)
  const [isMidiRegenerating, setIsMidiRegenerating] = useState(false)

  // Fetch piece
  const { data: piece, isLoading: isFetchingPiece, error: fetchError } = useQuery({
    queryKey: ['piece', id],
    queryFn: () => piecesApi.get(id!),
    enabled: !!id,
  })

  // Get first version for playback
  const version = piece?.versions?.[0]
  const musicXmlAsset = version?.assets?.find((a) => a.kind === 'musicxml')

  useEffect(() => {
    if (!containerRef.current || !musicXmlAsset) return

    if (rendererRef.current) {
      console.log('⚠️ Renderer already initialized, skipping')
      return
    }

    console.log('🎵 Initializing alphaTab renderer')

    // Initialize alphaTab renderer
    const renderer = new AlphaTabRenderer(containerRef.current)
    rendererRef.current = renderer

    // Set up callbacks
    renderer.setOnTimeUpdate((state) => {
      setPlayerState(state)
    })

    renderer.setOnPlaybackEnd(() => {
      console.log('Playback ended')
    })

    renderer.setOnLoad(() => {
      console.log('Score loaded successfully')
      setIsLoading(false)
      setError(null)

      // Use database tempo as the authoritative source, not the file's tempo
      if (version?.tempo) {
        console.log(`Using database tempo: ${version.tempo} BPM (file had ${renderer.getState().tempo} BPM)`)
        setOriginalTempo(version.tempo)
        renderer.setTempo(version.tempo)
      } else {
        // Fallback to file tempo if database doesn't have one
        const state = renderer.getState()
        setOriginalTempo(state.tempo)
      }
    })

    renderer.setOnError((err) => {
      console.error('alphaTab error:', err)
      setError(err.message)
      setIsLoading(false)
      setIsMidiRegenerating(false)
    })

    renderer.setOnSoundFontProgress((progress) => {
      setSoundFontProgress(progress)
    })

    renderer.setOnPlayerReady(() => {
      console.log('Player ready!')
      setIsPlayerReady(true)
    })

    renderer.setOnMidiRegenerated(() => {
      console.log('✅ Instrument change complete!')
      setIsMidiRegenerating(false)
      setPlayerState(renderer.getState())
    })

    // Load MusicXML
    const fullMusicXmlUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${musicXmlAsset.url}`
    renderer.loadMusicXML(fullMusicXmlUrl).catch((err) => {
      console.error('Failed to load MusicXML:', err)
      setError('Failed to load music notation')
      setIsLoading(false)
    })

    // Cleanup
    return () => {
      if (rendererRef.current) {
        console.log('🧹 Cleaning up alphaTab renderer')
        rendererRef.current.destroy()
        rendererRef.current = null
      }
    }
  }, [musicXmlAsset, version?.tempo])

  const handlePlay = () => {
    console.log('🎮 handlePlay called', {
      hasRenderer: !!rendererRef.current,
      isPlayerReady,
      playerState,
    })

    if (!rendererRef.current) {
      console.error('❌ No renderer available')
      return
    }

    rendererRef.current.play()
  }

  const handlePause = () => {
    if (rendererRef.current) {
      rendererRef.current.pause()
    }
  }

  const handleStop = () => {
    if (rendererRef.current) {
      rendererRef.current.stop()
    }
  }

  const handleSeek = (time: number) => {
    if (rendererRef.current) {
      rendererRef.current.seek(time)
    }
  }

  const handleTempoChange = (tempo: number) => {
    if (rendererRef.current) {
      rendererRef.current.setTempo(tempo)
      setPlayerState((prev) => ({ ...prev, tempo }))
    }
  }

  const handleMetronomeToggle = (enabled: boolean) => {
    setMetronomeEnabled(enabled)
    if (rendererRef.current) {
      rendererRef.current.toggleMetronome(enabled)
    }
  }

  const handleInstrumentChange = (program: number) => {
    setSelectedInstrument(program)
    if (rendererRef.current) {
      setIsMidiRegenerating(true)
      rendererRef.current.setInstrument(program)
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

  if (isFetchingPiece) {
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
            <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
              alphaTab
            </span>
            <Link
              to={`/practice/${id}`}
              className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium hover:bg-gray-200 transition"
              title="Switch to Tone.js + OSMD"
            >
              Try Tone.js
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

      {/* Loading indicator */}
      {isLoading && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-700">Loading sheet music...</p>
        </div>
      )}

      {/* SoundFont loading progress */}
      {!isPlayerReady && !isLoading && soundFontProgress < 100 && (
        <div className="mb-6 bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-sm text-purple-700 mb-2">
                🎵 Loading audio SoundFont... {soundFontProgress}%
              </p>
              <div className="w-full bg-purple-200 rounded-full h-2">
                <div
                  className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${soundFontProgress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Instrument change loading indicator */}
      {isMidiRegenerating && (
        <div className="mb-6 bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>
            <p className="text-sm text-purple-700">🎸 Changing instrument and regenerating audio...</p>
          </div>
        </div>
      )}

      {/* Playback Controls - Sticky at top */}
      <div className="sticky top-0 z-10 bg-gray-50 pb-4 mb-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          {/* Transport Controls */}
          <div className="lg:col-span-2">
            <Transport
              state={playerState}
              onPlay={handlePlay}
              onPause={handlePause}
              onStop={handleStop}
              onSeek={handleSeek}
              disabled={!isPlayerReady || isMidiRegenerating}
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

        {/* Instrument Selector */}
        <div className="lg:w-1/3">
          <InstrumentSelector
            selectedInstrument={selectedInstrument}
            onInstrumentChange={handleInstrumentChange}
            disabled={!isPlayerReady || isMidiRegenerating}
          />
        </div>
      </div>

      {/* alphaTab Container (renders sheet music here) */}
      <div className="mb-6 bg-white border border-gray-200 rounded-lg shadow-sm overflow-auto">
        <div ref={containerRef} className="p-4 min-h-[600px]" />
      </div>

      {/* Info Card */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <p className="text-sm text-purple-700">
          💡 <strong>alphaTab Mode:</strong> Using alphaTab for both rendering and audio playback with built-in SoundFont synthesis.
        </p>
        <p className="text-sm text-purple-600 mt-2">
          🎸 <strong>Sound Quality:</strong> alphaTab uses SoundFont-based audio which provides more realistic classical guitar sound compared to synthesizers.
        </p>
      </div>
    </div>
  )
}
