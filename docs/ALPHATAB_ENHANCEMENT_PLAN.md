# alphaTab Enhancement Plan

**Date**: 2025-01-16 · **Status**: Planning Complete → Ready for Execution

---

## Executive Summary

This document provides a comprehensive plan to fix and enhance the alphaTab implementation in TarregaSheets. The alphaTab renderer currently renders sheet music successfully but has critical issues with instrument changes, playback controls, and visual feedback during playback.

**Key Issues to Address:**
1. ❌ Instrument changes don't work - sound doesn't change when selecting different MIDI instruments
2. ❌ No visual cursor - beat cursor doesn't appear during playback
3. ❌ Seek not working - clicking progress bar doesn't seek
4. ❌ Duration shows NaN - using estimates instead of actual MIDI timing
5. ❌ React double-mounting - no cleanup on unmount

---

## 1. Current State Analysis

### What Works ✅
- ✅ Sheet music rendering with standard notation
- ✅ Sticky playback controls at top of page
- ✅ SoundFont loading (Sonivox.sf2) with progress tracking
- ✅ Basic play/pause/stop functionality
- ✅ Tempo control and metronome toggle
- ✅ Database tempo override (uses DB tempo instead of file tempo)
- ✅ Default instrument set to nylon guitar (MIDI program 24)
- ✅ Vite plugin configured for Web Workers and assets
- ✅ Instrument selector UI with all 128 MIDI instruments

### What Doesn't Work ❌
- ❌ **Instrument Changes**: Dropdown changes but sound stays the same
- ❌ **Visual Cursor**: No beat cursor appears during playback
- ❌ **Seek**: Progress bar click does nothing
- ❌ **Duration**: Sometimes shows "NaN:NaN"
- ❌ **Auto-scroll**: Notation doesn't scroll with playback
- ❌ **React Cleanup**: Renderer not destroyed properly on unmount

### Current Console Behavior
```
🎸 Changing instrument to MIDI program 23
  Track 0: 24 → 23
✅ Instrument changed, MIDI regenerated
▶️ Playing
```
**But sound doesn't change** - This is the core issue.

---

## 2. Root Cause Analysis

### Issue #1: Instrument Changes Don't Work

**Current Implementation** (`alphatab-renderer.ts:296-327`):
```typescript
setInstrument(midiProgram: number) {
  if (!this.api?.score) return

  console.log(`🎸 Changing instrument to MIDI program ${midiProgram}`)

  if (this._isPlaying) {
    this.api.stop()
  }

  // Change the instrument for all tracks
  this.api.score.tracks.forEach((track, idx) => {
    const oldProgram = track.playbackInfo.program
    track.playbackInfo.program = midiProgram
    console.log(`  Track ${idx}: ${oldProgram} → ${midiProgram}`)
  })

  // Try to regenerate MIDI
  this.api.loadMidiForScore()

  console.log(`✅ Instrument changed, MIDI regenerated`)
}
```

**Root Cause:**
1. alphaTab generates MIDI **once** when score is loaded
2. Changing `track.playbackInfo.program` modifies the score object in memory
3. `loadMidiForScore()` is called but we **never wait for it to complete**
4. The synthesizer is still using the **old MIDI data** with the old instrument
5. We need to listen to the `midiLoaded` event to know when regeneration is complete

**Evidence from alphaTab Documentation:**
- `midiLoaded` event fires when MIDI generation completes
- Event provides `e.endTime` for accurate duration
- Must wait for this event before allowing playback with new instrument

**Why Current Code Fails:**
```typescript
this.api.loadMidiForScore() // Starts async MIDI regeneration
console.log(`✅ Instrument changed, MIDI regenerated`) // ❌ LIES! It's not done yet!
// User clicks play immediately → uses OLD MIDI with OLD instrument
```

### Issue #2: No Visual Cursor

**Current Implementation** (`alphatab-renderer.ts:64`):
```typescript
settings.player.enableCursor = true
```

**Root Cause:**
- Setting is enabled but alphaTab requires CSS classes to style the cursor
- Missing CSS for `.at-cursor-beat` and `.at-cursor-bar`
- Without these styles, cursor elements are invisible or unstyled

**Evidence from alphaTab Documentation:**
- Beat cursor adds `.at-cursor-beat` class to current beat
- Beat cursor adds `.at-cursor-bar` class to current bar
- Tutorial shows example CSS: background colors, borders, animations

### Issue #3: Seek Not Working

**Current Implementation** (`PracticePageAlphaTab.tsx:122-128`):
```typescript
const handleSeek = (_time: number) => {
  // alphaTab doesn't support seeking easily
  // For now, just stop and reset
  if (rendererRef.current) {
    rendererRef.current.stop()
  }
}
```

