import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { piecesApi } from '@/services/api'
import PieceCard from '@/components/Library/PieceCard'
import EditPieceModal from '@/components/Library/EditPieceModal'
import ArchivePieceModal from '@/components/Library/ArchivePieceModal'
import type { Piece, PieceUpdate } from '@/types/piece'

type ArchivedFilter = 'false' | 'true'

export default function LibraryPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTag, setSelectedTag] = useState<string>('')
  const [archivedFilter, setArchivedFilter] = useState<ArchivedFilter>('false')
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedPieceIds, setSelectedPieceIds] = useState<string[]>([])
  const [editingPiece, setEditingPiece] = useState<Piece | null>(null)
  const [actionPiece, setActionPiece] = useState<{ piece: Piece; action: 'archive' | 'unarchive' } | null>(null)

  const queryClient = useQueryClient()
  const isViewingArchived = archivedFilter === 'true'

  const { data: pieces, isLoading, error } = useQuery({
    queryKey: ['pieces', { tag: selectedTag || null, archived: archivedFilter }],
    queryFn: () =>
      piecesApi.list({
        tag: selectedTag || undefined,
        archived: archivedFilter,
      }),
  })

  const updateMutation = useMutation<Piece, unknown, { id: string; data: PieceUpdate }>({
    mutationFn: ({ id, data }: { id: string; data: PieceUpdate }) => piecesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pieces'] })
      setEditingPiece(null)
    },
  })

  const archiveToggleMutation = useMutation<Piece, unknown, { id: string; action: 'archive' | 'unarchive' }>({
    mutationFn: ({ id, action }) =>
      action === 'archive' ? piecesApi.archive(id) : piecesApi.unarchive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pieces'] })
      setActionPiece(null)
    },
  })

  const bulkArchiveMutation = useMutation<{ updated: string[] }, unknown, { ids: string[]; action: 'archive' | 'unarchive' }>({
    mutationFn: ({ ids, action }) =>
      piecesApi.bulkArchive(ids, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pieces'] })
      setSelectedPieceIds([])
    },
  })

  const handleEdit = (piece: Piece) => {
    setEditingPiece(piece)
  }

  const handleArchiveAction = (piece: Piece) => {
    setActionPiece({ piece, action: piece.is_archived ? 'unarchive' : 'archive' })
  }

  const handleSaveEdit = (data: PieceUpdate) => {
    if (editingPiece) {
      updateMutation.mutate({ id: editingPiece.id, data })
    }
  }

  const handleConfirmArchive = () => {
    if (actionPiece) {
      archiveToggleMutation.mutate({ id: actionPiece.piece.id, action: actionPiece.action })
    }
  }

  const handleSelectionChange = (piece: Piece, nextSelected: boolean) => {
    setSelectedPieceIds((prev) => {
      if (nextSelected) {
        if (prev.includes(piece.id)) return prev
        return [...prev, piece.id]
      }
      return prev.filter((id) => id !== piece.id)
    })
  }

  const handleToggleSelectionMode = () => {
    setSelectionMode((prev) => {
      if (prev) {
        setSelectedPieceIds([])
      }
      return !prev
    })
  }

  const handleSelectAll = (ids: string[]) => {
    setSelectedPieceIds(ids)
    if (!selectionMode) {
      setSelectionMode(true)
    }
  }

  const handleClearSelection = () => {
    setSelectedPieceIds([])
  }

  const handleBulkAction = (ids: string[], action: 'archive' | 'unarchive') => {
    if (ids.length === 0) return
    bulkArchiveMutation.mutate({ ids, action })
  }

  const allTags = useMemo(
    () => (pieces ? Array.from(new Set(pieces.flatMap((p) => p.tags || []))) : []),
    [pieces]
  )

  const filteredPieces = useMemo(() => {
    if (!pieces) return []
    return pieces.filter((piece) => {
      const matchesSearch =
        !searchQuery ||
        piece.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        piece.composer?.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesSearch
    })
  }, [pieces, searchQuery])

  const filteredIds = useMemo(() => filteredPieces.map((piece) => piece.id), [filteredPieces])

  useEffect(() => {
    setSelectedPieceIds((prev) => prev.filter((id) => filteredIds.includes(id)))
  }, [filteredIds])

  useEffect(() => {
    setSelectionMode(false)
    setSelectedPieceIds([])
  }, [archivedFilter])

  const isActionModalOpen = !!actionPiece
  const selectionCount = selectedPieceIds.length
  const hasPiecesInView = filteredPieces.length > 0

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-900">Sheet Music Library</h2>
        <Link
          to="/upload"
          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark font-medium"
        >
          ＋ Upload
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="inline-flex rounded-md shadow-sm" role="group">
            <button
              type="button"
              onClick={() => setArchivedFilter('false')}
              className={`px-4 py-2 text-sm font-medium border border-gray-300 rounded-l-md ${
                !isViewingArchived ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setArchivedFilter('true')}
              className={`px-4 py-2 text-sm font-medium border border-gray-300 border-l-0 rounded-r-md ${
                isViewingArchived ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              Archived
            </button>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleToggleSelectionMode}
              disabled={!hasPiecesInView && !selectionMode}
              className={`px-4 py-2 text-sm font-medium rounded-md border ${
                selectionMode
                  ? 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-100'
              } disabled:opacity-50`}
            >
              {selectionMode ? 'Exit Selection' : 'Select Pieces'}
            </button>
            <button
              type="button"
              onClick={() => handleSelectAll(filteredIds)}
              disabled={!hasPiecesInView}
              className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              Select All In View
            </button>
          </div>
        </div>

        <div className="flex gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title or composer..."
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
            />
          </div>

          {allTags.length > 0 && (
            <div className="min-w-[150px]">
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
              >
                <option value="">All Tags</option>
                {allTags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {(searchQuery || selectedTag) && (
          <div className="flex flex-wrap gap-2 mt-3">
            {searchQuery && (
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                Search: "{searchQuery}"
                <button
                  onClick={() => setSearchQuery('')}
                  className="ml-2 text-blue-900 hover:text-blue-700"
                >
                  ×
                </button>
              </span>
            )}
            {selectedTag && (
              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                Tag: {selectedTag}
                <button
                  onClick={() => setSelectedTag('')}
                  className="ml-2 text-blue-900 hover:text-blue-700"
                >
                  ×
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {(selectionMode || selectionCount > 0) && (
        <div className="bg-white border border-amber-200 rounded-lg shadow p-4 mb-6 flex flex-wrap items-center gap-3">
          <span className="text-sm text-gray-700">
            {selectionCount} piece{selectionCount === 1 ? '' : 's'} selected
          </span>

          <button
            type="button"
            onClick={handleClearSelection}
            disabled={selectionCount === 0}
            className="px-3 py-1.5 text-sm rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-50"
          >
            Clear
          </button>

          <div className="flex gap-2 ml-auto">
            {!isViewingArchived ? (
              <>
                <button
                  type="button"
                  onClick={() => handleBulkAction(selectedPieceIds, 'archive')}
                  disabled={selectionCount === 0 || bulkArchiveMutation.isPending}
                  className="px-4 py-2 text-sm font-medium rounded-md bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
                >
                  {bulkArchiveMutation.isPending && bulkArchiveMutation.variables?.action === 'archive'
                    ? 'Archiving...'
                    : 'Archive Selected'}
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkAction(filteredIds, 'archive')}
                  disabled={filteredIds.length === 0 || bulkArchiveMutation.isPending}
                  className="px-4 py-2 text-sm font-medium rounded-md bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {bulkArchiveMutation.isPending && bulkArchiveMutation.variables?.action === 'archive'
                    ? 'Archiving All...'
                    : 'Archive All'}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleBulkAction(selectedPieceIds, 'unarchive')}
                  disabled={selectionCount === 0 || bulkArchiveMutation.isPending}
                  className="px-4 py-2 text-sm font-medium rounded-md bg-green-500 text-white hover:bg-green-600 disabled:opacity-50"
                >
                  {bulkArchiveMutation.isPending && bulkArchiveMutation.variables?.action === 'unarchive'
                    ? 'Restoring...'
                    : 'Restore Selected'}
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkAction(filteredIds, 'unarchive')}
                  disabled={filteredIds.length === 0 || bulkArchiveMutation.isPending}
                  className="px-4 py-2 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {bulkArchiveMutation.isPending && bulkArchiveMutation.variables?.action === 'unarchive'
                    ? 'Restoring All...'
                    : 'Restore All'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-700">Failed to load pieces. Please try again.</p>
        </div>
      )}

      {!isLoading && !error && filteredPieces.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          {pieces && pieces.length === 0 ? (
            <>
              <div className="text-6xl mb-4">🎼</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No pieces yet
              </h3>
              <p className="text-gray-600 mb-6">
                Upload your first MusicXML file to get started
              </p>
              <Link
                to="/upload"
                className="inline-block px-6 py-3 bg-primary text-white rounded-md hover:bg-primary-dark font-medium"
              >
                Upload Sheet Music
              </Link>
            </>
          ) : (
            <>
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No matching pieces
              </h3>
              <p className="text-gray-600 mb-4">
                Try adjusting your search or filters
              </p>
              <button
                onClick={() => {
                  setSearchQuery('')
                  setSelectedTag('')
                }}
                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 font-medium"
              >
                Clear Filters
              </button>
            </>
          )}
        </div>
      )}

      {!isLoading && !error && filteredPieces.length > 0 && (
        <>
          <div className="mb-4 text-sm text-gray-600">
            Showing {filteredPieces.length} piece{filteredPieces.length !== 1 ? 's' : ''}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredPieces.map((piece) => (
              <PieceCard
                key={piece.id}
                piece={piece}
                onEdit={handleEdit}
                onArchiveToggle={handleArchiveAction}
                selectionMode={selectionMode}
                selected={selectedPieceIds.includes(piece.id)}
                onSelectionChange={handleSelectionChange}
              />
            ))}
          </div>
        </>
      )}

      {editingPiece && (
        <EditPieceModal
          piece={editingPiece}
          isOpen={!!editingPiece}
          onClose={() => setEditingPiece(null)}
          onSave={handleSaveEdit}
          isSaving={updateMutation.isPending}
        />
      )}

      <ArchivePieceModal
        piece={actionPiece?.piece ?? null}
        action={actionPiece?.action ?? 'archive'}
        isOpen={isActionModalOpen}
        onClose={() => setActionPiece(null)}
        onConfirm={handleConfirmArchive}
        isProcessing={archiveToggleMutation.isPending}
      />
    </div>
  )
}
