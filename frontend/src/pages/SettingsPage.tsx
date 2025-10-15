import { useEffect, useState } from 'react'
import { useSettingsStore } from '@/stores/settingsStore'
import axios from 'axios'
import type { AIModel, ModelsResponse } from '@/types/models'

export default function SettingsPage() {
  const { selectedModel, setSelectedModel } = useSettingsStore()
  const [models, setModels] = useState<AIModel[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchModels()
  }, [])

  const fetchModels = async () => {
    try {
      const response = await axios.get<ModelsResponse>('/api/health/models')
      setModels(response.data.models)
    } catch (error) {
      console.error('Failed to fetch models:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <h2 className="text-3xl font-bold text-gray-900 mb-6">Settings</h2>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">AI Model Selection</h3>
          <p className="text-sm text-gray-600 mb-4">
            Choose the AI model for music processing tasks. All models below are free to use.
          </p>

          {loading ? (
            <div className="text-gray-500">Loading models...</div>
          ) : (
            <div className="space-y-3">
              {models.map((model) => (
                <label
                  key={model.id}
                  className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedModel === model.id
                      ? 'border-primary bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="model"
                    value={model.id}
                    checked={selectedModel === model.id}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="mr-3"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{model.name}</div>
                    <div className="text-sm text-gray-500">{model.provider}</div>
                  </div>
                  {model.free && (
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                      FREE
                    </span>
                  )}
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Current Selection</h3>
          <div className="bg-gray-50 rounded-lg p-4">
            <code className="text-sm text-gray-700">{selectedModel}</code>
          </div>
        </div>
      </div>
    </div>
  )
}
