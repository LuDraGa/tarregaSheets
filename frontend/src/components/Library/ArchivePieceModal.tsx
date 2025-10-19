import type { Piece } from '@/types/piece'

interface ArchivePieceModalProps {
  piece: Piece | null
  action: 'archive' | 'unarchive'
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  isProcessing?: boolean
}

export default function ArchivePieceModal({
  piece,
  action,
  isOpen,
  onClose,
  onConfirm,
  isProcessing,
}: ArchivePieceModalProps) {
  if (!isOpen || !piece) return null

  const isArchive = action === 'archive'
  const title = isArchive ? 'Archive Piece' : 'Restore Piece'
  const primaryLabel = isProcessing ? (isArchive ? 'Archiving...' : 'Restoring...') : isArchive ? 'Archive' : 'Restore'
  const accentClasses = isArchive
    ? 'bg-amber-600 hover:bg-amber-700'
    : 'bg-green-600 hover:bg-green-700'

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full ${isArchive ? 'bg-amber-100' : 'bg-green-100'} flex items-center justify-center`}>
              <svg className={`w-6 h-6 ${isArchive ? 'text-amber-600' : 'text-green-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9V5m0 4v4m0 0h4m-4 0H8m0-9a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V6a2 2 0 00-2-2H8z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-2">
          <p className="text-gray-700">
            {isArchive ? 'Archive' : 'Restore'} <strong>"{piece.title}"</strong>
            {piece.composer && <span> by {piece.composer}</span>}?
          </p>
          <p className="text-sm text-gray-600">
            {isArchive
              ? 'The piece will move to the archive. You can restore it anytime.'
              : 'The piece will return to your active library.'}
          </p>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isProcessing}
            className={`flex-1 px-4 py-2 text-white rounded-md transition-colors disabled:opacity-50 ${accentClasses}`}
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
