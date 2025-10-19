import type {
  ConversionCheck,
  ConversionChecks,
  ConversionStatus,
  PreviewAssets,
} from '@/types/upload'

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const conversionLabels: Record<
  keyof ConversionChecks,
  { label: string; description: string }
> = {
  midi: { label: 'MIDI Generation', description: 'MusicXML → MIDI playback asset' },
  mxl_extract: { label: 'MXL Extraction', description: 'Decompress compressed MusicXML archive' },
  staff_to_tab: {
    label: 'Staff → Tablature',
    description: 'Generate guitar TAB from staff notation',
  },
  tab_to_staff: {
    label: 'TAB → Staff',
    description: 'Convert fret data into standard notation',
  },
  pdf_to_mxl: {
    label: 'PDF → MusicXML (WIP)',
    description: 'Optical music recognition pipeline',
  },
  image_to_musicxml: {
    label: 'Image → MusicXML (WIP)',
    description: 'Photo-based music transcription',
  },
}

export const statusStyles: Record<
  ConversionStatus,
  { icon: string; badge: string; textClass: string; borderClass: string }
> = {
  success: {
    icon: '✅',
    badge: 'bg-green-100 text-green-800',
    textClass: 'text-green-700',
    borderClass: 'border-green-200',
  },
  failed: {
    icon: '❌',
    badge: 'bg-red-100 text-red-800',
    textClass: 'text-red-700',
    borderClass: 'border-red-200',
  },
  skipped: {
    icon: '⏭️',
    badge: 'bg-gray-100 text-gray-700',
    textClass: 'text-gray-600',
    borderClass: 'border-gray-200',
  },
  pending: {
    icon: '⏳',
    badge: 'bg-blue-100 text-blue-800',
    textClass: 'text-blue-700',
    borderClass: 'border-blue-200',
  },
  unavailable: {
    icon: '🚫',
    badge: 'bg-yellow-100 text-yellow-800',
    textClass: 'text-yellow-700',
    borderClass: 'border-yellow-200',
  },
}

export const getDefaultConversionChecks = (): ConversionChecks => ({
  midi: { status: 'pending' },
  mxl_extract: { status: 'skipped', reason: 'Source not compressed (.mxl)' },
  staff_to_tab: { status: 'pending' },
  tab_to_staff: { status: 'pending' },
  pdf_to_mxl: { status: 'unavailable', note: 'Conversion not implemented yet' },
  image_to_musicxml: { status: 'unavailable', note: 'Conversion not implemented yet' },
})

export const getDefaultPreviewAssets = (): PreviewAssets => ({
  musicxml_file_id: null,
  midi_file_id: null,
  tab_musicxml_file_id: null,
  staff_musicxml_file_id: null,
})

export type ConversionEntry = {
  key: keyof ConversionChecks
  label: string
  description: string
  check: ConversionCheck
}

export const buildConversionEntries = (checks: ConversionChecks): ConversionEntry[] => {
  return (Object.keys(conversionLabels) as Array<keyof ConversionChecks>).map((key) => ({
    key,
    label: conversionLabels[key].label,
    description: conversionLabels[key].description,
    check: checks[key] ?? { status: 'pending' },
  }))
}

export const buildFileUrl = (fileId: string | null | undefined): string | null => {
  if (!fileId) return null
  return `${API_BASE_URL}/files/${fileId}`
}

export const resolveDetailText = (check: ConversionCheck): string | undefined => {
  return check.error || check.reason || check.note || undefined
}
