import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { piecesApi, uploadApi } from '@/services/api'
import ParseErrorDisplay from '@/components/Upload/ParseErrorDisplay'
import ConversionPreviewModal from '@/components/Upload/ConversionPreviewModal'
import {
  buildConversionEntries,
  buildFileUrl,
  getDefaultConversionChecks,
  getDefaultPreviewAssets,
  statusStyles,
} from '@/components/Upload/conversionPreviewHelpers'
import type { UploadResponse } from '@/types/upload'

type UploadedFile = UploadResponse
type PreviewTab = 'statuses' | 'editor'

export default function UploadPage() {
  const navigate = useNavigate()
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Preview workspace state
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [previewInitialTab, setPreviewInitialTab] = useState<PreviewTab>('statuses')

  // Form state
  const [title, setTitle] = useState('')
  const [composer, setComposer] = useState('')
  const [tags, setTags] = useState('')

  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return

    const file = acceptedFiles[0]
    setError(null)
    setUploading(true)
    setUploadProgress(0)

    try {
      // Upload file to backend
      const response = await uploadApi.uploadFile(file, (progress) => {
        setUploadProgress(progress)
      })

      const fallbackMetadata = {
        title: file.name.replace(/\.[^.]+$/, ''),
        composer: '',
        tempo: 120,
        key: 'C',
        time_signature: '4/4',
        has_tablature: false,
        has_staff_notation: true,
        notation_type: 'staff' as const,
      }

      const metadata = response.metadata
        ? {
            ...fallbackMetadata,
            ...response.metadata,
          }
        : fallbackMetadata

      const normalized: UploadedFile = {
        ...response,
        file_id: response.file_id ?? null,
        musicxml_file_id: response.musicxml_file_id ?? null,
        midi_file_id: response.midi_file_id ?? null,
        metadata,
        conversion_checks: {
          ...getDefaultConversionChecks(),
          ...(response.conversion_checks ?? {}),
        },
        preview_assets: {
          ...getDefaultPreviewAssets(),
          ...(response.preview_assets ?? {}),
        },
      }

      setUploadedFile(normalized)
      setIsPreviewOpen(true)
      setPreviewInitialTab('statuses')

      // Prefill form with metadata
      setTitle(metadata.title)
      setComposer(metadata.composer)

      // Don't show generic error anymore - we have fancy error display now
      if (normalized.parse_status !== 'success') {
        // Error will be shown via ParseErrorDisplay component
      } else if (normalized.midi_status !== 'success') {
        setError(
          `MIDI generation issue: ${normalized.midi_error || 'Unknown error'}. ` +
            'You can still save the piece, but playback will be unavailable until this is resolved.'
        )
      } else {
        setError(null)
      }

      setUploading(false)
    } catch (err: unknown) {
      console.error('Upload failed:', err)
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosError = err as { response?: { data?: { detail?: string } } }
        setError(axiosError.response?.data?.detail || 'Upload failed')
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Upload failed')
      }
      setUploading(false)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.recordare.musicxml+xml': ['.xml', '.musicxml'],
      'application/vnd.recordare.musicxml': ['.mxl'],
    },
    maxFiles: 1,
    disabled: uploading || !!uploadedFile,
  })

  const conversionEntries = useMemo(() => {
    if (!uploadedFile) return []
    const checks = {
      ...getDefaultConversionChecks(),
      ...(uploadedFile.conversion_checks ?? {}),
    }
    return buildConversionEntries(checks)
  }, [uploadedFile])

  const previewAssets = useMemo(() => {
    if (!uploadedFile) return getDefaultPreviewAssets()
    return {
      ...getDefaultPreviewAssets(),
      ...(uploadedFile.preview_assets ?? {}),
    }
  }, [uploadedFile])

  const handleViewXML = () => {
    if (!uploadedFile) return
    setPreviewInitialTab('editor')
    setIsPreviewOpen(true)
  }

  const handleDownloadXML = () => {
    if (!uploadedFile) return

    const fallbackId = uploadedFile.musicxml_file_id || uploadedFile.original_file_id
    const fileUrl = buildFileUrl(previewAssets.musicxml_file_id || fallbackId)
    if (!fileUrl) {
      setError('No MusicXML file available for download.')
      return
    }

    const a = document.createElement('a')
    a.href = fileUrl
    a.download = uploadedFile.filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const handleCreatePiece = async () => {
    if (!uploadedFile) return

    if (uploadedFile.parse_status !== 'success' || !uploadedFile.musicxml_file_id) {
      setError('Sheet music processing failed. Please upload a MusicXML file that parses successfully before saving.')
      return
    }

    try {
      // Create piece
      const piece = await piecesApi.create({
        title: title || uploadedFile.metadata.title,
        composer: composer || uploadedFile.metadata.composer,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        tuning: 'EADGBE',
        capo: 0,
      })

      // Add version with uploaded file
      await piecesApi.addVersion(piece.id, {
        file_id: uploadedFile.musicxml_file_id,
        ...(uploadedFile.midi_file_id ? { midi_file_id: uploadedFile.midi_file_id } : {}),
        source_type: 'musicxml',
        filename: uploadedFile.filename,
        metadata: uploadedFile.metadata,
      })

      // Navigate to library
      navigate('/library')
    } catch (err: unknown) {
      console.error('Failed to create piece:', err)
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosError = err as { response?: { data?: { detail?: string } } }
        setError(axiosError.response?.data?.detail || 'Failed to create piece')
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Failed to create piece')
      }
    }
  }

  const handleReset = () => {
    setUploadedFile(null)
    setTitle('')
    setComposer('')
    setTags('')
    setError(null)
    setIsPreviewOpen(false)
    setPreviewInitialTab('statuses')
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-900">Upload Sheet Music</h2>
      </div>

      {/* Generic error banner (for non-parse errors) */}
      {error && !uploadedFile?.parse_error_details && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">❌ {error}</p>
        </div>
      )}

      {!uploadedFile ? (
        <>
          {/* Dropzone */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? 'border-primary bg-blue-50'
                  : 'border-gray-300 hover:border-primary hover:bg-gray-50'
              } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <input {...getInputProps()} />
              <div className="text-6xl mb-4">{isDragActive ? '📥' : '🎼'}</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {isDragActive ? 'Drop file here' : 'Drop MusicXML file here'}
              </h3>
              <p className="text-gray-600 mb-4">
                or click to browse
              </p>
              <p className="text-sm text-gray-500">
                Supported formats: MusicXML (.xml, .musicxml), MXL (.mxl)
              </p>
            </div>

            {/* Upload Progress */}
            {uploading && (
              <div className="mt-6">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Parsing MusicXML and generating MIDI...
                </p>
              </div>
            )}
          </div>

          {/* Info Card */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-700">
              💡 <strong>Tip:</strong> Upload a MusicXML file to get started. The system will automatically parse the file and generate a MIDI version for playback.
            </p>
          </div>
        </>
      ) : (
        <>
          {/* Parse Error Display - NEW */}
          {uploadedFile.parse_status === 'failed' && uploadedFile.parse_error && (
            <div className="mb-6">
              <ParseErrorDisplay
                error={uploadedFile.parse_error}
                errorDetails={uploadedFile.parse_error_details || null}
                onViewXML={handleViewXML}
                onDownloadXML={handleDownloadXML}
              />
            </div>
          )}

          {/* MIDI Error Display */}
          {uploadedFile.parse_status === 'success' && uploadedFile.midi_status === 'failed' && uploadedFile.midi_error && (
            <div className="mb-6">
              <ParseErrorDisplay
                error={uploadedFile.midi_error}
                errorDetails={uploadedFile.midi_error_details || null}
                onViewXML={handleViewXML}
                onDownloadXML={handleDownloadXML}
              />
            </div>
          )}

          {/* Status Message */}
          {uploadedFile.parse_status === 'success' && (
            <div className="mb-6 rounded-lg p-4 border bg-green-50 border-green-200">
              <p className="text-sm text-green-700">
                ✅ File processed successfully! Now add details to your piece.
              </p>
            </div>
          )}

          {/* Conversion Summary */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Conversion Checks</h3>
                <p className="text-sm text-gray-600">
                  Track automated transformations for this upload. Open the preview workspace for details and live editing.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsPreviewOpen(true)
                  setPreviewInitialTab('statuses')
                }}
                className="inline-flex items-center justify-center rounded-md border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary hover:text-white transition-colors"
              >
                Open Preview Workspace
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {conversionEntries.map(({ key, label, description, check }) => {
                const variant = statusStyles[check.status] || statusStyles.pending
                const detail = check.error || check.reason || check.note

                return (
                  <div
                    key={key}
                    className={`rounded-lg border p-4 transition-all ${variant.borderClass}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{label}</p>
                        <p className="text-xs text-gray-500">{description}</p>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${variant.badge}`}
                      >
                        {variant.icon} {check.status}
                      </span>
                    </div>
                    {check.duration_ms && (
                      <p className="mt-2 text-xs text-gray-500">
                        Took {check.duration_ms} ms
                      </p>
                    )}
                    {detail && (
                      <p className={`mt-2 text-xs ${variant.textClass}`}>
                        {detail}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Metadata Form */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Piece Details</h3>

            {/* Parsed Info Display */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Parsed from file:</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-600">Tempo:</span>{' '}
                  <span className="font-medium">{uploadedFile.metadata.tempo} BPM</span>
                </div>
                <div>
                  <span className="text-gray-600">Key:</span>{' '}
                  <span className="font-medium">{uploadedFile.metadata.key}</span>
                </div>
                <div>
                  <span className="text-gray-600">Time Signature:</span>{' '}
                  <span className="font-medium">{uploadedFile.metadata.time_signature}</span>
                </div>
                <div>
                  <span className="text-gray-600">Tablature:</span>{' '}
                  <span className="font-medium">
                    {uploadedFile.metadata.has_tablature ? '✅ Yes' : '❌ No'}
                  </span>
                </div>
              </div>
            </div>

            {uploadedFile.parse_status !== 'success' && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
                <p className="text-sm text-red-700">
                  You cannot create a practice-ready piece until the MusicXML parses successfully. Use the "View/Edit MusicXML" button above to fix errors, or upload a corrected file.
                </p>
              </div>
            )}

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  placeholder="e.g., Asturias (Leyenda)"
                />
              </div>

              {/* Composer */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Composer
                </label>
                <input
                  type="text"
                  value={composer}
                  onChange={(e) => setComposer(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  placeholder="e.g., Isaac Albéniz"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tags
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                  placeholder="e.g., classical, advanced, romantic"
                />
                <p className="text-xs text-gray-500 mt-1">Separate tags with commas</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCreatePiece}
                disabled={!title.trim() || uploadedFile.parse_status !== 'success' || uploading}
                className="flex-1 px-6 py-3 bg-primary text-white rounded-md hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                Save to Library
              </button>
              <button
                onClick={handleReset}
                className="px-6 py-3 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}

      <ConversionPreviewModal
        uploadedFile={uploadedFile}
        isOpen={isPreviewOpen}
        initialTab={previewInitialTab}
        onClose={() => setIsPreviewOpen(false)}
      />
    </div>
  )
}
