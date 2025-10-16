import { MIDI_INSTRUMENTS, getInstrumentByProgram } from '@/lib/midi-instruments'

interface InstrumentSelectorProps {
  selectedInstrument: number
  onInstrumentChange: (program: number) => void
  disabled?: boolean
}

export default function InstrumentSelector({
  selectedInstrument,
  onInstrumentChange,
  disabled = false,
}: InstrumentSelectorProps) {
  const currentInstrument = getInstrumentByProgram(selectedInstrument)

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <label htmlFor="instrument" className="block text-sm font-medium text-gray-700 mb-2">
        🎹 Instrument
      </label>
      <select
        id="instrument"
        value={selectedInstrument}
        onChange={(e) => onInstrumentChange(parseInt(e.target.value))}
        disabled={disabled}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {MIDI_INSTRUMENTS.map((instrument) => (
          <option key={instrument.program} value={instrument.program}>
            {instrument.name} {instrument.category !== 'Piano' && `(${instrument.category})`}
          </option>
        ))}
      </select>
      {currentInstrument && (
        <p className="text-xs text-gray-500 mt-1">
          Category: {currentInstrument.category} • Program: {currentInstrument.program}
        </p>
      )}
    </div>
  )
}