**Root Cause:**
- Not using alphaTab's built-in seek mechanism
- Should use `api.tickPosition` property for seeking
- Comment says "doesn't support seeking easily" but this is incorrect

**Evidence from alphaTab Documentation:**
- `api.tickPosition` property exists for seeking
- Takes MIDI tick value (not seconds)
- Need to convert time in seconds → MIDI ticks

### Issue #4: Duration Shows NaN

**Current Implementation** (`alphatab-renderer.ts:220-230`):
```typescript
private getApproximateDuration(): number {
  if (!this.api?.score) return 0

  // Simple estimation: count beats and divide by tempo
  const totalBeats = this.api.score.masterBars.length * 4 // ❌ Simplified assumption
  const beatsPerMinute = this._tempo
  const durationMinutes = totalBeats / beatsPerMinute
  return durationMinutes * 60 // Convert to seconds
}
```

**Root Cause:**
- Using rough estimate instead of actual MIDI duration
- Estimate fails for scores with varying time signatures
- alphaTab provides exact duration via `midiLoaded` event

**Evidence from alphaTab Documentation:**
- `midiLoaded` event has `e.endTime` property
- `endTime` is in **milliseconds** (not seconds)
- This is the authoritative duration from actual MIDI data

### Issue #5: React Double-Mounting

**Current Implementation** (`PracticePageAlphaTab.tsx:95-101`):
```typescript
// Cleanup
return () => {
  if (rendererRef.current) {
    rendererRef.current.destroy()
    rendererRef.current = null
  }
}
```

**Root Cause:**
- Cleanup runs correctly but React Strict Mode mounts components twice
- Second mount creates second renderer instance
- Both instances receive events → logs appear twice
- Not a critical bug but causes confusion in console

---

## 3. Solution Design

### Solution #1: Fix Instrument Changes with midiLoaded Event

**Technical Approach:**
1. Add `midiLoaded` event listener in `setupEventListeners()`
2. Track MIDI loading state with a flag
3. When `setInstrument()` is called:
   - Set loading state to true
   - Change track programs
   - Call `loadMidiForScore()`
   - Wait for `midiLoaded` event to fire
   - Set loading state to false
4. Disable playback controls during MIDI regeneration
5. Update UI to show "Changing instrument..." status

**Implementation Strategy:**
```typescript
// In alphatab-renderer.ts
private midiRegenerating = false
private onMidiRegenerated: (() => void) | null = null

// Event listener
this.api.midiLoaded.on((e) => {
  console.log('✅ MIDI loaded, duration:', e.endTime / 1000, 'seconds')
  this._duration = e.endTime / 1000 // Convert ms to seconds

  if (this.midiRegenerating) {
    this.midiRegenerating = false
    console.log('✅ MIDI regeneration complete with new instrument')
    if (this.onMidiRegenerated) {
      this.onMidiRegenerated()
    }
  }

  this.notifyTimeUpdate()
})

// Modified setInstrument
setInstrument(midiProgram: number) {
  if (this._isPlaying) {
    this.api.stop()
  }

  this.midiRegenerating = true

  this.api.score.tracks.forEach((track) => {
    track.playbackInfo.program = midiProgram
  })

  this.api.loadMidiForScore() // Async - will fire midiLoaded when done

  // Don't log "complete" here - wait for midiLoaded event
}

// Add getter for UI to check state
isMidiRegenerating(): boolean {
  return this.midiRegenerating
}
```

**Why This Works:**
- `loadMidiForScore()` regenerates MIDI from current score object (with new programs)
- `midiLoaded` event fires when regeneration completes
- Synthesizer picks up new MIDI data with new instruments
- UI can disable controls during regeneration to prevent race conditions

### Solution #2: Add Visual Cursor CSS

**Technical Approach:**
1. Create global CSS for alphaTab cursor classes
2. Add to `frontend/src/index.css` (loaded by all pages)
3. Style both beat and bar cursors
4. Add smooth transitions for polished UX

**Implementation Strategy:**
```css
/* alphaTab Beat Cursor Styles */
.at-cursor-beat {
  background-color: rgba(255, 200, 0, 0.3) !important;
  border-left: 2px solid rgba(255, 200, 0, 0.8) !important;
  transition: all 0.1s ease-in-out;
}

.at-cursor-bar {
  background-color: rgba(64, 150, 255, 0.1) !important;
}

/* Optional: Add slight scale effect for emphasis */
.at-cursor-beat {
  transform: scale(1.02);
}
```

