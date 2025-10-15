import { useState } from 'react'
import axios from 'axios'

interface HealthStatus {
  db: { status: string; service: string; database?: string; error?: string }
  openrouter: { status: string; service: string; model?: string; response?: string; error?: string }
}

export default function HealthCheckPage() {
  const [health, setHealth] = useState<HealthStatus>({
    db: { status: 'not_checked', service: 'mongodb' },
    openrouter: { status: 'not_checked', service: 'openrouter' },
  })
  const [loadingDb, setLoadingDb] = useState(false)
  const [loadingOr, setLoadingOr] = useState(false)

  const checkDatabase = async () => {
    setLoadingDb(true)
    try {
      const response = await axios.get('/api/health/db')
      setHealth(prev => ({ ...prev, db: response.data }))
    } catch (error: any) {
      console.error('DB health check failed:', error)
      setHealth(prev => ({
        ...prev,
        db: {
          status: 'unhealthy',
          service: 'mongodb',
          error: error.response?.data?.detail || error.response?.statusText || error.message || 'Connection failed',
        }
      }))
    } finally {
      setLoadingDb(false)
    }
  }

  const checkOpenRouter = async () => {
    setLoadingOr(true)
    try {
      const response = await axios.get('/api/health/openrouter')
      setHealth(prev => ({ ...prev, openrouter: response.data }))
    } catch (error: any) {
      console.error('OpenRouter health check failed:', error)
      setHealth(prev => ({
        ...prev,
        openrouter: {
          status: 'unhealthy',
          service: 'openrouter',
          error: error.response?.data?.detail || error.response?.statusText || error.message || 'Connection failed',
        }
      }))
    } finally {
      setLoadingOr(false)
    }
  }

  const checkAll = async () => {
    await Promise.all([checkDatabase(), checkOpenRouter()])
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-900">System Health Check</h2>
        <button
          onClick={checkAll}
          disabled={loadingDb || loadingOr}
          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary-dark disabled:opacity-50"
        >
          {loadingDb || loadingOr ? 'Checking...' : 'Check All'}
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-blue-700">
          💡 Click individual "Check" buttons to test each service separately, or use "Check All" to test everything at once.
        </p>
      </div>

      <div className="space-y-4">
        <HealthCard
          title="MongoDB Database"
          status={health.db.status}
          service={health.db.service}
          details={{
            Database: health.db.database,
            Error: health.db.error,
          }}
          onCheck={checkDatabase}
          loading={loadingDb}
        />

        <HealthCard
          title="OpenRouter API"
          status={health.openrouter.status}
          service={health.openrouter.service}
          details={{
            Model: health.openrouter.model,
            'Test Response': health.openrouter.response,
            Error: health.openrouter.error,
          }}
          onCheck={checkOpenRouter}
          loading={loadingOr}
        />
      </div>
    </div>
  )
}

interface HealthCardProps {
  title: string
  status: string
  service?: string
  details: Record<string, string | undefined>
  onCheck: () => void
  loading: boolean
}

function HealthCard({ title, status, service, details, onCheck, loading }: HealthCardProps) {
  const statusColor =
    status === 'healthy'
      ? 'bg-green-100 text-green-800'
      : status === 'unhealthy'
      ? 'bg-red-100 text-red-800'
      : status === 'not_checked'
      ? 'bg-gray-100 text-gray-600'
      : 'bg-gray-100 text-gray-800'

  const statusText = status === 'not_checked' ? 'Not Checked' : status

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
          {service && <p className="text-sm text-gray-500">{service}</p>}
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColor}`}>
            {statusText}
          </span>
          <button
            onClick={onCheck}
            disabled={loading}
            className="px-4 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {loading ? 'Checking...' : 'Check'}
          </button>
        </div>
      </div>

      {status !== 'not_checked' && (
        <dl className="space-y-2">
          {Object.entries(details).map(([key, value]) =>
            value ? (
              <div key={key} className="flex">
                <dt className="text-sm font-medium text-gray-500 w-32">{key}:</dt>
                <dd className="text-sm text-gray-900 flex-1">
                  {key === 'Error' ? (
                    <code className="text-red-600 bg-red-50 px-2 py-1 rounded text-xs block">{value}</code>
                  ) : (
                    <code className="bg-gray-50 px-2 py-1 rounded text-xs">{value}</code>
                  )}
                </dd>
              </div>
            ) : null
          )}
        </dl>
      )}
    </div>
  )
}
