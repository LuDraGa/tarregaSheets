/**
 * TypeScript types for pieces and versions
 */

export type AssetKind = 'pdf' | 'musicxml' | 'mxl' | 'midi'
export type SourceType = 'pdf' | 'musicxml' | 'mxl' | 'midi'

export interface Asset {
  id: string
  kind: AssetKind
  url: string
  filename: string
}

export interface Version {
  id: string
  piece_id: string
  source_type: SourceType
  tempo: number
  key: string
  time_signature: string
  assets: Asset[]
}

export interface Piece {
  id: string
  title: string
  composer: string
  tags: string[]
  tuning: string
  capo: number
  created_at: string
  updated_at: string
  is_archived: boolean
  archived_at: string | null
  versions: Version[]
}

export interface PieceCreate {
  title: string
  composer?: string
  tags?: string[]
  tuning?: string
  capo?: number
}

export interface PieceUpdate {
  title?: string
  composer?: string
  tags?: string[]
  tuning?: string
  capo?: number
}