**Why This Works:**
- alphaTab automatically adds these classes to DOM elements during playback
- CSS makes them visible with background colors and borders
- Yellow highlight (rgba(255, 200, 0, 0.3)) is standard for music apps
- Bar highlight (light blue) provides additional context

### Solution #3: Implement Proper Seeking

**Technical Approach:**
1. Convert time in seconds to MIDI ticks
2. Use `api.tickPosition` to seek
3. Update `handleSeek` in both renderer and UI component

**Implementation Strategy:**
```typescript
// In alphatab-renderer.ts
seek(timeInSeconds: number) {
  if (!this.api) return

  // Convert seconds to milliseconds to ticks
  // alphaTab uses tickPosition (MIDI ticks) not time
  const timeInMs = timeInSeconds * 1000

  // Use alphaTab's built-in conversion
  // tickPosition is in MIDI ticks - alphaTab handles the conversion
  // We can approximate using playbackRange if needed, but simpler approach:
  // Just set tickPosition directly - alphaTab's player handles tick->time conversion

  // Get current tick for ratio calculation
  const totalTicks = this.api.score?.masterBars[this.api.score.masterBars.length - 1]?.start || 0
  const ratio = timeInSeconds / this._duration
  const targetTick = ratio * totalTicks

  this.api.tickPosition = targetTick

  console.log(`🎯 Seeking to ${timeInSeconds}s (tick ${targetTick})`)
}
```

**Alternative Simpler Approach (Recommended):**
```typescript
// alphaTab provides timePosition in milliseconds (read-only)
// But we can use tickPosition with the player's internal conversion
seek(timeInSeconds: number) {
  if (!this.api) return

  // Simple approach: stop and start from position
  // This is more reliable than tick math
  const wasPlaying = this._isPlaying

  if (wasPlaying) {
    this.api.pause()
  }

  // Use the playerPositionChanged event data to find tick for time
  // Or simpler: use tickPosition with beatMouseDown as reference
  // Actually, let's use the score's master bar timing

  // Most reliable: Convert time to tick using tempo and score data
  const tick = this.convertTimeToTick(timeInSeconds)
  this.api.tickPosition = tick

  if (wasPlaying) {
    this.api.play()
  }
}

private convertTimeToTick(timeInSeconds: number): number {
  if (!this.api?.score) return 0

  // Use the score's master bars to find the right tick
  // Each master bar has a start tick
  const targetTimeMs = timeInSeconds * 1000
  let closestTick = 0

  // Find master bar closest to target time
  // This is approximate but works well
  const totalDurationMs = this._duration * 1000
  const ratio = targetTimeMs / totalDurationMs

  // Get last master bar's tick
  const lastBar = this.api.score.masterBars[this.api.score.masterBars.length - 1]
  const totalTicks = lastBar.start + lastBar.calculateDuration()

  closestTick = ratio * totalTicks

  return Math.floor(closestTick)
}
```

**Why This Works:**
- `api.tickPosition` is alphaTab's official seek mechanism
- Converting time → ticks using score structure ensures accuracy
- Pausing before seek prevents audio glitches

### Solution #4: Fix Duration with midiLoaded Event

**Technical Approach:**
1. Remove `getApproximateDuration()` estimation
2. Use `e.endTime` from `midiLoaded` event
3. Store duration when MIDI loads

**Implementation Strategy:**
```typescript
// In setupEventListeners() - already covered in Solution #1
this.api.midiLoaded.on((e) => {
  // e.endTime is in milliseconds
  this._duration = e.endTime / 1000 // Convert to seconds
  console.log('⏱️ Accurate duration from MIDI:', this._duration, 'seconds')

  // ... rest of midiLoaded handler

  this.notifyTimeUpdate() // Update UI with new duration
})

// Remove getApproximateDuration() calls from scoreLoaded
this.api.scoreLoaded.on((score) => {
  // ... instrument setup ...

  // DON'T set duration here - wait for midiLoaded
  // const approxDuration = this.getApproximateDuration() ❌
  // this._duration = approxDuration ❌
})
```

**Why This Works:**
- `midiLoaded` provides authoritative duration from actual MIDI data
- No more guessing based on bar count and tempo
- Handles complex time signatures and tempo changes correctly

### Solution #5: Improve React Cleanup (Optional)

**Technical Approach:**
1. Add initialization guard to prevent double-init
2. Consider removing React Strict Mode in dev (trade-off)

