export default function TabToSheetTool() {
  return (
    <div className="px-4 py-6 sm:px-0">
      <h2 className="text-3xl font-bold text-gray-900 mb-2">TAB → Sheet Music Converter</h2>
      <p className="text-gray-600 mb-6">
        Convert guitar tablature to standard music notation
      </p>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Paste Guitar Tablature
          </label>
          <textarea
            className="w-full h-64 p-4 border border-gray-300 rounded-lg font-mono text-sm"
            placeholder={`E|------------------------|
B|------------------------|
G|------------------------|
D|-------0--2--4----------|
A|--2--4------------------|
E|------------------------|

Paste your guitar TAB here...`}
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tuning
          </label>
          <select className="w-full p-2 border border-gray-300 rounded-lg">
            <option>Standard (EADGBE)</option>
            <option>Drop D (DADGBE)</option>
            <option>DADGAD</option>
            <option>Open G</option>
            <option>Custom</option>
          </select>
        </div>

        <button className="w-full px-6 py-3 bg-primary text-white rounded-md hover:bg-primary-dark">
          Convert to Sheet Music
        </button>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
          <h4 className="font-semibold text-blue-900 mb-2">Features:</h4>
          <ul className="list-disc list-inside text-sm text-blue-700 space-y-1">
            <li>Automatically detects note timing and rhythm</li>
            <li>Supports standard and alternate tunings</li>
            <li>Exports to MusicXML for further editing</li>
            <li>Preserves fingering information when available</li>
          </ul>
        </div>

        <p className="text-xs text-gray-500 mt-4">
          Note: This is a standalone tool. Converted sheets can be imported to your library via the Upload page.
        </p>
      </div>
    </div>
  )
}
