/**
 * MusicXMLEditor component
 *
 * CodeMirror 6-based XML editor with:
 * - XML syntax highlighting
 * - Error line highlighting (red background)
 * - Line jump functionality
 * - Real-time validation
 * - Download and save buttons
 */

import { useEffect, useRef, useState } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState, Extension } from '@codemirror/state'
import { xml } from '@codemirror/lang-xml'
import { oneDark } from '@codemirror/theme-one-dark'
import type { ParseErrorDetails, ValidationResponse } from '@/types/upload'
import { Decoration, DecorationSet } from '@codemirror/view'
import { StateField, StateEffect } from '@codemirror/state'

interface MusicXMLEditorProps {
  initialContent: string
  onSave?: (content: string) => void
  onValidate?: (content: string) => Promise<ValidationResponse>
  errorLines?: number[]
  autoValidate?: boolean
  readonly?: boolean
}

// Effect to update highlighted error lines
const setErrorLinesEffect = StateEffect.define<number[]>()

// StateField to track error lines and create decorations
const errorLineField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none
  },
  update(decorations, tr) {
    decorations = decorations.map(tr.changes)
    for (const effect of tr.effects) {
      if (effect.is(setErrorLinesEffect)) {
        const errorLines = effect.value
        const newDecorations: any[] = []

        for (const lineNum of errorLines) {
          const line = tr.state.doc.line(lineNum)
          newDecorations.push(
            Decoration.line({
              attributes: { class: 'cm-error-line' },
            }).range(line.from)
          )
        }

        decorations = Decoration.set(newDecorations)
      }
    }
    return decorations
  },
  provide: (field) => EditorView.decorations.from(field),
})

// Custom theme for error line highlighting
const errorLineTheme = EditorView.baseTheme({
  '.cm-error-line': {
    backgroundColor: '#fee',
    borderLeft: '3px solid #dc2626',
  },
})

export default function MusicXMLEditor({
  initialContent,
  onSave,
  onValidate,
  errorLines = [],
  autoValidate = false,
  readonly = false,
}: MusicXMLEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<ValidationResponse | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (!editorRef.current) return

    // Create editor extensions
    const extensions: Extension[] = [
      basicSetup,
      xml(),
      errorLineField,
      errorLineTheme,
      EditorView.editable.of(!readonly),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          setHasChanges(true)
          setValidationResult(null)
        }
      }),
    ]

    // Optional: Add dark theme
    // extensions.push(oneDark)

    // Create editor state
    const state = EditorState.create({
      doc: initialContent,
      extensions,
    })

    // Create editor view
    const view = new EditorView({
      state,
      parent: editorRef.current,
    })

    viewRef.current = view

    // Set initial error lines
    if (errorLines.length > 0) {
      view.dispatch({
        effects: setErrorLinesEffect.of(errorLines),
      })
    }

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [initialContent, readonly])

  // Update error lines when prop changes
  useEffect(() => {
    if (viewRef.current && errorLines.length > 0) {
      viewRef.current.dispatch({
        effects: setErrorLinesEffect.of(errorLines),
      })

      // Auto-scroll to the first error line
      setTimeout(() => {
        if (viewRef.current && errorLines.length > 0) {
          const firstErrorLine = errorLines[0]
          const line = viewRef.current.state.doc.line(firstErrorLine)
          viewRef.current.dispatch({
            selection: { anchor: line.from },
            effects: EditorView.scrollIntoView(line.from, { y: 'center' }),
          })
        }
      }, 100) // Small delay to ensure rendering is complete
    }
  }, [errorLines])

  const handleValidate = async () => {
    if (!viewRef.current || !onValidate) return

    const content = viewRef.current.state.doc.toString()
    setIsValidating(true)

    try {
      const result = await onValidate(content)
      setValidationResult(result)
    } catch (error) {
      console.error('Validation failed:', error)
    } finally {
      setIsValidating(false)
    }
  }

  const handleSave = () => {
    if (!viewRef.current || !onSave) return

    const content = viewRef.current.state.doc.toString()
    onSave(content)
    setHasChanges(false)
  }

  const handleDownload = () => {
    if (!viewRef.current) return

    const content = viewRef.current.state.doc.toString()
    const blob = new Blob([content], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'edited_musicxml.xml'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const jumpToLine = (lineNum: number) => {
    if (!viewRef.current) return

    const line = viewRef.current.state.doc.line(lineNum)
    viewRef.current.dispatch({
      selection: { anchor: line.from },
      effects: EditorView.scrollIntoView(line.from, { y: 'center' }),
    })
    viewRef.current.focus()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="bg-gray-100 border-b border-gray-300 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">MusicXML Editor</span>
          {hasChanges && (
            <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
              Unsaved Changes
            </span>
          )}
          {readonly && (
            <span className="px-2 py-1 text-xs font-medium bg-gray-200 text-gray-600 rounded">
              Read-only
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onValidate && (
            <button
              onClick={handleValidate}
              disabled={isValidating}
              className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 rounded-md transition-colors"
            >
              {isValidating ? 'Validating...' : 'Validate'}
            </button>
          )}
          <button
            onClick={handleDownload}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors"
          >
            Download
          </button>
          {onSave && !readonly && (
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-green-300 rounded-md transition-colors"
            >
              Save
            </button>
          )}
        </div>
      </div>

      {/* Validation Result */}
      {validationResult && (
        <div
          className={`px-4 py-2 border-b ${
            validationResult.valid
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}
        >
          {validationResult.valid ? (
            <p className="text-sm text-green-700">
              ✅ MusicXML is valid! Metadata: {validationResult.metadata?.title || 'Untitled'} by{' '}
              {validationResult.metadata?.composer || 'Unknown'}
            </p>
          ) : (
            <p className="text-sm text-red-700">
              ❌ Validation failed: {validationResult.parse_error}
            </p>
          )}
        </div>
      )}

      {/* Editor */}
      <div ref={editorRef} className="flex-1 overflow-auto" />

      {/* Status Bar */}
      <div className="bg-gray-100 border-t border-gray-300 px-4 py-2 text-xs text-gray-600">
        <div className="flex items-center justify-between">
          <span>
            {viewRef.current
              ? `${viewRef.current.state.doc.lines} lines, ${viewRef.current.state.doc.length} characters`
              : 'Loading...'}
          </span>
          {errorLines.length > 0 && (
            <span className="text-red-600 font-medium">
              {errorLines.length} error line{errorLines.length !== 1 ? 's' : ''} highlighted
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// Export jumpToLine helper for external use
export { type MusicXMLEditorProps }
