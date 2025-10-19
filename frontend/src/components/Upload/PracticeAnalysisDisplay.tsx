import { useEffect, useState, useRef, useMemo } from 'react'
import { AlphaTabApi, Settings } from '@coderline/alphatab'

interface NotePosition {
  string: number
  fret: number
}

interface NoteData {
  noteName: string
  midiPitch: number
  time: number
  duration: number
  positions: NotePosition[]
  instrument: string
}

interface PracticeAnalysisDisplayProps {
  musicXmlUrl: string
}

// Standard guitar tuning (EADGBE) - MIDI pitches for open strings
const STANDARD_TUNING = [64, 59, 55, 50, 45, 40]

function calculateGuitarPositions(midiPitch: number, maxFret: number = 24): NotePosition[] {
  const positions: NotePosition[] = []
  STANDARD_TUNING.forEach((openStringPitch, stringIndex) => {
    const fret = midiPitch - openStringPitch
    if (fret >= 0 && fret <= maxFret) {
      positions.push({ string: stringIndex + 1, fret })
    }
  })
  return positions
}

function midiPitchToNoteName(midiPitch: number): string {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const octave = Math.floor(midiPitch / 12) - 1
  const noteIndex = midiPitch % 12
  return `${noteNames[noteIndex]}${octave}`
}

