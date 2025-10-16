import { useState, useEffect } from 'react'
import type { Piece, PieceUpdate } from '@/types/piece'

interface EditPieceModalProps {
  piece: Piece
  isOpen: boolean
  onClose: () => void
  onSave: (data: PieceUpdate) => void
  isSaving?: boolean
}

export default function EditPieceModal({ piece, isOpen, onClose, onSave, isSaving }: EditPieceModalProps) {
  const [formData, setFormData] = useState<PieceUpdate>({
    title: piece.title,
    composer: piece.composer || '',
    tags: piece.tags || [],
    tuning: piece.tuning || 'EADGBE',
    capo: piece.capo || 0,
  })
  const [tagInput, setTagInput] = useState('')

  useEffect(() => {
    if (isOpen) {
      setFormData({
        title: piece.title,
        composer: piece.composer || '',
        tags: piece.tags || [],
        tuning: piece.tuning || 'EADGBE',
        capo: piece.capo || 0,
      })
    }
  }, [isOpen, piece])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags?.includes(tagInput.trim())) {
      setFormData({
        ...formData,
        tags: [...(formData.tags || []), tagInput.trim()],
      })
      setTagInput('')
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags?.filter(tag => tag !== tagToRemove) || [],
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Edit Piece</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Title *
            </label>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
            />
          </div>

          {/* Composer */}
          <div>
            <label htmlFor="composer" className="block text-sm font-medium text-gray-700 mb-1">
              Composer
            </label>
            <input
              type="text"
              id="composer"
              value={formData.composer}
              onChange={(e) => setFormData({ ...formData, composer: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
            />
          </div>

          {/* Tuning */}
          <div>
            <label htmlFor="tuning" className="block text-sm font-medium text-gray-700 mb-1">
              Tuning
            </label>
            <input
              type="text"
              id="tuning"
              value={formData.tuning}
              onChange={(e) => setFormData({ ...formData, tuning: e.target.value })}
              placeholder="EADGBE"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
            />
          </div>

          {/* Capo */}
          <div>
            <label htmlFor="capo" className="block text-sm font-medium text-gray-700 mb-1">
              Capo
            </label>
            <input
              type="number"
              id="capo"
              value={formData.capo}
              onChange={(e) => setFormData({ ...formData, capo: parseInt(e.target.value) || 0 })}
              min="0"
              max="12"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tags
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                placeholder="Add tag..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
              >
                Add
              </button>
            </div>
            {formData.tags && formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm flex items-center gap-2"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="text-blue-900 hover:text-blue-700"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !formData.title}
              className="flex-1 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
