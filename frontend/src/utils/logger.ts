/**
 * Console logger with environment variable visibility
 */

export function logEnvironment() {
  const env = {
    'API URL': import.meta.env.VITE_API_URL || 'http://localhost:8000 (default)',
    'Mode': import.meta.env.MODE,
    'Dev': import.meta.env.DEV,
    'Prod': import.meta.env.PROD,
  }

  console.group('🎸 TarregaSheets Frontend Configuration')
  console.table(env)
  console.groupEnd()

  // Check if API URL is configured
  if (!import.meta.env.VITE_API_URL) {
    console.warn(
      '%c⚠️ VITE_API_URL not set - using default http://localhost:8000',
      'color: orange; font-weight: bold;'
    )
  }
}

export function logApiCall(method: string, url: string, data?: any) {
  if (import.meta.env.DEV) {
    console.group(`📡 API ${method} ${url}`)
    if (data) console.log('Data:', data)
    console.groupEnd()
  }
}

export function logApiError(method: string, url: string, error: any) {
  console.group(`❌ API Error ${method} ${url}`)
  console.error('Error:', error)
  if (error.response) {
    console.error('Response:', error.response.data)
    console.error('Status:', error.response.status)
  }
  console.groupEnd()
}
