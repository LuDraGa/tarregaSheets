import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Piece } from '@/types/piece'

interface PieceCardProps {
  piece: Piece
  onEdit?: (piece: Piece) => void
  onDelete?: (piece: Piece) => void
}

export default function PieceCard({ piece, onEdit, onDelete }: PieceCardProps) {
  const navigate = useNavigate()
  const [showMenu, setShowMenu] = useState(false)

  const handleClick = () => {
    navigate(`/practice/${piece.id}`)
  }

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowMenu(!showMenu)
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowMenu(false)
    onEdit?.(piece)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowMenu(false)
    onDelete?.(piece)
  }

  // Get first version metadata for display
  const firstVersion = piece.versions?.[0]
  const hasTablature = firstVersion?.assets?.some(asset =>
    asset.filename?.includes('tab') || piece.versions?.[0]?.source_type === 'musicxml'
  )

  return (
    <div
      onClick={handleClick}
      className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer border border-gray-200 overflow-hidden relative"
    >
      {/* Thumbnail placeholder */}
      <div className="bg-gradient-to-br from-primary/10 to-secondary/10 h-32 flex items-center justify-center relative">
        <span className="text-5xl">🎼</span>

        {/* Menu button */}
        <button
          onClick={handleMenuClick}
          className="absolute top-2 right-2 p-2 bg-white rounded-full shadow hover:bg-gray-50 transition-colors"
          title="More options"
        >
          <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </button>

        {/* Dropdown menu */}
        {showMenu && (
          <div className="absolute top-12 right-2 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 min-w-[120px]">
            <button
              onClick={handleEdit}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </button>
            <button
              onClick={handleDelete}
              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-1 truncate">
          {piece.title}
        </h3>

        {piece.composer && (
          <p className="text-sm text-gray-600 mb-2">
            {piece.composer}
          </p>
        )}

        {/* Metadata badges */}
        <div className="flex flex-wrap gap-2 mb-3">
          {firstVersion && (
            <>
              {firstVersion.key && (
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                  {firstVersion.key}
                </span>
              )}
              {firstVersion.tempo && (
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                  {firstVersion.tempo} BPM
                </span>
              )}
              {firstVersion.time_signature && (
                <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                  {firstVersion.time_signature}
                </span>
              )}
            </>
          )}
        </div>

        {/* Tags */}
        {piece.tags && piece.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {piece.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer info */}
        <div className="flex justify-between items-center text-xs text-gray-500">
          <span>{piece.tuning || 'EADGBE'}</span>
          {piece.versions && piece.versions.length > 0 && (
            <span>{piece.versions.length} version{piece.versions.length > 1 ? 's' : ''}</span>
          )}
        </div>
      </div>
    </div>
  )
}