**Implementation Strategy:**
```typescript
// In PracticePageAlphaTab.tsx useEffect
useEffect(() => {
  if (!containerRef.current || !musicXmlAsset) return

  // Guard against double-init
  if (rendererRef.current) {
    console.log('⚠️ Renderer already initialized, skipping')
    return
  }

  // ... rest of initialization

  return () => {
    if (rendererRef.current) {
      console.log('🧹 Cleaning up alphaTab renderer')
      rendererRef.current.destroy()
      rendererRef.current = null
    }
  }
}, [musicXmlAsset])
```

**Why This Works:**
- Guard prevents double-initialization even with Strict Mode
- Strict Mode is valuable for finding bugs, so we keep it
- Log helps debug cleanup behavior

---

## 4. Execution Plan

### Phase 1: Fix Instrument Changes (HIGH PRIORITY)

**Status**: ⬜ Not Started

**Files to Modify:**
1. `frontend/src/lib/alphatab-renderer.ts`
2. `frontend/src/pages/PracticePageAlphaTab.tsx`
3. `frontend/src/components/Practice/InstrumentSelector.tsx`

**Changes:**

#### 1.1. Add midiLoaded Event Handler (`alphatab-renderer.ts:89-192`)

**Location**: In `setupEventListeners()` method

**Add after `scoreLoaded` event handler:**
```typescript
// MIDI loaded - fires when MIDI generation completes
this.api.midiLoaded.on((e) => {
  // e.endTime is in milliseconds - convert to seconds
  this._duration = e.endTime / 1000
  console.log('✅ MIDI loaded successfully')
  console.log('⏱️ Accurate duration from MIDI:', this._duration, 'seconds')

  // Check if this was a MIDI regeneration (instrument change)
  if (this.midiRegenerating) {
    this.midiRegenerating = false
    console.log('✅ MIDI regeneration complete - new instrument ready')

    // Notify UI that instrument change is complete
    if (this.onMidiRegenerated) {
      this.onMidiRegenerated()
    }
  }

  // Update UI with new duration
  this.notifyTimeUpdate()
})
```

**Reasoning**: This event is fired whenever alphaTab finishes generating/regenerating MIDI. We need this to know when instrument changes are complete and to get accurate duration.

#### 1.2. Add MIDI Regeneration State (`alphatab-renderer.ts:17-35`)

**Location**: Add new private properties in class

**Add after existing private properties:**
```typescript
private midiRegenerating = false
private onMidiRegenerated: (() => void) | null = null
```

**Reasoning**: We need to track when MIDI is being regenerated so we can disable playback controls and notify the UI when it's done.

#### 1.3. Modify setInstrument Method (`alphatab-renderer.ts:296-327`)

**Location**: Replace entire `setInstrument()` method

**Replace with:**
```typescript
/**
 * Change the MIDI instrument for all tracks
 * This regenerates the MIDI with the new instrument
 */
setInstrument(midiProgram: number) {
  if (!this.api?.score) {
    console.warn('⚠️ No score loaded, cannot change instrument')
    return
  }

  console.log(`🎸 Starting instrument change to MIDI program ${midiProgram}`)

  // Stop playback first
  if (this._isPlaying) {
    console.log('⏸️ Stopping playback for instrument change')
    this.api.stop()
  }

  // Set flag to track regeneration
  this.midiRegenerating = true

  // Change the instrument for all tracks in the score object
  this.api.score.tracks.forEach((track, idx) => {
    const oldProgram = track.playbackInfo.program
    track.playbackInfo.program = midiProgram
    console.log(`  Track ${idx}: Program ${oldProgram} → ${midiProgram}`)
  })

  // Regenerate MIDI from score with new instrument settings
  // This is async - midiLoaded event will fire when done
  console.log('🔄 Regenerating MIDI with new instrument...')
  this.api.loadMidiForScore()

  // Don't log success here - wait for midiLoaded event
}
```

**Reasoning**: This properly tracks the async MIDI regeneration process and doesn't falsely claim success before regeneration completes.

#### 1.4. Add Getter for MIDI Regeneration State (`alphatab-renderer.ts:340-355`)

**Location**: Add after `isSoundFontLoaded()` method

**Add new method:**
```typescript
/**
 * Check if MIDI is currently being regenerated (e.g., during instrument change)
 */
isMidiRegenerating(): boolean {
  return this.midiRegenerating
}
```

**Reasoning**: UI components need to know when MIDI is regenerating so they can disable controls.

#### 1.5. Add Callback Setter (`alphatab-renderer.ts:395-405`)

**Location**: Add after `setOnPlayerReady()` method

**Add new method:**
```typescript
/**
 * Set MIDI regeneration complete callback
 */
setOnMidiRegenerated(callback: () => void) {
  this.onMidiRegenerated = callback
}
```

**Reasoning**: UI needs to be notified when instrument change completes.

