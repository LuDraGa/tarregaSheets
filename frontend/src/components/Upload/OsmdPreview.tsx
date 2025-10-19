import { useCallback, useEffect, useRef, useState } from 'react'
import { OSMDRenderer } from '@/lib/osmd'

interface OsmdPreviewProps {
  musicXmlUrl: string
  height?: number
  collapsed?: boolean
  onToggleExpand?: () => void
  playbackProgress?: number // 0-1
  activeMeasureIndex?: number
}

export default function OsmdPreview({
  musicXmlUrl,
  height = 260,
  collapsed = false,
  onToggleExpand,
  playbackProgress = 0,
  activeMeasureIndex = -1,
}: OsmdPreviewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<OSMDRenderer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(!collapsed)
  const [measureBounds, setMeasureBounds] = useState<MeasureBounds[]>([])
  const [activeBounds, setActiveBounds] = useState<MeasureBounds | null>(null)
  const updateMeasureBounds = useCallback(() => {
    const wrapper = scrollRef.current
    const container = containerRef.current
    if (!wrapper || !container) return
    const svg = container.querySelector('svg')
    if (!svg) return

    const elements = svg.querySelectorAll<SVGGElement>('g[id^="measure-"]')
    if (!elements.length) {
      setMeasureBounds([])
      return
    }

    const bounds: MeasureBounds[] = []
    elements.forEach((element, idx) => {
      const rect = element.getBoundingClientRect()
      if (!rect) return
      const wrapperRect = wrapper.getBoundingClientRect()
      const idMatch = element.id?.match(/measure-(\d+)/i)
      const measureNumber = idMatch ? Number.parseInt(idMatch[1] ?? '', 10) : idx + 1
      const zeroBasedIndex = Number.isFinite(measureNumber) ? measureNumber - 1 : idx

      bounds.push({
        index: zeroBasedIndex,
        x: rect.left - wrapperRect.left + wrapper.scrollLeft,
        y: rect.top - wrapperRect.top + wrapper.scrollTop,
        width: rect.width,
        height: rect.height,
      })
    })

    bounds.sort((a, b) => a.index - b.index)
    setMeasureBounds(bounds)
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const renderer = new OSMDRenderer(container)
    rendererRef.current = renderer

    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        await renderer.loadMusicXML(musicXmlUrl)
        renderer.resetCursor()
        renderer.showCursor()
        setLoading(false)
        window.requestAnimationFrame(() => updateMeasureBounds())
      } catch (err: any) {
        console.error('Failed to load OSMD preview:', err)
        setError(err?.message || 'Failed to render staff notation')
        setLoading(false)
      }
    }

    load()

    return () => {
      rendererRef.current?.destroy()
      rendererRef.current = null
    }
  }, [musicXmlUrl, updateMeasureBounds])

  useEffect(() => {
    setIsExpanded(!collapsed)
  }, [collapsed])

  useEffect(() => {
    if (!collapsed) {
      updateMeasureBounds()
    }
  }, [collapsed, updateMeasureBounds])

  useEffect(() => {
    const handleResize = () => updateMeasureBounds()
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [updateMeasureBounds])

  useEffect(() => {
    if (activeMeasureIndex < 0) {
      setActiveBounds(null)
      return
    }
    const bounds = measureBounds.find((b) => b.index === activeMeasureIndex)
    if (!bounds) {
      setActiveBounds(null)
      return
    }
    setActiveBounds(bounds)

    const wrapper = scrollRef.current
    if (!wrapper) return

    if (collapsed) {
      const targetTop = Math.max(bounds.y - 16, 0)
      const targetLeft = Math.max(bounds.x - 16, 0)
      if (Math.abs(wrapper.scrollTop - targetTop) > 2) {
        wrapper.scrollTop = targetTop
      }
      if (Math.abs(wrapper.scrollLeft - targetLeft) > 2) {
        wrapper.scrollLeft = targetLeft
      }
    }

    if (isExpanded) {
      rendererRef.current?.showCursor()
    }
  }, [activeMeasureIndex, measureBounds, collapsed, isExpanded])

  useEffect(() => {
    const wrapper = scrollRef.current
    if (!wrapper) return
    const clamped = Math.max(0, Math.min(playbackProgress, 1))
    const maxScroll = Math.max(0, wrapper.scrollHeight - wrapper.clientHeight)
    const target = clamped * maxScroll
    if (!Number.isFinite(target)) return
    if (Math.abs(wrapper.scrollTop - target) > 3 && measureBounds.length === 0) {
      wrapper.scrollTop = target
    }
  }, [playbackProgress, measureBounds.length])

  return (
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
        ref={scrollRef}
        className="relative h-full w-full overflow-auto"
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
          style={{ minHeight: `${height}px` }}
        />
      </div>

      {loading && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-sm text-gray-600">
          <div className="flex flex-col items-center gap-2">
            <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
            <span>Loading staff preview…</span>
          </div>
        </div>
      )}
      {error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-sm text-red-600">
          ❌ {error}
        </div>
      )}
      {collapsed && !loading && !error && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white to-transparent" />
      )}
      {collapsed && (
        <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-4">
          <div className="rounded-full bg-black/60 px-4 py-1 text-xs font-medium text-white">
            Click to view full staff notation
          </div>
        </div>
      )}
    </div>
  )
}
type MeasureBounds = {
  index: number
  x: number
  y: number
  width: number
  height: number
}
