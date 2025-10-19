import { useEffect, useState, useRef } from 'react'
import { AlphaTabApi, Settings } from '@coderline/alphatab'

interface NotePosition {
  string: number // 1-6 (1 = high E, 6 = low E)
  fret: number
}

interface NoteData {
  noteName: string
  midiPitch: number
  time: number // seconds
  duration: number // seconds
  positions: NotePosition[]
  instrument: string
}

interface NoteDataDisplayProps {
  musicXmlUrl: string
}

// Standard guitar tuning (EADGBE) - MIDI pitches for open strings
const STANDARD_TUNING = [64, 59, 55, 50, 45, 40] // E4, B3, G3, D3, A2, E2

function calculateGuitarPositions(midiPitch: number, maxFret: number = 24): NotePosition[] {
  const positions: NotePosition[] = []

  STANDARD_TUNING.forEach((openStringPitch, stringIndex) => {
    const fret = midiPitch - openStringPitch
    // Check if note can be played on this string (within fret range)
    if (fret >= 0 && fret <= maxFret) {
      positions.push({
        string: stringIndex + 1, // 1-indexed (1 = high E)
        fret,
      })
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

export default function NoteDataDisplay({ musicXmlUrl }: NoteDataDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<AlphaTabApi | null>(null)
  const [notes, setNotes] = useState<NoteData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const containerEl = containerRef.current
    if (!containerEl) return

    const settings = new Settings()
    settings.core.enableLazyLoading = false
    settings.core.useWorkers = false // Disable workers for easier debugging
    settings.core.fontDirectory = '/font/'

    const api = new AlphaTabApi(containerEl, settings)
    apiRef.current = api

    api.scoreLoaded.on((score) => {
      console.log('📊 Extracting note data from score:', score.title)

      const extractedNotes: NoteData[] = []
      let currentTimeMs = 0

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
                    time: beatTimeMs / 1000, // Convert to seconds
                    duration: beat.playbackDuration / 1000, // Convert to seconds
                    positions,
                    instrument: 'guitar', // For now, hardcoded
                  })
                })
              })
            })
          })
        })
      })

      // Sort by time
      extractedNotes.sort((a, b) => a.time - b.time)

      console.log(`📊 Extracted ${extractedNotes.length} notes`)
      setNotes(extractedNotes)
      setIsLoading(false)
    })

    api.error.on((err) => {
      console.error('❌ Error loading score:', err)
      setError(err.message || 'Failed to load note data')
      setIsLoading(false)
    })

    // Load MusicXML
    fetch(musicXmlUrl)
      .then((res) => res.arrayBuffer())
      .then((buffer) => {
        api.load(buffer)
      })
      .catch((err) => {
        console.error('❌ Failed to fetch MusicXML:', err)
        setError('Failed to load MusicXML file')
        setIsLoading(false)
      })

    return () => {
      api.destroy()
      apiRef.current = null
    }
  }, [musicXmlUrl])

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-3 text-gray-600">
          <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-primary" />
          <span className="text-sm">Extracting note data...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <p className="text-sm text-red-700">❌ {error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Hidden container for alphaTab parsing */}
      <div ref={containerRef} className="hidden" />

      {/* Note data display */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
          <h4 className="text-sm font-semibold text-gray-900">
            Note Data ({notes.length} notes)
          </h4>
          <p className="text-xs text-gray-600 mt-1">
            Shows each note with playback time and all possible guitar positions (standard EADGBE tuning)
          </p>
        </div>

        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-100 text-xs font-semibold text-gray-700">
              <tr>
                <th className="px-4 py-2 text-left">Time</th>
                <th className="px-4 py-2 text-left">Note</th>
                <th className="px-4 py-2 text-left">Duration</th>
                <th className="px-4 py-2 text-left">MIDI</th>
                <th className="px-4 py-2 text-left">Guitar Positions</th>
                <th className="px-4 py-2 text-left">Instrument</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {notes.map((note, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-xs text-gray-900">
                    {note.time.toFixed(3)}s
                  </td>
                  <td className="px-4 py-2 font-semibold text-gray-900">
                    {note.noteName}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-600">
                    {note.duration.toFixed(3)}s
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-600">
                    {note.midiPitch}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap gap-1">
                      {note.positions.map((pos, posIdx) => (
                        <span
                          key={posIdx}
                          className="inline-flex items-center rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800"
                        >
                          String {pos.string}, Fret {pos.fret}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-600">
                    {note.instrument}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
