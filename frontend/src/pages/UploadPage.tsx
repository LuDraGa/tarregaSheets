import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { piecesApi, uploadApi } from '@/services/api'

interface UploadedFile {
  file_id: string | null
  original_file_id: string
  musicxml_file_id: string | null
  midi_file_id: string | null
  filename: string
  metadata: {
    title: string
    composer: string
    tempo: number
    key: string
    time_signature: string
    has_tablature: boolean
  }
  parse_status: 'pending' | 'success' | 'failed'
  parse_error?: string | null
  midi_status: 'pending' | 'success' | 'failed' | 'skipped'
  midi_error?: string | null
}

export default function UploadPage() {
  const navigate = useNavigate()
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null)
  const [error, setError] = useState<string | null>(null)

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

      const metadata = response.metadata ?? {
        title: file.name.replace(/\.[^.]+$/, ''),
        composer: '',
        tempo: 120,
        key: 'C',
        time_signature: '4/4',
        has_tablature: false,
      }

      const normalized: UploadedFile = {
        file_id: response.file_id ?? null,
        original_file_id: response.original_file_id,
        musicxml_file_id: response.musicxml_file_id ?? null,
        midi_file_id: response.midi_file_id ?? null,
        filename: response.filename,
        metadata,
        parse_status: response.parse_status ?? 'pending',
        parse_error: response.parse_error,
        midi_status: response.midi_status ?? 'pending',
        midi_error: response.midi_error,
      }

      setUploadedFile(normalized)

      // Prefill form with metadata
      setTitle(metadata.title)
      setComposer(metadata.composer)

      if (normalized.parse_status !== 'success') {
        setError(
          `MusicXML parser reported an issue: ${normalized.parse_error || 'Unknown error'}. ` +
            'The original file was stored, but you will need to fix it before saving a piece.'
        )
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
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-900">Upload Sheet Music</h2>
      </div>

      {error && (
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
          {/* Status Message */}
          <div
            className={`mb-6 rounded-lg p-4 border ${
              uploadedFile.parse_status === 'success' ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
            }`}
          >
            {uploadedFile.parse_status === 'success' ? (
              <p className="text-sm text-green-700">
                ✅ File processed successfully! Now add details to your piece.
              </p>
            ) : (
              <p className="text-sm text-yellow-700">
                ⚠️ We stored your original upload, but the MusicXML parser reported an issue:
                {' '}
                <span className="font-medium">{uploadedFile.parse_error || 'Unknown parsing error'}</span>.
                Please correct the file and re-upload before saving.
              </p>
            )}
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
              {uploadedFile.midi_status !== 'success' && uploadedFile.midi_status !== 'pending' && (
                <p className="text-xs text-yellow-700 mt-3">
                  ⚠️ MIDI generation issue: {uploadedFile.midi_error || 'Unknown error'}. The piece will be saved without playback until the file is fixed.
                </p>
              )}
            </div>

            {uploadedFile.parse_status !== 'success' && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
                <p className="text-sm text-red-700">
                  You cannot create a practice-ready piece until the MusicXML parses successfully. Upload a corrected file or try a different score.
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
    </div>
  )
}
