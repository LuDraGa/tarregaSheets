/**
 * API client for backend communication
 */

import axios from 'axios'
import type { Piece, PieceCreate, PieceUpdate } from '@/types/piece'
import { logApiCall, logApiError } from '@/utils/logger'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    logApiCall(config.method?.toUpperCase() || 'GET', config.url || '', config.data)
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor for logging
api.interceptors.response.use(
  (response) => response,
  (error) => {
    logApiError(
      error.config?.method?.toUpperCase() || 'GET',
      error.config?.url || '',
      error
    )
    return Promise.reject(error)
  }
)

// Pieces API
export const piecesApi = {
  list: async (params?: { tag?: string; composer?: string; tuning?: string }) => {
    const response = await api.get<Piece[]>('/pieces', { params })
    return response.data
  },

  get: async (id: string) => {
    const response = await api.get<Piece>(`/pieces/${id}`)
    return response.data
  },

  create: async (data: PieceCreate) => {
    const response = await api.post<Piece>('/pieces', data)
    return response.data
  },

  update: async (id: string, data: PieceUpdate) => {
    const response = await api.put<Piece>(`/pieces/${id}`, data)
    return response.data
  },

  delete: async (id: string) => {
    await api.delete(`/pieces/${id}`)
  },

  addVersion: async (id: string, versionData: any) => {
    const response = await api.post<Piece>(`/pieces/${id}/versions`, versionData)
    return response.data
  },
}

// Upload API
export const uploadApi = {
  uploadFile: async (file: File, onProgress?: (progress: number) => void) => {
    const formData = new FormData()
    formData.append('file', file)

    const response = await api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(progress)
        }
      },
    })
    return response.data
  },
}

export default api
