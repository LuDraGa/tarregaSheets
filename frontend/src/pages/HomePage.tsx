import { Link } from 'react-router-dom'

export default function HomePage() {
  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold text-gray-900 mb-4">
          Welcome to TarregaSheets
        </h2>
        <p className="text-xl text-gray-600 mb-8">
          Your complete guitar practice platform for sheet music, playback, and transcription
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <FeatureCard
          title="Library"
          description="Browse and organize your sheet music collection"
          icon="📚"
          link="/library"
        />
        <FeatureCard
          title="Upload"
          description="Import PDF, MusicXML, or MIDI files"
          icon="📤"
          link="/upload"
        />
        <FeatureCard
          title="Practice"
          description="Practice with playback, tempo control, and A/B loops"
          icon="🎵"
          link="/library"
        />
        <FeatureCard
          title="PDF → MusicXML"
          description="Convert PDF sheet music to editable format"
          icon="📄"
          link="/tools/pdf-to-musicxml"
        />
        <FeatureCard
          title="TAB → Sheet"
          description="Convert guitar tablature to standard notation"
          icon="🎼"
          link="/tools/tab-to-sheet"
        />
        <FeatureCard
          title="Settings"
          description="Configure AI model and preferences"
          icon="⚙️"
          link="/settings"
        />
      </div>

      <div className="mt-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">
          🚀 Current Phase: Library & Practice
        </h3>
        <p className="text-blue-700">
          Import and organize sheet music, practice with intelligent playback controls, and export to various formats.
        </p>
      </div>
    </div>
  )
}

interface FeatureCardProps {
  title: string
  description: string
  icon: string
  link: string
}

function FeatureCard({ title, description, icon, link }: FeatureCardProps) {
  return (
    <Link
      to={link}
      className="block p-6 bg-white rounded-lg shadow hover:shadow-lg transition-shadow border border-gray-200"
    >
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </Link>
  )
}