export default function PracticeAnalysisDisplay({ musicXmlUrl }: PracticeAnalysisDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<AlphaTabApi | null>(null)
  const [notes, setNotes] = useState<NoteData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  const [showAllNotes, setShowAllNotes] = useState(false)
  const [chordsExpanded, setChordsExpanded] = useState(false)
  const [scalesExpanded, setScalesExpanded] = useState(false)
  const [progressionsExpanded, setProgressionsExpanded] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) {
      console.log('🎵 PracticeAnalysisDisplay: Waiting for component to mount...')
      return
    }

    const containerEl = containerRef.current
    if (!containerEl) {
      console.error('❌ PracticeAnalysisDisplay: containerRef is null even after mount')
      setError('Failed to initialize practice analysis')
      setIsLoading(false)
      return
    }

    console.log('🎵 PracticeAnalysisDisplay: Initializing alphaTab for note extraction')

    const settings = new Settings()
    settings.core.enableLazyLoading = false
    settings.core.useWorkers = false
    settings.core.fontDirectory = '/font/'
    settings.player.enablePlayer = false

    const api = new AlphaTabApi(containerEl, settings)
    apiRef.current = api

    console.log('🎵 PracticeAnalysisDisplay: alphaTab API created, setting up event listeners')

    api.scoreLoaded.on((score) => {
      console.log('📊 PracticeAnalysisDisplay: scoreLoaded event fired! Score:', score.title)

      const extractedNotes: NoteData[] = []

      score.tracks.forEach((track) => {
        track.staves.forEach((staff) => {
          staff.bars.forEach((bar) => {
            bar.voices.forEach((voice) => {
              voice.beats.forEach((beat) => {
                const beatTimeMs = beat.playbackStart

                beat.notes.forEach((note) => {
                  const midiPitch = note.realValue
                  const noteName = midiPitchToNoteName(midiPitch)
                  const positions = calculateGuitarPositions(midiPitch)

                  extractedNotes.push({
                    noteName,
                    midiPitch,
                    time: beatTimeMs / 1000,
                    duration: beat.playbackDuration / 1000,
                    positions,
                    instrument: 'guitar',
                  })
                })
              })
            })
          })
        })
      })

      extractedNotes.sort((a, b) => a.time - b.time)

      console.log(`📊 Extracted ${extractedNotes.length} notes`)
      setNotes(extractedNotes)
      setIsLoading(false)
    })

    api.renderFinished.on(() => {
      console.log('🎨 PracticeAnalysisDisplay: renderFinished event fired')
    })

    api.error.on((err) => {
      console.error('❌ PracticeAnalysisDisplay: alphaTab error event:', err)
      setError(err.message || 'Failed to analyze music')
      setIsLoading(false)
    })

    console.log('🎵 PracticeAnalysisDisplay: Fetching MusicXML from:', musicXmlUrl)
    fetch(musicXmlUrl)
      .then((res) => {
        console.log('🎵 PracticeAnalysisDisplay: MusicXML fetch response received, status:', res.status)
        return res.arrayBuffer()
      })
      .then((buffer) => {
        console.log('🎵 PracticeAnalysisDisplay: MusicXML buffer loaded, size:', buffer.byteLength, 'bytes')
        console.log('🎵 PracticeAnalysisDisplay: Calling api.load()...')
        api.load(buffer)
        console.log('🎵 PracticeAnalysisDisplay: api.load() called, waiting for scoreLoaded event...')
      })
      .catch((err) => {
        console.error('❌ PracticeAnalysisDisplay: Failed to fetch MusicXML:', err)
        setError('Failed to load MusicXML file')
        setIsLoading(false)
      })

    return () => {
      console.log('🧹 PracticeAnalysisDisplay: Cleaning up alphaTab')
      api.destroy()
      apiRef.current = null
    }
  }, [mounted, musicXmlUrl])

  // Calculate note frequency
  const noteFrequency = useMemo(() => {
    const freq = new Map<string, number>()
    notes.forEach((note) => {
      freq.set(note.noteName, (freq.get(note.noteName) || 0) + 1)
    })

    const total = notes.length
    return Array.from(freq.entries())
      .map(([note, count]) => ({
        note,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
  }, [notes])

  const displayedNotes = showAllNotes ? noteFrequency : noteFrequency.slice(0, 10)
  const maxCount = noteFrequency[0]?.count || 1

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div ref={containerRef} className="absolute -left-[9999px] h-[100px] w-[100px]" />
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center gap-3 text-gray-600">
            <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-primary" />
            <span className="text-sm">Analyzing practice patterns...</span>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div ref={containerRef} className="absolute -left-[9999px] h-[100px] w-[100px]" />
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <p className="text-sm text-red-700">❌ {error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div ref={containerRef} className="absolute -left-[9999px] h-[100px] w-[100px]" />

      {/* Practice Analysis Sections */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
          <h4 className="text-sm font-semibold text-gray-900">
            🎵 Practice Analysis
          </h4>
          <p className="text-xs text-gray-600 mt-1">
            Analyzed {notes.length} notes • {noteFrequency.length} unique pitches
          </p>
        </div>

        <div className="divide-y divide-gray-200">
          {/* Section 1: Note Frequency */}
          <div className="p-4">
            <button
              onClick={() => setShowAllNotes(!showAllNotes)}
              className="flex w-full items-center justify-between text-left"
            >
              <h5 className="text-sm font-semibold text-gray-900">
                ▼ Note Frequency ({noteFrequency.length} unique notes)
              </h5>
              <span className="text-xs text-gray-500">
                {showAllNotes ? 'Show less' : 'Show all'}
              </span>
            </button>

            <div className="mt-3 space-y-2">
              {displayedNotes.map(({ note, count, percentage }) => (
                <div key={note} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-gray-700">{note}</span>
                    <span className="text-gray-600">
                      {count} times ({percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${(count / maxCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}

              {!showAllNotes && noteFrequency.length > 10 && (
                <button
                  onClick={() => setShowAllNotes(true)}
                  className="mt-2 text-xs text-primary hover:underline"
                >
                  + Show {noteFrequency.length - 10} more notes
                </button>
              )}
            </div>
          </div>

          {/* Section 2: Chord Shapes [PLACEHOLDER] */}
          <div className="p-4">
            <button
              onClick={() => setChordsExpanded(!chordsExpanded)}
              className="flex w-full items-center justify-between text-left"
            >
              <h5 className="text-sm font-semibold text-gray-900">
                {chordsExpanded ? '▼' : '▶'} Chord Shapes <span className="ml-2 rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800">[PLACEHOLDER]</span>
              </h5>
              <span className="text-xs text-gray-500">Detection coming soon</span>
            </button>

            {chordsExpanded && (
              <div className="mt-3 rounded-md bg-gray-50 p-3 text-sm text-gray-600">
                <p className="font-medium">🚧 Chord detection not yet implemented</p>
                <p className="mt-2 text-xs">
                  Future: Identify simultaneous notes, map to guitar chord shapes (C major, G7, etc.),
                  show suggested fingerings. Requires Tonal.js integration.
                </p>
                <p className="mt-2 text-xs text-gray-500">
                  Example placeholder: "Measure 4: C-E-G (C major triad, shape: x32010)"
                </p>
              </div>
            )}
          </div>

          {/* Section 3: Scale Patterns [PLACEHOLDER] */}
          <div className="p-4">
            <button
              onClick={() => setScalesExpanded(!scalesExpanded)}
              className="flex w-full items-center justify-between text-left"
            >
              <h5 className="text-sm font-semibold text-gray-900">
                {scalesExpanded ? '▼' : '▶'} Scale Patterns <span className="ml-2 rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800">[PLACEHOLDER]</span>
              </h5>
              <span className="text-xs text-gray-500">Detection coming soon</span>
            </button>

            {scalesExpanded && (
              <div className="mt-3 rounded-md bg-gray-50 p-3 text-sm text-gray-600">
                <p className="font-medium">🚧 Scale pattern detection not yet implemented</p>
                <p className="mt-2 text-xs">
                  Future: Analyze melodic sequences, identify scale patterns (C major, A minor pentatonic),
                  show fretboard position diagrams, suggest optimal fingerings.
                </p>
                <p className="mt-2 text-xs text-gray-500">
                  Example placeholder: "Measures 8-12: C-D-E-F-G (C major scale, Position 1)"
                </p>
              </div>
            )}
          </div>

          {/* Section 4: Progressions [PLACEHOLDER] */}
          <div className="p-4">
            <button
              onClick={() => setProgressionsExpanded(!progressionsExpanded)}
              className="flex w-full items-center justify-between text-left"
            >
              <h5 className="text-sm font-semibold text-gray-900">
                {progressionsExpanded ? '▼' : '▶'} Progressions <span className="ml-2 rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800">[PLACEHOLDER]</span>
              </h5>
              <span className="text-xs text-gray-500">Analysis coming soon</span>
            </button>

            {progressionsExpanded && (
              <div className="mt-3 rounded-md bg-gray-50 p-3 text-sm text-gray-600">
                <p className="font-medium">🚧 Progression analysis not yet implemented</p>
                <p className="mt-2 text-xs">
                  Future: Track chord/scale transitions, identify common progressions (I-IV-V),
                  suggest practice strategies for difficult transitions.
                </p>
                <p className="mt-2 text-xs text-gray-500">
                  Example placeholder: "Chord sequence: C major → F major → G major → C major (I-IV-V-I in C)"
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
