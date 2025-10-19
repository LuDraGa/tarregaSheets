import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Piece } from '@/types/piece'

interface PieceCardProps {
  piece: Piece
  onEdit?: (piece: Piece) => void
  onArchiveToggle?: (piece: Piece) => void
  selectionMode?: boolean
  selected?: boolean
  onSelectionChange?: (piece: Piece, nextSelected: boolean) => void
}

export default function PieceCard({
  piece,
  onEdit,
  onArchiveToggle,
  selectionMode = false,
  selected = false,
  onSelectionChange,
}: PieceCardProps) {
  const navigate = useNavigate()
  const [showMenu, setShowMenu] = useState(false)
  const isArchived = piece.is_archived

  const handleClick = () => {
    if (selectionMode) {
      onSelectionChange?.(piece, !selected)
      return
    }
    navigate(`/practice/${piece.id}`)
  }

  const handleMenuClick = (e: React.MouseEvent) => {
    if (selectionMode) return
    e.stopPropagation()
    setShowMenu(!showMenu)
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowMenu(false)
    onEdit?.(piece)
  }

  const handleArchive = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowMenu(false)
    onArchiveToggle?.(piece)
  }

  const handleCheckboxToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation()
    onSelectionChange?.(piece, e.target.checked)
  }

  useEffect(() => {
    if (selectionMode) {
      setShowMenu(false)
    }
  }, [selectionMode])

  // Get first version metadata for display
  const firstVersion = piece.versions?.[0]
  const archivalBadge = isArchived ? (
    <span className="absolute top-2 left-2 px-2 py-0.5 bg-amber-500 text-white text-xs font-semibold rounded">
      Archived
    </span>
  ) : null

  return (
    <div
      onClick={handleClick}
      className={`bg-white rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer border overflow-hidden relative flex flex-col h-full ${
        isArchived ? 'border-amber-200 hover:border-amber-300' : 'border-gray-200'
      } ${selectionMode ? 'select-none' : ''} ${selected ? 'ring-2 ring-primary/60' : ''}`}
    >
      {/* Thumbnail placeholder */}
      <div className="bg-gradient-to-br from-primary/10 to-secondary/10 h-32 flex items-center justify-center relative flex-shrink-0">
        <span className="text-5xl">🎼</span>

        {archivalBadge}

        {selectionMode && (
          <div className="absolute top-2 right-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              checked={selected}
              onChange={handleCheckboxToggle}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

        {/* Menu button */}
        {!selectionMode && (
          <>
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
              <div className="absolute top-12 right-2 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 min-w-[140px]">
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
                  onClick={handleArchive}
                  className="w-full px-4 py-2 text-left text-sm text-amber-600 hover:bg-amber-50 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 0v4m0-4h4m-4 0H8m-2 6V6a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H8a2 2 0 01-2-2z" />
                  </svg>
                  {isArchived ? 'Restore' : 'Archive'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Content - flexible to take available space */}
      <div className="p-4 flex-1 flex flex-col">
        {/* Variable content section */}
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1 truncate">
            {piece.title}
          </h3>

          {piece.composer && (
            <p className="text-sm text-gray-600 mb-2">
              {piece.composer}
            </p>
          )}

          {/* Tags */}
          {piece.tags && piece.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
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
        </div>

        {/* Fixed footer section - always at bottom */}
        <div className="mt-auto pt-3 space-y-2 border-t border-gray-100">
          {/* Metadata badges */}
          <div className="flex flex-wrap gap-2">
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

          {/* Version count and tuning */}
          <div className="flex justify-between items-center text-xs text-gray-500">
            <span>{piece.tuning || 'EADGBE'}</span>
            {piece.versions && piece.versions.length > 0 && (
              <span>{piece.versions.length} version{piece.versions.length > 1 ? 's' : ''}</span>
            )}
          </div>

          {/* Dates */}
          <div className="flex justify-between items-center text-xs text-gray-500">
            <span className="flex items-center gap-1" title="Upload date">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              {new Date(piece.created_at).toLocaleDateString()}
            </span>
            <span className="flex items-center gap-1" title="Last edited">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              {new Date(piece.updated_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
