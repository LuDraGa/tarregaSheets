import type { ChangeEvent } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlphaTabRenderer, AlphaTabPlayerState, type AlphaTabMeasureBounds } from '@/lib/alphatab-renderer'
import { MIDI_INSTRUMENTS } from '@/lib/midi-instruments'

interface AlphaTabPreviewProps {
  musicXmlUrl: string
  height?: number
  collapsed?: boolean
  onToggleExpand?: () => void
  onPlaybackState?: (state: AlphaTabPlayerState) => void
  onMeasureChange?: (index: number) => void
}

export default function AlphaTabPreview({
  musicXmlUrl,
  height = 260,
  collapsed = false,
  onToggleExpand,
  onPlaybackState,
  onMeasureChange,
}: AlphaTabPreviewProps) {
  const scrollWrapperRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<AlphaTabRenderer | null>(null)
  const [playerState, setPlayerState] = useState<AlphaTabPlayerState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    tempo: 120,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [loadingMessage, setLoadingMessage] = useState<string>('Initializing alphaTab…')
  const [error, setError] = useState<string | null>(null)
  const [isPlayerReady, setIsPlayerReady] = useState(false)
  const [soundFontProgress, setSoundFontProgress] = useState<number | null>(null)
  const [selectedInstrument, setSelectedInstrument] = useState<number>(24) // Acoustic Guitar (nylon)
  const [isMidiRegenerating, setIsMidiRegenerating] = useState(false)
  const [measureBounds, setMeasureBounds] = useState<AlphaTabMeasureBounds[]>([])
  const [activeMeasureIndex, setActiveMeasureIndex] = useState<number>(-1)
  const [activeBounds, setActiveBounds] = useState<AlphaTabMeasureBounds | null>(null)

  const updateMeasureBounds = useCallback(() => {
    const renderer = rendererRef.current
    if (!renderer) return
    const bounds = renderer.getMeasureBounds()
    if (!bounds.length) {
      setMeasureBounds([])
      return
    }

    const unique = new Map<number, AlphaTabMeasureBounds>()
    bounds.forEach((bound) => {
      if (!unique.has(bound.index)) {
        unique.set(bound.index, bound)
      }
    })

    const sorted = Array.from(unique.values()).sort((a, b) => a.index - b.index)
    setMeasureBounds(sorted)
  }, [])

  const formatTime = useCallback((seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) {
      return '0:00'
    }
    const wholeSeconds = Math.floor(seconds)
    const mins = Math.floor(wholeSeconds / 60)
    const secs = wholeSeconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }, [])

  const handleSliderChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value)
    if (!Number.isFinite(value)) {
      return
    }
    rendererRef.current?.seek(value)
  }

  useEffect(() => {
    let isMounted = true
    const containerEl = containerRef.current
    if (!containerEl) return

    // Initialize with tab-only mode to show guitar tablature (fret numbers on strings)
    const renderer = new AlphaTabRenderer(containerEl, 'tab-only')
    rendererRef.current = renderer

    renderer.setOnTimeUpdate((state) => {
      if (!isMounted) {
        return
      }
      setPlayerState(state)
      onPlaybackState?.(state)
    })
    renderer.setOnLoad(() => {
      if (!isMounted) {
        return
      }
      setIsLoading(false)
      setLoadingMessage('')
      const state = renderer.getState()
      setPlayerState(state)
    })
    renderer.setOnPlayerReady(() => {
      if (!isMounted) {
        return
      }
      setIsPlayerReady(true)
      setLoadingMessage('')
    })
    renderer.setOnSoundFontProgress((progress) => {
      if (!isMounted) {
        return
      }
      setSoundFontProgress(progress)
      if (progress < 100) {
        setLoadingMessage(`Loading SoundFont… ${progress}%`)
      } else {
        setLoadingMessage('')
      }
    })
    renderer.setOnError((err) => {
      console.error('AlphaTab preview error:', err)
      if (!isMounted) {
        return
      }
      setError(err.message || 'Failed to load tablature preview')
      setIsLoading(false)
    })
    renderer.setOnMidiRegenerated(() => {
      if (!isMounted) {
        return
      }
      setIsMidiRegenerating(false)
      setPlayerState(renderer.getState())
    })
    renderer.setOnMeasureChange((index) => {
      if (!isMounted) {
        return
      }
      setActiveMeasureIndex(index)
      onMeasureChange?.(index)
    })
    renderer.setOnRenderFinished(() => {
      if (!isMounted) {
        return
      }
      window.requestAnimationFrame(() => {
        if (!isMounted) return
        updateMeasureBounds()
      })
    })

    renderer
      .loadMusicXML(musicXmlUrl)
      .catch((err) => {
        console.error('Failed to load MusicXML for alphaTab preview:', err)
        if (!isMounted) {
          return
        }
        setError('Could not load tablature preview')
        setIsLoading(false)
      })

    return () => {
      isMounted = false
      rendererRef.current?.destroy()
      rendererRef.current = null
    }
  }, [musicXmlUrl, onMeasureChange, updateMeasureBounds])

  useEffect(() => {
    const handleResize = () => updateMeasureBounds()
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [updateMeasureBounds])

  useEffect(() => {
    if (!collapsed) {
      updateMeasureBounds()
    }
  }, [collapsed, updateMeasureBounds])

  const handlePlay = () => {
    rendererRef.current?.play()
  }

  const handlePause = () => {
    rendererRef.current?.pause()
  }

  const handleStop = () => {
    rendererRef.current?.stop()
  }

  const handleInstrumentChange = (program: number) => {
    setSelectedInstrument(program)
    setIsMidiRegenerating(true)
    rendererRef.current?.setInstrument(program)
  }

  const playbackLabel = useMemo(() => {
    if (!playerState.duration) return 'Ready'
    const current = Math.min(playerState.currentTime, playerState.duration)
    return `${current.toFixed(1)}s / ${playerState.duration.toFixed(1)}s`
  }, [playerState.currentTime, playerState.duration])

  const sliderMax = playerState.duration > 0 ? playerState.duration : 1
  const sliderValue = Math.min(playerState.currentTime, sliderMax)

  const measureSummary = useMemo(() => {
    if (activeMeasureIndex < 0) {
      return 'Bar –'
    }
    const total = measureBounds.length
    return total > 0 ? `Bar ${activeMeasureIndex + 1} / ${total}` : `Bar ${activeMeasureIndex + 1}`
  }, [activeMeasureIndex, measureBounds.length])

  useEffect(() => {
    if (activeMeasureIndex < 0) {
      setActiveBounds(null)
      return
    }
    const bounds = measureBounds.find((b) => b.index === activeMeasureIndex)
    if (!bounds) return

    setActiveBounds(bounds)

    if (!collapsed) return
    const wrapper = scrollWrapperRef.current
    if (!wrapper) return

    const targetLeft = Math.max(bounds.x - 16, 0)
    const targetTop = Math.max(bounds.y - 16, 0)

    if (Math.abs(wrapper.scrollLeft - targetLeft) > 2) {
      wrapper.scrollLeft = targetLeft
    }
    if (Math.abs(wrapper.scrollTop - targetTop) > 2) {
      wrapper.scrollTop = targetTop
    }
  }, [activeMeasureIndex, measureBounds, collapsed])

  return (
    <div className="space-y-3">
      <div
        className={`relative rounded-lg border border-gray-200 bg-white ${
          collapsed ? 'cursor-pointer overflow-hidden' : 'overflow-hidden'
        }`}
        style={{ minHeight: `${height}px`, maxHeight: collapsed ? `${height}px` : undefined }}
        onClick={() => {
          if (collapsed && onToggleExpand) {
            onToggleExpand()
          }
        }}
      >
        <div
          ref={scrollWrapperRef}
          className={`relative h-full w-full ${collapsed ? 'overflow-hidden' : 'overflow-auto'}`}
          style={{ maxHeight: collapsed ? `${height}px` : undefined }}
        >
          {activeBounds && (
            <div
              className="pointer-events-none absolute rounded-md border-2 border-primary/60 bg-primary/10 transition-all duration-150"
              style={{
                left: `${activeBounds.x}px`,
                top: `${activeBounds.y}px`,
                width: `${activeBounds.width}px`,
                height: `${activeBounds.height}px`,
              }}
            />
          )}
          <div
            ref={containerRef}
            className="w-full"
            style={{ minHeight: `${height}px` }}
          />
        </div>

        {isLoading && (
          <div className="flex h-full items-center justify-center p-6 text-sm text-gray-600">
            <div className="flex flex-col items-center gap-2">
              <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
              <span>{loadingMessage || 'Loading tablature preview…'}</span>
            </div>
          </div>
        )}
        {error && (
          <div className="flex h-full items-center justify-center p-6 text-sm text-red-600">
            ❌ {error}
          </div>
        )}

        {collapsed && !isLoading && !error && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white to-transparent" />
        )}
        {collapsed && (
          <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-4">
            <div className="rounded-full bg-black/60 px-4 py-1 text-xs font-medium text-white">
              Click to view full tablature
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold text-gray-600 tabular-nums">
          {formatTime(playerState.currentTime)}
        </span>
        <input
          type="range"
          min={0}
          step="0.01"
          max={sliderMax}
          value={Number.isFinite(sliderValue) ? sliderValue : 0}
          onChange={handleSliderChange}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-primary"
          disabled={!rendererRef.current || playerState.duration <= 0}
        />
        <span className="text-xs font-semibold text-gray-600 tabular-nums">
          {formatTime(playerState.duration)}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
        <span className="font-medium">{playbackLabel}</span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
          {measureSummary}
        </span>
        {!isPlayerReady && (
          <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800">
            Initializing player…
          </span>
        )}
        {soundFontProgress !== null && soundFontProgress < 100 && (
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
            SoundFont {soundFontProgress}%
          </span>
        )}
        {isMidiRegenerating && (
          <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-800">
            Updating instrument…
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handlePlay}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
          disabled={!rendererRef.current}
        >
          ▶️ Play
        </button>
        <button
          type="button"
          onClick={handlePause}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          disabled={!rendererRef.current}
        >
          ⏸️ Pause
        </button>
        <button
          type="button"
          onClick={handleStop}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          disabled={!rendererRef.current}
        >
          ⏹️ Stop
        </button>
        <div className="ml-2 flex items-center gap-2">
          <label htmlFor="alphatab-instrument" className="text-sm font-medium text-gray-700">
            Instrument
          </label>
          <select
            id="alphatab-instrument"
            value={selectedInstrument}
            onChange={(event) => handleInstrumentChange(parseInt(event.target.value, 10))}
            disabled={!rendererRef.current}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {MIDI_INSTRUMENTS.map((instrument) => (
              <option key={instrument.program} value={instrument.program}>
                {instrument.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