#### 1.6. Remove Approximate Duration from scoreLoaded (`alphatab-renderer.ts:137-169`)

**Location**: In `scoreLoaded` event handler

**Remove these lines:**
```typescript
// Get duration from alphaTab's internal calculation
// Note: This might not be available immediately, will be updated by playerPositionChanged
const approxDuration = this.getApproximateDuration()
this._duration = approxDuration
console.log('⏱️ Estimated duration:', approxDuration, 'seconds')
```

**Reasoning**: We now get accurate duration from `midiLoaded` event, so we don't need the estimate anymore.

#### 1.7. Update PracticePageAlphaTab State (`PracticePageAlphaTab.tsx:24-26`)

**Location**: Add new state variable

**Add after `soundFontProgress` state:**
```typescript
const [isMidiRegenerating, setIsMidiRegenerating] = useState(false)
```

**Reasoning**: UI needs to track MIDI regeneration state to show loading indicator.

#### 1.8. Add MIDI Regeneration Callback (`PracticePageAlphaTab.tsx:82-86`)

**Location**: In useEffect after `setOnPlayerReady` callback

**Add:**
```typescript
renderer.setOnMidiRegenerated(() => {
  console.log('✅ Instrument change complete!')
  setIsMidiRegenerating(false)
})
```

**Reasoning**: Update UI state when instrument change completes.

#### 1.9. Update handleInstrumentChange (`PracticePageAlphaTab.tsx:144-149`)

**Location**: Replace entire function

**Replace with:**
```typescript
const handleInstrumentChange = (program: number) => {
  setSelectedInstrument(program)
  setIsMidiRegenerating(true) // Show loading state
  if (rendererRef.current) {
    rendererRef.current.setInstrument(program)
  }
}
```

**Reasoning**: Set loading state when instrument change starts.

#### 1.10. Disable Controls During Regeneration (`PracticePageAlphaTab.tsx:282-290`)

**Location**: Update Transport component disabled prop

**Change from:**
```typescript
disabled={!isPlayerReady}
```

**Change to:**
```typescript
disabled={!isPlayerReady || isMidiRegenerating}
```

**Reasoning**: Prevent playback while MIDI is regenerating.

#### 1.11. Add Instrument Change Loading Indicator (`PracticePageAlphaTab.tsx:275-276`)

**Location**: Add before playback controls section

**Add:**
```typescript
{/* Instrument change loading indicator */}
{isMidiRegenerating && (
  <div className="mb-6 bg-purple-50 border border-purple-200 rounded-lg p-4">
    <div className="flex items-center gap-3">
      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>
      <p className="text-sm text-purple-700">
        🎸 Changing instrument and regenerating audio...
      </p>
    </div>
  </div>
)}
```

**Reasoning**: Give user feedback that instrument is changing.

#### 1.12. Update InstrumentSelector Disabled State (`InstrumentSelector.tsx:16-21`)

**Location**: Update select element

**Add disabled prop:**
```typescript
interface InstrumentSelectorProps {
  selectedInstrument: number
  onInstrumentChange: (program: number) => void
  disabled?: boolean // Add this
}

export default function InstrumentSelector({
  selectedInstrument,
  onInstrumentChange,
  disabled = false // Add this
}: InstrumentSelectorProps) {
  // ...

  return (
    <select
      id="instrument"
      value={selectedInstrument}
      onChange={(e) => onInstrumentChange(parseInt(e.target.value))}
      disabled={disabled} // Add this
      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
    >
```

**And update usage in PracticePageAlphaTab.tsx:**
```typescript
<InstrumentSelector
  selectedInstrument={selectedInstrument}
  onInstrumentChange={handleInstrumentChange}
  disabled={isMidiRegenerating} // Add this
/>
```

**Reasoning**: Prevent changing instruments while regeneration is in progress.

**Testing Checklist:**
- [ ] Select different instrument from dropdown
- [ ] Verify "Changing instrument..." message appears
- [ ] Verify controls are disabled during change
- [ ] Verify sound changes when regeneration completes
- [ ] Verify console shows "MIDI regeneration complete"
- [ ] Try multiple instrument changes in sequence

---

### Phase 2: Add Visual Cursor (MEDIUM PRIORITY)

**Status**: ⬜ Not Started

**Files to Modify:**
1. `frontend/src/index.css`

**Changes:**

#### 2.1. Add alphaTab Cursor CSS (`index.css`)

**Location**: Add at the end of the file

