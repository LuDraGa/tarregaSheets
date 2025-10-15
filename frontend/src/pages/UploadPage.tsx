export default function UploadPage() {
  return (
    <div className="px-4 py-6 sm:px-0">
      <h2 className="text-3xl font-bold text-gray-900 mb-6">Upload Sheet Music</h2>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
          <div className="text-6xl mb-4">📄</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Drop files here or click to browse
          </h3>
          <p className="text-gray-600 mb-4">
            Supported formats: PDF, MusicXML (.xml), MXL, MIDI
          </p>
          <button className="px-6 py-2 bg-primary text-white rounded-md hover:bg-primary-dark">
            Select Files
          </button>
        </div>

        <p className="text-sm text-gray-500 mt-4">
          Coming soon: File upload with progress, metadata extraction, automatic parsing.
        </p>
      </div>
    </div>
  )
}
