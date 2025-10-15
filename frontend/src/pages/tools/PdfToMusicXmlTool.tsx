export default function PdfToMusicXmlTool() {
  return (
    <div className="px-4 py-6 sm:px-0">
      <h2 className="text-3xl font-bold text-gray-900 mb-2">PDF → MusicXML Converter</h2>
      <p className="text-gray-600 mb-6">
        Convert PDF sheet music to editable MusicXML format
      </p>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center mb-6">
          <div className="text-6xl mb-4">📄</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Upload PDF Sheet Music
          </h3>
          <p className="text-gray-600 mb-4">
            Drag and drop or click to select a PDF file
          </p>
          <button className="px-6 py-2 bg-primary text-white rounded-md hover:bg-primary-dark">
            Select PDF
          </button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">How it works:</h4>
          <ol className="list-decimal list-inside text-sm text-blue-700 space-y-1">
            <li>Upload your PDF sheet music file</li>
            <li>AI-powered OCR extracts musical notation</li>
            <li>Convert to editable MusicXML format</li>
            <li>Download or import directly to your library</li>
          </ol>
        </div>

        <p className="text-xs text-gray-500 mt-4">
          Note: This is a standalone tool. Converted files can be imported to your library via the Upload page.
        </p>
      </div>
    </div>
  )
}