**Add:**
```css
/* ========================================
   alphaTab Beat Cursor Styles
   ======================================== */

/**
 * Beat cursor - highlights the currently playing beat
 * alphaTab adds .at-cursor-beat class to the active beat element
 */
.at-cursor-beat {
  background-color: rgba(255, 200, 0, 0.35) !important;
  border-left: 3px solid rgba(255, 200, 0, 0.9) !important;
  transition: all 0.08s ease-in-out;
  cursor: pointer;
}

/**
 * Bar cursor - highlights the currently playing bar
 * alphaTab adds .at-cursor-bar class to the active bar element
 */
.at-cursor-bar {
  background-color: rgba(64, 150, 255, 0.08) !important;
}

/**
 * Optional: Add subtle scale effect for emphasis
 */
.at-cursor-beat {
  transform: scale(1.01);
}

/**
 * Optional: Smooth animation when cursor moves between beats
 */
.at-cursor-beat {
  animation: beatPulse 0.1s ease-in-out;
}

@keyframes beatPulse {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.02);
  }
  100% {
    transform: scale(1.01);
  }
}
```

**Reasoning**: alphaTab automatically adds these CSS classes to DOM elements during playback. By styling them, we make the cursor visible. The yellow highlight is standard in music notation apps (similar to highlighting in text). The animation provides smooth visual feedback.

**Testing Checklist:**
- [ ] Start playback and verify yellow highlight appears on current beat
- [ ] Verify highlight moves smoothly across the staff
- [ ] Verify bar has subtle blue background
- [ ] Verify animation is smooth, not janky
- [ ] Test on long pieces to ensure cursor is always visible

---

### Phase 3: Implement Seeking (MEDIUM PRIORITY)

**Status**: ⬜ Not Started

**Files to Modify:**
1. `frontend/src/lib/alphatab-renderer.ts`
2. `frontend/src/pages/PracticePageAlphaTab.tsx`

**Changes:**

#### 3.1. Add Time-to-Tick Conversion (`alphatab-renderer.ts`)

**Location**: Add new private method after `getApproximateDuration()`

**Add:**
```typescript
/**
 * Convert time in seconds to MIDI tick position
 * Uses score structure for accurate conversion
 */
private convertTimeToTick(timeInSeconds: number): number {
  if (!this.api?.score) return 0

  const targetTimeMs = timeInSeconds * 1000
  const totalDurationMs = this._duration * 1000

  if (totalDurationMs === 0) return 0

  // Calculate ratio of target time to total duration
  const ratio = targetTimeMs / totalDurationMs

  // Get total ticks from last master bar
  const lastBar = this.api.score.masterBars[this.api.score.masterBars.length - 1]
  if (!lastBar) return 0

  const totalTicks = lastBar.start + lastBar.calculateDuration()

  // Calculate target tick
  const targetTick = ratio * totalTicks

  return Math.floor(targetTick)
}
```

**Reasoning**: alphaTab uses MIDI ticks for positioning, not seconds. We need to convert user's time (from progress bar) to ticks using the score's timing structure.

#### 3.2. Implement Seek Method (`alphatab-renderer.ts`)

**Location**: Add new public method after `toggleMetronome()`

**Add:**
```typescript
/**
 * Seek to a specific time in seconds
 */
seek(timeInSeconds: number) {
  if (!this.api) {
    console.warn('⚠️ alphaTab API not initialized')
    return
  }

  // Clamp time to valid range
  const clampedTime = Math.max(0, Math.min(timeInSeconds, this._duration))

  // Convert time to MIDI tick
  const targetTick = this.convertTimeToTick(clampedTime)

  console.log(`🎯 Seeking to ${clampedTime.toFixed(2)}s (tick ${targetTick})`)

  // Remember if we were playing
  const wasPlaying = this._isPlaying

  // Pause if playing (prevents audio glitch)
  if (wasPlaying) {
    this.api.pause()
  }

  // Set new position
  this.api.tickPosition = targetTick

  // Update internal state
  this._currentTime = clampedTime
  this.notifyTimeUpdate()

  // Resume playback if we were playing
  if (wasPlaying) {
    // Small delay to let position settle
    setTimeout(() => {
      this.api!.play()
    }, 50)
  }
}
```

**Reasoning**:
- Convert seconds → ticks using score structure
- Pause before seeking to prevent audio glitches
- Resume playback if we were playing
- Small delay ensures position is set before resuming

#### 3.3. Update handleSeek in PracticePageAlphaTab (`PracticePageAlphaTab.tsx:122-128`)

**Location**: Replace entire function

**Replace:**
```typescript
const handleSeek = (_time: number) => {
  // alphaTab doesn't support seeking easily
  // For now, just stop and reset
  if (rendererRef.current) {
    rendererRef.current.stop()
  }
}
```

