import { useParams } from 'react-router-dom'

export default function PracticePage() {
  const { id } = useParams<{ id: string }>()

  return (
    <div className="px-4 py-6 sm:px-0">
      <h2 className="text-3xl font-bold text-gray-900 mb-6">Practice Mode</h2>

      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-600 mb-4">
          Practice piece ID: <code className="bg-gray-100 px-2 py-1 rounded">{id}</code>
        </p>
        <p className="text-sm text-gray-500">
          Coming soon: Sheet music viewer, playback controls, A/B loop, tempo control, metronome.
        </p>
      </div>
    </div>
  )
}
