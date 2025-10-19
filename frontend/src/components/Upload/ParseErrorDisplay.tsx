/**
 * ParseErrorDisplay component
 *
 * Displays detailed MusicXML parse errors with collapsible detail levels:
 * - Level 1: Line number only
 * - Level 2: + Measure number
 * - Level 3: + Element type
 * - Level 4: Full XPath
 */

import { useState } from 'react'
import type { ParseErrorDetails } from '@/types/upload'

interface ParseErrorDisplayProps {
  error: string
  errorDetails: ParseErrorDetails | null
  onViewXML?: () => void
  onDownloadXML?: () => void
}

export default function ParseErrorDisplay({
  error,
  errorDetails,
  onViewXML,
  onDownloadXML,
}: ParseErrorDisplayProps) {
  const [detailLevel, setDetailLevel] = useState<1 | 2 | 3 | 4>(2)

  if (!errorDetails) {
    // Fallback: Show generic error without details
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0 text-2xl">❌</div>
          <div className="ml-3 flex-1">
            <h3 className="text-sm font-medium text-red-800">Parse Error</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Build location string based on detail level
  const buildLocationString = (level: number): string => {
    const parts: string[] = []

    if (level >= 1 && errorDetails.line) {
      parts.push(`Line ${errorDetails.line}`)
    }

    if (level >= 2 && errorDetails.measure) {
      parts.push(`Measure ${errorDetails.measure}`)
    }

    if (level >= 3 && errorDetails.element) {
      parts.push(`Element ${errorDetails.element}`)
    }

    if (level >= 4 && errorDetails.xpath) {
      return errorDetails.xpath
    }

    return parts.join(' • ') || 'Unknown location'
  }

  const hasContextLines = errorDetails.context_lines && errorDetails.context_lines.length > 0

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      {/* Header */}
      <div className="flex items-start mb-4">
        <div className="flex-shrink-0 text-2xl">❌</div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-red-800">MusicXML Parse Error</h3>
          <p className="mt-1 text-sm text-red-700">{errorDetails.message}</p>
        </div>
      </div>

      {/* Location Details with Level Selector */}
      <div className="bg-white rounded-md p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-700">Error Location:</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((level) => (
              <button
                key={level}
                onClick={() => setDetailLevel(level as 1 | 2 | 3 | 4)}
                disabled={
                  (level === 1 && !errorDetails.line) ||
                  (level === 2 && !errorDetails.measure) ||
                  (level === 3 && !errorDetails.element) ||
                  (level === 4 && !errorDetails.xpath)
                }
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  detailLevel === level
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                } disabled:opacity-30 disabled:cursor-not-allowed`}
                title={`Detail level ${level}`}
              >
                L{level}
              </button>
            ))}
          </div>
        </div>
        <div className="font-mono text-sm text-gray-900 break-all">
          {buildLocationString(detailLevel)}
        </div>

        {/* Show what each level means */}
        <div className="mt-2 text-xs text-gray-500">
          {detailLevel === 1 && 'Line number in XML file'}
          {detailLevel === 2 && 'Line + Measure number in the score'}
          {detailLevel === 3 && 'Line + Measure + Element type (e.g., <note>)'}
          {detailLevel === 4 && 'Full XPath to the problematic element'}
        </div>
      </div>

      {/* Suggestion */}
      {errorDetails.suggestion && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-3">
          <div className="flex items-start">
            <span className="text-yellow-600 mr-2">💡</span>
            <div>
              <span className="text-xs font-medium text-yellow-800">Suggestion:</span>
              <p className="text-sm text-yellow-700 mt-1">{errorDetails.suggestion}</p>
            </div>
          </div>
        </div>
      )}

      {/* Context Lines */}
      {hasContextLines && (
        <details className="bg-white rounded-md p-3 mb-3">
          <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
            {(errorDetails.context_lines[0] as any).direction
              ? `All Repeat Locations (${errorDetails.context_lines.length} found)`
              : `View XML Context (${errorDetails.context_lines.length} lines)`
            }
          </summary>
          <div className="mt-3 overflow-x-auto">
            <pre className="text-xs font-mono bg-gray-50 p-2 rounded border border-gray-200">
              {errorDetails.context_lines.map((line, idx) => {
                // Check if this is a repeat location entry (has 'direction' property)
                const isRepeatLocation = 'direction' in line;

                return (
                  <div
                    key={idx}
                    className={`${
                      line.line_num === errorDetails.line
                        ? 'bg-red-100 text-red-900'
                        : isRepeatLocation
                        ? 'text-blue-700'
                        : 'text-gray-700'
                    } px-1 ${isRepeatLocation ? 'py-1 border-b border-gray-200 last:border-b-0' : ''}`}
                  >
                    <span className="text-gray-400 select-none mr-3">
                      {String(line.line_num).padStart(4, ' ')}
                    </span>
                    {isRepeatLocation && (
                      <span className="text-gray-500 mr-2">
                        [Measure {(line as any).measure}]
                      </span>
                    )}
                    {line.content}
                  </div>
                );
              })}
            </pre>
          </div>
        </details>
      )}

      {/* Error Type Badge */}
      <div className="mb-3">
        <span className="inline-block px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">
          {errorDetails.exception_type}
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {onViewXML && (
          <button
            onClick={onViewXML}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
          >
            View/Edit MusicXML
          </button>
        )}
        {onDownloadXML && (
          <button
            onClick={onDownloadXML}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors"
          >
            Download MusicXML
          </button>
        )}
      </div>

      {/* Help Text */}
      <div className="mt-3 text-xs text-gray-600">
        <p>
          Use the detail level buttons (L1-L4) to toggle between different levels of error location information.
          Click "View/Edit MusicXML" to fix the error directly in the editor.
        </p>
      </div>
    </div>
  )
}
