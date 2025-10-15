import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'

// Pages
import HomePage from './pages/HomePage'
import LibraryPage from './pages/LibraryPage'
import PracticePage from './pages/PracticePage'
import UploadPage from './pages/UploadPage'
import SettingsPage from './pages/SettingsPage'
import HealthCheckPage from './pages/HealthCheckPage'

// Tools
import PdfToMusicXmlTool from './pages/tools/PdfToMusicXmlTool'
import TabToSheetTool from './pages/tools/TabToSheetTool'

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/practice/:id" element={<PracticePage />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/health" element={<HealthCheckPage />} />

            {/* Individual Tools */}
            <Route path="/tools/pdf-to-musicxml" element={<PdfToMusicXmlTool />} />
            <Route path="/tools/tab-to-sheet" element={<TabToSheetTool />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

function Navigation() {
  const location = useLocation()

  const isActive = (path: string) => {
    return location.pathname === path ? 'bg-primary text-white' : 'text-gray-700 hover:bg-gray-100'
  }

  return (
    <header className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          <Link to="/" className="flex items-center">
            <h1 className="text-2xl font-bold text-gray-900">🎸 TarregaSheets</h1>
          </Link>

          <nav className="flex space-x-4">
            <Link
              to="/"
              className={`px-3 py-2 rounded-md text-sm font-medium ${isActive('/')}`}
            >
              Home
            </Link>
            <Link
              to="/library"
              className={`px-3 py-2 rounded-md text-sm font-medium ${isActive('/library')}`}
            >
              Library
            </Link>
            <Link
              to="/upload"
              className={`px-3 py-2 rounded-md text-sm font-medium ${isActive('/upload')}`}
            >
              Upload
            </Link>

            {/* Tools Dropdown */}
            <div className="relative group">
              <button className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100">
                Tools ▾
              </button>
              <div className="absolute hidden group-hover:block bg-white shadow-lg rounded-md mt-1 py-2 w-48 z-10">
                <Link
                  to="/tools/pdf-to-musicxml"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  PDF → MusicXML
                </Link>
                <Link
                  to="/tools/tab-to-sheet"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  TAB → Sheet
                </Link>
              </div>
            </div>

            <Link
              to="/settings"
              className={`px-3 py-2 rounded-md text-sm font-medium ${isActive('/settings')}`}
            >
              Settings
            </Link>
            <Link
              to="/health"
              className={`px-3 py-2 rounded-md text-sm font-medium ${isActive('/health')}`}
            >
              Health
            </Link>
          </nav>
        </div>
      </div>
    </header>
  )
}

export default App