**With:**
```typescript
const handleSeek = (time: number) => {
  if (rendererRef.current) {
    rendererRef.current.seek(time)
  }
}
```

**Reasoning**: Now we properly seek instead of just stopping.

**Testing Checklist:**
- [ ] Click progress bar at 25%, 50%, 75% positions
- [ ] Verify playback jumps to correct position
- [ ] Verify cursor moves to correct beat
- [ ] Test seeking while playing - should continue playing
- [ ] Test seeking while paused - should stay paused
- [ ] Test seeking to 0:00 (beginning)
- [ ] Test seeking near end of piece

---

### Phase 4: React Cleanup Improvement (LOW PRIORITY)

**Status**: ⬜ Not Started

**Files to Modify:**
1. `frontend/src/pages/PracticePageAlphaTab.tsx`

**Changes:**

#### 4.1. Add Initialization Guard (`PracticePageAlphaTab.tsx:39-102`)

**Location**: At the start of useEffect

**Change from:**
```typescript
useEffect(() => {
  if (!containerRef.current || !musicXmlAsset) return

  // Initialize alphaTab renderer
  const renderer = new AlphaTabRenderer(containerRef.current)
```

**Change to:**
```typescript
useEffect(() => {
  if (!containerRef.current || !musicXmlAsset) return

  // Guard against double-initialization (React Strict Mode)
  if (rendererRef.current) {
    console.log('⚠️ Renderer already initialized, skipping')
    return
  }

  console.log('🎵 Initializing alphaTab renderer')

  // Initialize alphaTab renderer
  const renderer = new AlphaTabRenderer(containerRef.current)
```

**Reasoning**: Prevents double-initialization in React Strict Mode. Strict Mode is valuable for finding bugs, so we keep it enabled but guard against double-init.

#### 4.2. Improve Cleanup Logging (`PracticePageAlphaTab.tsx:95-101`)

**Location**: In useEffect cleanup function

**Change from:**
```typescript
// Cleanup
return () => {
  if (rendererRef.current) {
    rendererRef.current.destroy()
    rendererRef.current = null
  }
}
```

**Change to:**
```typescript
// Cleanup
return () => {
  if (rendererRef.current) {
    console.log('🧹 Cleaning up alphaTab renderer')
    rendererRef.current.destroy()
    rendererRef.current = null
  }
}
```

**Reasoning**: Makes cleanup visible in console for debugging.

**Testing Checklist:**
- [ ] Navigate to practice page, verify single initialization log
- [ ] Navigate away, verify cleanup log
- [ ] Navigate back, verify new initialization
- [ ] Check console for no duplicate event logs

---

## 5. Implementation Order

**Recommended sequence:**

1. **Phase 1: Fix Instrument Changes** (30-45 minutes)
   - This is the most critical issue
   - Blocks user from exploring different sounds
   - Requires careful event handling

2. **Phase 2: Add Visual Cursor** (5-10 minutes)
   - Quick win with high visual impact
   - Just CSS, no logic changes
   - Significantly improves UX

3. **Phase 3: Implement Seeking** (15-20 minutes)
   - Medium complexity
   - Requires tick conversion logic
   - Nice-to-have but not critical

4. **Phase 4: React Cleanup** (5 minutes)
   - Low priority polish
   - Doesn't affect functionality
   - Reduces console noise

**Total estimated time: 60-80 minutes**

---

## 6. Testing Strategy

### Manual Testing Checklist

After each phase, test:

**Basic Functionality:**
- [ ] Sheet music renders correctly
- [ ] Play/pause/stop buttons work
- [ ] Tempo control works
- [ ] Metronome toggle works

**Phase 1 - Instrument Changes:**
- [ ] Select nylon guitar - verify guitar sound
- [ ] Select piano - verify piano sound
- [ ] Select violin - verify violin sound
- [ ] Try 5-6 different instruments
- [ ] Verify controls disable during change
- [ ] Verify loading message appears
- [ ] Verify sound actually changes

**Phase 2 - Visual Cursor:**
- [ ] Start playback
- [ ] Verify yellow beat highlight appears
- [ ] Verify highlight moves with playback
- [ ] Verify smooth animation
- [ ] Test on multi-page piece

**Phase 3 - Seeking:**
- [ ] Click progress bar at various positions
- [ ] Verify playback jumps correctly
- [ ] Verify cursor moves to correct beat
- [ ] Test seeking while playing
- [ ] Test seeking while paused

**Phase 4 - Cleanup:**
- [ ] Navigate to practice page
- [ ] Verify single initialization
- [ ] Navigate away and back
- [ ] Check console for clean logs

### Edge Cases to Test

