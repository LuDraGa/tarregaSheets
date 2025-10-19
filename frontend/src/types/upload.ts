/**
 * Upload-related type definitions
 */

export interface ParseErrorDetails {
  line: number | null
  measure: string | null
  element: string | null
  xpath: string | null
  exception_type: string
  message: string
  suggestion: string | null
  context_lines: Array<{
    line_num: number
    content: string
  }>
}

export type ConversionStatus = 'pending' | 'success' | 'failed' | 'skipped' | 'unavailable'

export interface ConversionCheck {
  status: ConversionStatus
  duration_ms?: number
  error?: string
  reason?: string
  note?: string
}

export interface ConversionChecks {
  midi: ConversionCheck
  mxl_extract: ConversionCheck
  staff_to_tab: ConversionCheck
  tab_to_staff: ConversionCheck
  pdf_to_mxl: ConversionCheck
  image_to_musicxml: ConversionCheck
}

export interface PreviewAssets {
  musicxml_file_id: string | null
  midi_file_id: string | null
  tab_musicxml_file_id: string | null
  staff_musicxml_file_id: string | null
}

export interface UploadResponse {
  file_id: string | null
  original_file_id: string
  musicxml_file_id: string | null
  midi_file_id: string | null
  filename: string
  content_type: string
  size: number
  musicxml_url: string | null
  midi_url: string | null
  parse_status: 'pending' | 'success' | 'failed' | 'partial'
  parse_error: string | null
  parse_error_details: ParseErrorDetails | null
  midi_status: 'pending' | 'success' | 'failed' | 'partial' | 'skipped'
  midi_error: string | null
  midi_error_details: ParseErrorDetails | null
  metadata: {
    title: string
    composer: string
    tempo: number
    key: string
    time_signature: string
    has_tablature: boolean
    has_staff_notation: boolean
    notation_type: 'staff' | 'tab' | 'both'
  }
  conversion_checks: ConversionChecks
  preview_assets: PreviewAssets
}

export interface ValidationResponse {
  valid: boolean
  metadata: {
    title: string
    composer: string
    tempo: number
    key: string
    time_signature: string
    has_tablature: boolean
    has_staff_notation: boolean
    notation_type: 'staff' | 'tab' | 'both'
  } | null
  parse_error: string | null
  parse_error_details: ParseErrorDetails | null
}
