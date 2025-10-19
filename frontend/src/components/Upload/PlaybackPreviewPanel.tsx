import { useState } from 'react'
import AlphaTabPreview from './AlphaTabPreview'
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
  const tabSource = tabMusicXmlUrl || null
  const staffSource = staffMusicXmlUrl || baseMusicXmlUrl

  const [tabCollapsed, setTabCollapsed] = useState(true)
  const [staffCollapsed, setStaffCollapsed] = useState(true)

  if (!tabSource && !staffSource) {
    return null
  }

  const focusEnabled = (tabSource ? !tabCollapsed : true) && (staffSource ? !staffCollapsed : true)

  return (
    <div className="space-y-6">
      {tabSource && staffSource && (
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => {
              if (focusEnabled) {
                setTabCollapsed(true)
                setStaffCollapsed(true)
              } else {
                if (tabSource) setTabCollapsed(false)
                if (staffSource) setStaffCollapsed(false)
              }
            }}
            className="text-xs font-semibold text-primary hover:underline"
          >
            {focusEnabled ? 'Exit Focus Mode' : 'Focus Mode'}
          </button>
        </div>
      )}

      {tabSource ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-700">Tab Playback</h4>
            <button
              type="button"
              onClick={() => setTabCollapsed((prev) => !prev)}
              className="text-xs font-medium text-primary hover:underline"
            >
              {tabCollapsed ? 'Expand' : 'Collapse to 1 bar'}
            </button>
          </div>
          <AlphaTabPreview
            musicXmlUrl={tabSource}
            collapsed={tabCollapsed}
            onToggleExpand={() => setTabCollapsed(false)}
            height={tabCollapsed ? 180 : 320}
          />
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-600">
          TAB preview unavailable — upload a MusicXML file with technical (string/fret) data or run
          the TAB conversion job to generate fingering mappings.
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
