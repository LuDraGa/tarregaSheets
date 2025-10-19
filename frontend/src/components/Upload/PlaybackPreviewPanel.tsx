import { useState } from 'react'
import PracticeAnalysisDisplay from './PracticeAnalysisDisplay'
import StaffPreview from './StaffPreview'

interface PlaybackPreviewPanelProps {
  baseMusicXmlUrl: string | null
  tabMusicXmlUrl: string | null
  staffMusicXmlUrl: string | null
}

export default function PlaybackPreviewPanel({
  baseMusicXmlUrl,
  tabMusicXmlUrl,
  staffMusicXmlUrl,
}: PlaybackPreviewPanelProps) {
  const tabSource = tabMusicXmlUrl || baseMusicXmlUrl // Use base if no tab-specific version
  const staffSource = staffMusicXmlUrl || baseMusicXmlUrl

  const [staffCollapsed, setStaffCollapsed] = useState(true)

  if (!tabSource && !staffSource) {
    return null
  }

  return (
    <div className="space-y-6">

      {tabSource ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-700">Guitar Practice Insights</h4>
            <p className="text-xs text-gray-600">Note frequency, chord shapes, scale patterns, progressions</p>
          </div>
          <PracticeAnalysisDisplay musicXmlUrl={tabSource} />
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-600">
          Practice analysis unavailable — upload a MusicXML file to analyze patterns.
        </div>
      )}

      {staffSource && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-700">Sheet Music</h4>
            <button
              type="button"
              onClick={() => setStaffCollapsed((prev) => !prev)}
              className="text-xs font-medium text-primary hover:underline"
            >
              {staffCollapsed ? 'Expand' : 'Collapse to 1 bar'}
            </button>
          </div>
          <StaffPreview
            musicXmlUrl={staffSource}
            collapsed={staffCollapsed}
            onToggleExpand={() => setStaffCollapsed(false)}
            height={staffCollapsed ? 180 : 320}
          />
        </div>
      )}
    </div>
  )
}
