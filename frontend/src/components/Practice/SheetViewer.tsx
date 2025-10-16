import { useEffect, useRef, useState } from 'react'
import { OSMDRenderer } from '@/lib/osmd'

interface SheetViewerProps {
  musicXmlUrl: string
  onLoad: (renderer: OSMDRenderer) => void
  onError: (error: Error) => void
}

export default function SheetViewer({ musicXmlUrl, onLoad, onError }: SheetViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<OSMDRenderer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadSheet = async () => {
      if (!containerRef.current) return

      try {
        setLoading(true)
        setError(null)

        // Create renderer
        const renderer = new OSMDRenderer(containerRef.current)
        rendererRef.current = renderer

        // Load MusicXML
        await renderer.loadMusicXML(musicXmlUrl)

        // Initialize cursor
        renderer.resetCursor()

        setLoading(false)
        onLoad(renderer)
      } catch (err: any) {
        console.error('Failed to load sheet music:', err)
        setError(err.message || 'Failed to load sheet music')
        setLoading(false)
        onError(err)
      }
    }

    loadSheet()

    // Cleanup
    return () => {
      if (rendererRef.current) {
        rendererRef.current.destroy()
        rendererRef.current = null
      }
    }
  }, [musicXmlUrl, onLoad, onError])

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {loading && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-600">Loading sheet music...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-700">❌ {error}</p>
        </div>
      )}

      <div
        ref={containerRef}
        className={`sheet-music-container ${loading || error ? 'hidden' : ''}`}
        style={{ minHeight: '400px' }}
      />
    </div>
  )
}
