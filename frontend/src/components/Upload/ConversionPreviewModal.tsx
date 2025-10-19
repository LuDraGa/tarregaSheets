import { useEffect, useMemo, useState } from 'react'
import type { UploadResponse } from '@/types/upload'
import { uploadApi } from '@/services/api'
import MusicXMLEditor from './MusicXMLEditor'
import ConversionPreviewCard from './ConversionPreviewCard'
import PlaybackPreviewPanel from './PlaybackPreviewPanel'
import {
  buildConversionEntries,
  buildFileUrl,
  getDefaultConversionChecks,
  getDefaultPreviewAssets,
} from './conversionPreviewHelpers'

type PreviewTab = 'statuses' | 'editor'

interface ConversionPreviewModalProps {
  uploadedFile: UploadResponse | null
  isOpen: boolean
  initialTab?: PreviewTab
  onClose: () => void
}

export default function ConversionPreviewModal({
  uploadedFile,
  isOpen,
  initialTab = 'statuses',
  onClose,
}: ConversionPreviewModalProps) {
  const [activeTab, setActiveTab] = useState<PreviewTab>(initialTab)
  const [xmlContent, setXmlContent] = useState<string>('')
  const [xmlLoading, setXmlLoading] = useState(false)
  const [xmlError, setXmlError] = useState<string | null>(null)

  const conversionChecks = useMemo(() => {
    if (!uploadedFile?.conversion_checks) return getDefaultConversionChecks()
    return {
      ...getDefaultConversionChecks(),
      ...uploadedFile.conversion_checks,
    }
  }, [uploadedFile])

  const previewAssets = useMemo(() => {
    if (!uploadedFile?.preview_assets) return getDefaultPreviewAssets()
    return {
      ...getDefaultPreviewAssets(),
      ...uploadedFile.preview_assets,
    }
  }, [uploadedFile])

  const conversionEntries = useMemo(
    () => buildConversionEntries(conversionChecks),
    [conversionChecks]
  )

  const baseMusicXmlUrl = useMemo(() => {
    return (
      buildFileUrl(previewAssets.musicxml_file_id) ||
      buildFileUrl(uploadedFile?.musicxml_file_id) ||
      buildFileUrl(uploadedFile?.original_file_id)
    )
  }, [previewAssets.musicxml_file_id, uploadedFile])

  const tabMusicXmlUrl = useMemo(
    () => buildFileUrl(previewAssets.tab_musicxml_file_id),
    [previewAssets.tab_musicxml_file_id]
  )

  const staffMusicXmlUrl = useMemo(
    () => buildFileUrl(previewAssets.staff_musicxml_file_id),
    [previewAssets.staff_musicxml_file_id]
  )

  const errorLines = useMemo(() => {
    if (!uploadedFile) return []
    const lines: number[] = []
    if (uploadedFile.parse_error_details?.line) {
      lines.push(uploadedFile.parse_error_details.line)
    }
    if (uploadedFile.midi_error_details?.line) {
      lines.push(uploadedFile.midi_error_details.line)
    }
    return lines
  }, [uploadedFile])

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab)
    }
  }, [initialTab, isOpen])

  useEffect(() => {
    if (!isOpen) {
      setXmlContent('')
      setXmlError(null)
      setXmlLoading(false)
    }
  }, [isOpen, uploadedFile?.original_file_id])

  useEffect(() => {
    const shouldLoadEditor =
      isOpen && activeTab === 'editor' && !xmlContent && !xmlLoading && !xmlError

    if (!shouldLoadEditor) return

    const fetchXml = async () => {
      if (!baseMusicXmlUrl) {
        setXmlError('No MusicXML content available for editing.')
        return
      }

      try {
        setXmlLoading(true)
        setXmlError(null)
        const response = await fetch(baseMusicXmlUrl)
        const text = await response.text()
        setXmlContent(text)
      } catch (err) {
        console.error('Failed to fetch MusicXML content:', err)
        setXmlError('Failed to load MusicXML content.')
      } finally {
        setXmlLoading(false)
      }
    }

    fetchXml()
  }, [activeTab, baseMusicXmlUrl, isOpen, xmlContent, xmlError, xmlLoading])

  if (!isOpen || !uploadedFile) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
      <div className="relative w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex flex-col gap-4 border-b border-gray-200 px-6 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Preview Workspace</h3>
            <p className="text-sm text-gray-600">
              {uploadedFile.filename} · {uploadedFile.metadata.title || 'Untitled'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('statuses')}
              className={`rounded-md px-3 py-2 text-sm font-medium ${
                activeTab === 'statuses'
                  ? 'bg-primary text-white'
                  : 'border border-gray-300 text-gray-700 hover:bg-gray-100'
              }`}
            >
              Conversion Statuses
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('editor')}
              className={`rounded-md px-3 py-2 text-sm font-medium ${
                activeTab === 'editor'
                  ? 'bg-primary text-white'
                  : 'border border-gray-300 text-gray-700 hover:bg-gray-100'
              }`}
            >
              MusicXML Editor
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-transparent px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100"
            >
              Close
            </button>
          </div>
        </div>

        <div className="max-h-[80vh] overflow-y-auto bg-gray-50 px-6 py-6">
          {activeTab === 'statuses' ? (
            <div className="space-y-6">
              <PlaybackPreviewPanel
                baseMusicXmlUrl={baseMusicXmlUrl}
                tabMusicXmlUrl={tabMusicXmlUrl}
                staffMusicXmlUrl={staffMusicXmlUrl}
              />

              <div className="grid gap-4 lg:grid-cols-2">
                {conversionEntries.map(({ key, check }) => {
                  const downloadInfo = (() => {
                    switch (key) {
                      case 'midi':
                        return {
                          fileId: previewAssets.midi_file_id || uploadedFile.midi_file_id,
                          label: 'Download MIDI',
                        }
                      case 'staff_to_tab':
                        return {
                          fileId: previewAssets.tab_musicxml_file_id,
                          label: 'Download TAB MusicXML',
                        }
                      case 'tab_to_staff':
                        return {
                          fileId: previewAssets.staff_musicxml_file_id,
                          label: 'Download Staff MusicXML',
                        }
                      case 'mxl_extract':
                        return {
                          fileId: previewAssets.musicxml_file_id || uploadedFile.musicxml_file_id,
                          label: 'Download Cleaned MusicXML',
                        }
                      default:
                        return null
                    }
                  })()

                  if (key === 'pdf_to_mxl' || key === 'image_to_musicxml') {
                    return (
                      <ConversionPreviewCard
                        key={key}
                        conversionKey={key}
                        check={check}
                        downloadFileId={downloadInfo?.fileId}
                        downloadLabel={downloadInfo?.label}
                      >
                        <p className="text-sm text-gray-600">
                          Work in progress. Once implemented, previews will appear here with
                          real-time status.
                        </p>
                      </ConversionPreviewCard>
                    )
                  }

                  return (
                    <ConversionPreviewCard
                      key={key}
                      conversionKey={key}
                      check={check}
                      downloadFileId={downloadInfo?.fileId}
                      downloadLabel={downloadInfo?.label}
                    />
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {xmlLoading && (
                <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600">
                  Loading MusicXML content…
                </div>
              )}

              {xmlError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {xmlError}
                </div>
              )}

              {xmlContent && (
                <div className="rounded-xl bg-white p-4 shadow-inner">
                  <MusicXMLEditor
                    initialContent={xmlContent}
                    errorLines={errorLines}
                    onValidate={uploadApi.validateMusicXML}
                    onSave={() => {
                      window.alert(
                        'Save functionality requires piece creation. Validate and download corrected XML, then re-upload.'
                      )
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
