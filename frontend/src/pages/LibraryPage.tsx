import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { piecesApi } from '@/services/api'
import PieceCard from '@/components/Library/PieceCard'
import EditPieceModal from '@/components/Library/EditPieceModal'
import DeletePieceModal from '@/components/Library/DeletePieceModal'
import type { Piece, PieceUpdate } from '@/types/piece'

export default function LibraryPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTag, setSelectedTag] = useState<string>('')
  const [editingPiece, setEditingPiece] = useState<Piece | null>(null)
  const [deletingPiece, setDeletingPiece] = useState<Piece | null>(null)

  const queryClient = useQueryClient()

  // Fetch pieces
  const { data: pieces, isLoading, error } = useQuery({
    queryKey: ['pieces', selectedTag],
    queryFn: () => piecesApi.list({ tag: selectedTag || undefined }),
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: PieceUpdate }) => piecesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pieces'] })
      setEditingPiece(null)
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => piecesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pieces'] })
      setDeletingPiece(null)
    },
  })

  const handleEdit = (piece: Piece) => {
    setEditingPiece(piece)
  }

  const handleDelete = (piece: Piece) => {
    setDeletingPiece(piece)
  }

  const handleSaveEdit = (data: PieceUpdate) => {
    if (editingPiece) {
      updateMutation.mutate({ id: editingPiece.id, data })
    }
  }

  const handleConfirmDelete = () => {
    if (deletingPiece) {
      deleteMutation.mutate(deletingPiece.id)
    }
  }

  // Extract all unique tags from pieces
  const allTags = pieces
    ? Array.from(new Set(pieces.flatMap((p) => p.tags || [])))
    : []

  // Filter pieces by search query
  const filteredPieces = pieces?.filter((piece) => {
    const matchesSearch =
      !searchQuery ||
      piece.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      piece.composer?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesSearch
  })

  return (
    <div className="px-4 py-6 sm:px-0">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-900">Sheet Music Library</h2>
        <Link
          to="/upload"
          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark font-medium"
        >
          ＋ Upload
        </Link>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex gap-4 flex-wrap">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title or composer..."
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
            />
          </div>

          {/* Tag Filter */}
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

        {/* Active Filters */}
        {(searchQuery || selectedTag) && (
          <div className="flex gap-2 mt-3">
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

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-700">Failed to load pieces. Please try again.</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredPieces && filteredPieces.length === 0 && (
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

      {/* Pieces Grid */}
      {!isLoading && !error && filteredPieces && filteredPieces.length > 0 && (
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
                onDelete={handleDelete}
              />
            ))}
          </div>
        </>
      )}

      {/* Modals */}
      {editingPiece && (
        <EditPieceModal
          piece={editingPiece}
          isOpen={!!editingPiece}
          onClose={() => setEditingPiece(null)}
          onSave={handleSaveEdit}
          isSaving={updateMutation.isPending}
        />
      )}

      <DeletePieceModal
        piece={deletingPiece}
        isOpen={!!deletingPiece}
        onClose={() => setDeletingPiece(null)}
        onConfirm={handleConfirmDelete}
        isDeleting={deleteMutation.isPending}
      />
    </div>
  )
}