1. **Rapid instrument changes** - Change instrument multiple times quickly
2. **Seeking during instrument change** - Try to seek while MIDI is regenerating
3. **Large files** - Test with piece >5 minutes
4. **Tempo changes** - Change tempo then change instrument
5. **Network issues** - Test with slow network (for SoundFont loading)

---

## 7. Success Criteria

**Phase 1 Complete:**
- ✅ Instrument selector dropdown works
- ✅ Sound changes when selecting different instruments
- ✅ Console shows "MIDI regeneration complete"
- ✅ No errors in console
- ✅ Controls disable during regeneration
- ✅ Loading message appears

**Phase 2 Complete:**
- ✅ Yellow beat cursor appears during playback
- ✅ Cursor moves smoothly across staff
- ✅ Light blue bar cursor visible
- ✅ Cursor visible on all pieces

**Phase 3 Complete:**
- ✅ Clicking progress bar seeks to correct position
- ✅ Playback continues if it was playing
- ✅ Cursor jumps to correct beat
- ✅ No audio glitches when seeking

**Phase 4 Complete:**
- ✅ Single initialization log on mount
- ✅ Clean console output (no duplicates)
- ✅ Proper cleanup on unmount

**Overall Success:**
- ✅ All 128 MIDI instruments work correctly
- ✅ Visual feedback during playback is excellent
- ✅ Seeking works smoothly
- ✅ No console errors or warnings
- ✅ Professional, polished UX

---

## 8. Documentation References

**alphaTab Official Docs:**
- Main docs: https://alphatab.net/docs/introduction
- API Reference: https://alphatab.net/docs/reference/api
- Player Guide: https://alphatab.net/docs/guides/player-guide
- Events: https://alphatab.net/docs/reference/api/events

**Key API Methods Used:**
- `loadMidiForScore()` - Regenerate MIDI from score object
- `tickPosition` - Set/get playback position in MIDI ticks
- `midiLoaded` event - Fires when MIDI generation completes
- `playerPositionChanged` event - Fires during playback with position updates

**MIDI Specification:**
- General MIDI Level 1: https://www.midi.org/specifications
- Programs 0-127 are standardized instruments
- Program changes affect synthesizer voice

---

## 9. Known Limitations

1. **Instrument changes stop playback** - By design, to avoid audio glitches
2. **MIDI ticks are approximate** - Conversion from time → ticks uses ratios
3. **No per-track instrument changes** - Changes affect all tracks simultaneously
4. **SoundFont quality** - Limited by Sonivox.sf2 sample quality
5. **No real-time audio effects** - No reverb, EQ, etc. (alphaTab limitation)

---

## 10. Future Enhancements (Out of Scope)

- [ ] Per-track instrument selection
- [ ] Looping (A-B repeat)
- [ ] Slow-down without pitch change
- [ ] Volume control per instrument
- [ ] Custom SoundFont selection
- [ ] MIDI export with instrument changes
- [ ] Audio effects (reverb, EQ)
- [ ] Karaoke mode (lyrics sync)

---

## Execution Status

**Phase 1: Fix Instrument Changes**
- [ ] 1.1 Add midiLoaded event handler
- [ ] 1.2 Add MIDI regeneration state
- [ ] 1.3 Modify setInstrument method
- [ ] 1.4 Add getter for regeneration state
- [ ] 1.5 Add callback setter
- [ ] 1.6 Remove approximate duration
- [ ] 1.7 Update PracticePageAlphaTab state
- [ ] 1.8 Add MIDI regeneration callback
- [ ] 1.9 Update handleInstrumentChange
- [ ] 1.10 Disable controls during regeneration
- [ ] 1.11 Add loading indicator
- [ ] 1.12 Update InstrumentSelector disabled state
- [ ] Testing complete

**Phase 2: Add Visual Cursor**
- [ ] 2.1 Add alphaTab cursor CSS
- [ ] Testing complete

**Phase 3: Implement Seeking**
- [ ] 3.1 Add time-to-tick conversion
- [ ] 3.2 Implement seek method
- [ ] 3.3 Update handleSeek
- [ ] Testing complete

**Phase 4: React Cleanup**
- [ ] 4.1 Add initialization guard
- [ ] 4.2 Improve cleanup logging
- [ ] Testing complete

---

## Notes

- This plan assumes backend API (MusicXML files, MongoDB) is working correctly
- SoundFont file (sonivox.sf2) must be in `/public/soundfont/` directory
- alphaTab fonts must be in `/public/font/` directory (handled by Vite plugin)
- All console logs use emoji prefixes for easy scanning
- Error handling is defensive - checks for null/undefined before accessing API

---

**Ready to execute? Start with Phase 1!**
