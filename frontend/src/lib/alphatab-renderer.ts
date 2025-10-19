/**
 * alphaTab-based renderer and player (all-in-one)
 * Uses alphaTab for both sheet music rendering and audio playback
 */

import { AlphaTabApi, Settings, model } from '@coderline/alphatab'

export interface AlphaTabPlayerState {
  isPlaying: boolean
  currentTime: number
  duration: number
  tempo: number
}

export type AlphaTabPlayerEventCallback = (state: AlphaTabPlayerState) => void
export interface AlphaTabMeasureBounds {
  index: number
  x: number
  y: number
  width: number
  height: number
}

export type AlphaTabDisplayMode = 'tab-only' | 'staff-only' | 'both'

export class AlphaTabRenderer {
  private api: AlphaTabApi | null = null
  private container: HTMLElement
  private displayMode: AlphaTabDisplayMode = 'staff-only' // Default to staff notation
  private _tempo = 120
  private _duration = 0
  private _baseDuration = 0
  private _currentTime = 0
  private _isPlaying = false
  private originalTempo = 120
  private playerReady = false
  private soundFontLoaded = false
  private midiRegenerating = false
  private _playbackSpeed = 1
  private masterBarTicks: number[] = []
  private currentMeasureIndex = -1
  private onMeasureChange: ((index: number) => void) | null = null
  private onRenderFinished: (() => void) | null = null

  // Event callbacks
  private onTimeUpdate: AlphaTabPlayerEventCallback | null = null
  private onPlaybackEnd: (() => void) | null = null
  private onLoad: (() => void) | null = null
  private onError: ((error: Error) => void) | null = null
  private onSoundFontProgress: ((progress: number) => void) | null = null
  private onPlayerReady: (() => void) | null = null
  private onMidiRegenerated: (() => void) | null = null

  constructor(container: HTMLElement, displayMode: AlphaTabDisplayMode = 'staff-only') {
    this.container = container
    this.displayMode = displayMode
  }

  /**
   * Get approximate duration from alphaTab score
   */
  private getApproximateDuration(): number {
    if (!this.api?.score) return 0

    // Simple estimation: count beats and divide by tempo
    const totalBeats = this.api.score.masterBars.length * 4 // Simplified assumption
    const beatsPerMinute = this._tempo
    const durationMinutes = totalBeats / beatsPerMinute
    return durationMinutes * 60 // Convert to seconds
  }

  /**
   * Initialize alphaTab with rendering and player enabled
   */
  async initialize(): Promise<void> {
    if (this.api) return

    try {
      // Configure alphaTab settings
      const settings: Settings = new Settings()
      settings.core.enableLazyLoading = false
      settings.core.useWorkers = true // Enable workers (handled by Vite plugin)

      // Point to font directory in public folder (Vite plugin copies it there)
      settings.core.fontDirectory = '/font/'

      settings.display.scale = 1.0
      settings.display.stretchForce = 0.8

      // Configure notation display - show only standard notation
      settings.notation.elements.scoreTitle = true
      settings.notation.elements.scoreWordsAndMusic = true

      // Enable beat cursor for visual playback follow
      settings.player.enablePlayer = true
      settings.player.enableCursor = true
      settings.player.enableUserInteraction = true

      // Configure SoundFont - alphaTab will load it automatically during player initialization
      settings.player.soundFont = '/soundfont/sonivox.sf2'

      // Create alphaTab API instance
      this.api = new AlphaTabApi(this.container, settings)

      // Set up event listeners
      this.setupEventListeners()

      console.log('alphaTab initialized with rendering + player')
    } catch (error) {
      console.error('Failed to initialize alphaTab:', error)
      if (this.onError) {
        this.onError(error as Error)
      }
      throw error
    }
  }

  /**
   * Set up alphaTab event listeners
   */
  private setupEventListeners() {
    if (!this.api) return

    // Player ready (SoundFont loaded and ready)
    this.api.playerReady.on(() => {
      console.log('✅ alphaTab playerReady event fired - audio enabled')
      this.playerReady = true

      if (this.onPlayerReady) {
        this.onPlayerReady()
      }
    })

    // SoundFont loading progress
    this.api.soundFontLoad.on((e) => {
      const percentage = Math.round((e.loaded / e.total) * 100)
      console.log(`⏳ SoundFont loading: ${percentage}% (${e.loaded}/${e.total} bytes)`)
      if (this.onSoundFontProgress) {
        this.onSoundFontProgress(percentage)
      }
    })

    // SoundFont loaded successfully
    this.api.soundFontLoaded.on(() => {
      console.log('✅ SoundFont loaded event fired', {
        soundFontPath: this.api?.settings?.player?.soundFont,
      })
      this.soundFontLoaded = true
      if (this.onSoundFontProgress) {
        this.onSoundFontProgress(100)
      }
    })

    // Player state changed (play/pause/stop)
    this.api.playerStateChanged.on((e) => {
      this._isPlaying = e.state === 1 // 1 = playing
      this.notifyTimeUpdate()

      if (e.stopped && this.onPlaybackEnd) {
        this.onPlaybackEnd()
      }
    })

    // Player position changed (time updates)
    this.api.playerPositionChanged.on((e) => {
      // e.currentTime is in milliseconds
      if (typeof e.currentTime === 'number' && Number.isFinite(e.currentTime) && e.currentTime >= 0) {
        this._currentTime = e.currentTime / 1000
      }
      if (typeof e.endTime === 'number' && Number.isFinite(e.endTime) && e.endTime > 0) {
        const endSeconds = e.endTime / 1000
        if (!Number.isFinite(this._baseDuration) || this._baseDuration <= 0 || this._baseDuration !== endSeconds) {
          this._baseDuration = endSeconds
          this.updateDurationForPlaybackSpeed()
        }
      }
      if (typeof e.currentTick === 'number' && Number.isFinite(e.currentTick)) {
        this.updateMeasureFromTick(e.currentTick)
      }

      this.notifyTimeUpdate()
    })

    // Score loaded
    this.api.scoreLoaded.on((score) => {
      console.log('📖 Score loaded:', score.title)

      // Configure display mode and instrument for each track
      score.tracks.forEach((track, idx) => {
        const originalProgram = track.playbackInfo.program
        const channel = track.playbackInfo.primaryChannel
        console.log(`🎸 Track ${idx}: "${track.name}", Original MIDI Program: ${originalProgram}, Channel: ${channel}`)

        // Default to Acoustic Guitar (nylon) - MIDI Program 24
        // User can change this via the instrument selector in the UI
        track.playbackInfo.program = 24
        console.log(`🎸 Track ${idx}: Set to Acoustic Guitar (nylon) - Program 24`)

        // Configure display mode for each staff in the track
        track.staves.forEach((staff, staffIdx) => {
          switch (this.displayMode) {
            case 'tab-only':
              staff.showTablature = true
              staff.showStandardNotation = false
              console.log(`🎼 Track ${idx}, Staff ${staffIdx}: Configured for TAB only`)
              break
            case 'staff-only':
              staff.showTablature = false
              staff.showStandardNotation = true
              console.log(`🎼 Track ${idx}, Staff ${staffIdx}: Configured for Staff notation only`)
              break
            case 'both':
              staff.showTablature = true
              staff.showStandardNotation = true
              console.log(`🎼 Track ${idx}, Staff ${staffIdx}: Configured for both TAB and Staff`)
              break
          }
        })
      })

      // Get tempo from score
      if (score.tempo) {
        this.originalTempo = score.tempo
        this._tempo = score.tempo
        console.log('🎵 Tempo from score:', score.tempo)
      }

      if (score.masterBars && Array.isArray(score.masterBars)) {
        this.masterBarTicks = score.masterBars.map((bar: any) => Number.isFinite(bar.start) ? bar.start : 0)
        this.masterBarTicks.sort((a, b) => a - b)
        this.currentMeasureIndex = -1
      } else {
        this.masterBarTicks = []
        this.currentMeasureIndex = -1
      }

      if (this.masterBarTicks.length > 0) {
        this.updateMeasureFromTick(0)
      }

      if (this.onLoad) {
        this.onLoad()
      }

    })

    // MIDI loaded - fires when MIDI generation completes
    this.api.midiLoaded.on((e) => {
      console.log('🎼 MIDI loaded event received:', {
        endTime: e.endTime,
        endTimeType: typeof e.endTime,
        isFinite: Number.isFinite(e.endTime),
        rawEvent: e,
      })

      // e.endTime is in milliseconds - convert to seconds
      let endSeconds = typeof e.endTime === 'number' && Number.isFinite(e.endTime) && e.endTime > 0 ? e.endTime / 1000 : 0

      // Fallback: Calculate duration from score if endTime is invalid (NaN or 0)
      if (!endSeconds && this.api?.score) {
        const score = this.api.score
        const masterBars = score.masterBars
        const tempo = this._tempo || 120

        if (masterBars && masterBars.length > 0) {
          // Calculate total duration based on bars and time signatures
          let totalTicks = 0
          for (const bar of masterBars) {
            // Each bar has a time signature (e.g., 4/4)
            // Calculate ticks for this bar based on its time signature
            const beatsPerBar = bar.timeSignatureNumerator
            const ticksPerBeat = 960 // Standard MIDI ticks per quarter note
            totalTicks += beatsPerBar * ticksPerBeat
          }

          // Convert ticks to seconds: ticks / (ticks_per_beat * beats_per_minute / 60)
          const ticksPerMinute = 960 * tempo
          endSeconds = (totalTicks / ticksPerMinute) * 60

          console.log('⚠️ MIDI endTime was invalid, calculated from score:', {
            masterBars: masterBars.length,
            totalTicks,
            tempo,
            calculatedDuration: endSeconds
          })
        }
      }

      if (Number.isFinite(endSeconds) && endSeconds > 0) {
        this._baseDuration = endSeconds
        this.updateDurationForPlaybackSpeed()
      }
      console.log('✅ MIDI loaded successfully')
      console.log('⏱️ Accurate base duration from MIDI:', this._baseDuration, 'seconds')
      console.log('⏱️ Playback-adjusted duration:', this._duration, 'seconds')

      // Check if this was a MIDI regeneration (instrument change)
      if (this.api) {
        this.api.playbackSpeed = this._playbackSpeed
      }

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

    // Rendering finished
    this.api.renderFinished.on(() => {
      console.log('✅ alphaTab rendering finished')
      if (this.onRenderFinished) {
        this.onRenderFinished()
      }
    })

    // Beat click - allows clicking on notation to seek
    this.api.beatMouseDown.on((beat) => {
      // Seek to the clicked beat's time
      if (this.api && beat) {
        console.log('🎯 Seeking to beat at', beat.absoluteDisplayStart, 'ms')
        this.api.tickPosition = beat.absoluteDisplayStart
      }
    })

    // Error handling
    this.api.error.on((error) => {
      console.error('❌ alphaTab error:', error)
      if (this.onError) {
        this.onError(error)
      }
    })
  }

  /**
   * Load MusicXML file from URL
   */
  async loadMusicXML(musicXmlUrl: string): Promise<void> {
    if (!this.api) {
      await this.initialize()
    }

    let arrayBuffer: ArrayBuffer

    try {
      // Fetch MusicXML content
      const response = await fetch(musicXmlUrl)
      arrayBuffer = await response.arrayBuffer()
    } catch (error) {
      console.error('Failed to load MusicXML:', error)
      if (this.onError) {
        this.onError(error as Error)
      }
      throw error
    }

    // Renderer might have been destroyed while fetch was in-flight
    if (!this.api) {
      console.warn('alphaTab renderer destroyed before MusicXML finished loading')
      return
    }

    // Load into alphaTab - load ALL tracks/staves
    // Pass undefined or null to load all tracks
    try {
      this.api.load(arrayBuffer)
    } catch (error) {
      console.error('alphaTab failed to parse MusicXML:', error)
      if (this.onError) {
        this.onError(error as Error)
      }
      throw error
    }
  }

  /**
   * Recalculate duration based on current playback speed
   */
  private updateDurationForPlaybackSpeed() {
    if (!Number.isFinite(this._baseDuration) || this._baseDuration <= 0) {
      this._duration = 0
      return
    }

    const playbackSpeed = Number.isFinite(this._playbackSpeed) && this._playbackSpeed > 0 ? this._playbackSpeed : 1
    this._duration = this._baseDuration / playbackSpeed
  }

  /**
   * Play
   */
  play() {
    console.log('🎵 play() called - checking state...', {
      apiInitialized: !!this.api,
      playerReady: this.playerReady,
      soundFontLoaded: this.soundFontLoaded,
      hasScore: !!this.api?.score,
      trackCount: this.api?.score?.tracks?.length || 0,
    })

    if (!this.api) {
      console.error('❌ alphaTab API not initialized')
      return
    }

    if (!this.api.score) {
      console.error('❌ No score loaded')
      return
    }

    if (!this.playerReady) {
      console.warn('⚠️ Player not ready yet - SoundFont may still be loading', {
        soundFontLoaded: this.soundFontLoaded,
      })
      // Try to play anyway - alphaTab might queue it
      console.log('Attempting to play anyway...')
    }

    console.log('▶️ Calling api.play()')
    this.api.play()
  }

  /**
   * Pause
   */
  pause() {
    if (!this.api) return
    this.api.pause()
  }

  /**
   * Stop and reset
   */
  stop() {
    if (!this.api) return
    this.api.stop()
    this._currentTime = 0
    this.notifyTimeUpdate()
  }

  /**
   * Set tempo (BPM) - adjusts playback speed
   */
  setTempo(bpm: number) {
    if (!this.api) return

    const safeTempo = Number.isFinite(bpm) && bpm > 0 ? bpm : this._tempo
    this._tempo = safeTempo

    if (this.originalTempo <= 0) {
      this.originalTempo = safeTempo > 0 ? safeTempo : 120
    }

    // Calculate playback speed as ratio to original tempo
    const rawPlaybackSpeed = safeTempo / this.originalTempo
    this._playbackSpeed = Number.isFinite(rawPlaybackSpeed) && rawPlaybackSpeed > 0 ? rawPlaybackSpeed : 1

    console.log('🎵 setTempo called:', {
      requestedBPM: bpm,
      safeTempo,
      originalTempo: this.originalTempo,
      calculatedPlaybackSpeed: this._playbackSpeed,
      currentApiPlaybackSpeed: this.api.playbackSpeed
    })

    this.api.playbackSpeed = this._playbackSpeed
    this.updateDurationForPlaybackSpeed()

    this.notifyTimeUpdate()
  }

  /**
   * Toggle metronome
   */
  toggleMetronome(enabled: boolean) {
    if (!this.api) return
    this.api.metronomeVolume = enabled ? 1.0 : 0.0
  }

  /**
   * Seek to a specific playback time (seconds)
   */
  seek(timeInSeconds: number) {
    if (!this.api) {
      console.warn('⚠️ alphaTab API not initialized')
      return
    }

    const maxTime = this._duration > 0 ? this._duration : Number.MAX_SAFE_INTEGER
    const clampedTime = Math.max(0, Math.min(timeInSeconds, maxTime))

    console.log(`🎯 Seeking to ${clampedTime.toFixed(2)}s`)

    const wasPlaying = this._isPlaying

    if (wasPlaying) {
      this.api.pause()
    }

    this._currentTime = clampedTime
    this.api.timePosition = clampedTime * 1000
    this.notifyTimeUpdate()

    if (wasPlaying) {
      setTimeout(() => {
        this.api?.play()
      }, 50)
    }
  }

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

      // Update any instrument automations so they don't revert the change
      track.staves?.forEach((staff) => {
        staff.bars?.forEach((bar) => {
          bar.voices?.forEach((voice) => {
            voice.beats?.forEach((beat) => {
              const automations = beat.automations
              if (!automations || automations.length === 0) {
                return
              }

              automations
                .filter((automation) => automation.type === model.AutomationType.Instrument && automation.value !== midiProgram)
                .forEach((automation) => {
                  console.log('    ↳ Updating automation instrument value:', automation.value, '→', midiProgram)
                  automation.value = midiProgram
                })
            })
          })
        })
      })
    })

    // Regenerate MIDI from score with new instrument settings
    // This is async - midiLoaded event will fire when done
    console.log('🔄 Regenerating MIDI with new instrument...')
    this.api.loadMidiForScore()

    // Don't log success here - wait for midiLoaded event
  }

  /**
   * Get current playback state
   */
  getState(): AlphaTabPlayerState {
    const safeCurrentTime = Number.isFinite(this._currentTime) && this._currentTime >= 0 ? this._currentTime : 0
    const safeDuration = Number.isFinite(this._duration) && this._duration >= 0 ? this._duration : 0
    const safeTempo = Number.isFinite(this._tempo) && this._tempo > 0 ? this._tempo : this.originalTempo || 120
    return {
      isPlaying: this._isPlaying,
      currentTime: safeCurrentTime,
      duration: safeDuration,
      tempo: safeTempo,
    }
  }

  /**
   * Check if player is ready (SoundFont loaded)
   */
  isPlayerReady(): boolean {
    return this.playerReady
  }

  /**
   * Check if SoundFont is loaded
   */
  isSoundFontLoaded(): boolean {
    return this.soundFontLoaded
  }

  /**
   * Check if MIDI is currently being regenerated (e.g., during instrument change)
   */
  isMidiRegenerating(): boolean {
    return this.midiRegenerating
  }

  /**
   * Notify listeners of time update
   */
  private notifyTimeUpdate() {
    if (this.onTimeUpdate) {
      this.onTimeUpdate(this.getState())
    }
  }

  private updateMeasureFromTick(tick: number) {
    if (!Number.isFinite(tick) || tick < 0) {
      return
    }
    if (!this.masterBarTicks.length) {
      if (this.currentMeasureIndex !== -1) {
        this.currentMeasureIndex = -1
        if (this.onMeasureChange) {
          this.onMeasureChange(-1)
        }
      }
      return
    }

    let nextIndex = this.masterBarTicks.length - 1
    for (let i = 0; i < this.masterBarTicks.length; i += 1) {
      const startTick = this.masterBarTicks[i]
      const nextStart = this.masterBarTicks[i + 1]
      if (typeof nextStart === 'number') {
        if (tick >= startTick && tick < nextStart) {
          nextIndex = i
          break
        }
      } else if (tick >= startTick) {
        nextIndex = i
        break
      }
    }

    if (nextIndex !== this.currentMeasureIndex) {
      this.currentMeasureIndex = nextIndex
      if (this.onMeasureChange) {
        this.onMeasureChange(nextIndex)
      }
    }
  }

  /**
   * Set time update callback
   */
  setOnTimeUpdate(callback: AlphaTabPlayerEventCallback) {
    this.onTimeUpdate = callback
  }

  /**
   * Set playback end callback
   */
  setOnPlaybackEnd(callback: () => void) {
    this.onPlaybackEnd = callback
  }

  /**
   * Set load callback
   */
  setOnLoad(callback: () => void) {
    this.onLoad = callback
  }

  /**
   * Set error callback
   */
  setOnError(callback: (error: Error) => void) {
    this.onError = callback
  }

  /**
   * Set SoundFont progress callback
   */
  setOnSoundFontProgress(callback: (progress: number) => void) {
    this.onSoundFontProgress = callback
  }

  /**
   * Set player ready callback
   */
  setOnPlayerReady(callback: () => void) {
    this.onPlayerReady = callback
  }

  /**
   * Set MIDI regeneration complete callback
   */
  setOnMidiRegenerated(callback: () => void) {
    this.onMidiRegenerated = callback
  }

  setOnMeasureChange(callback: (index: number) => void) {
    this.onMeasureChange = callback
    if (callback && this.currentMeasureIndex >= 0) {
      callback(this.currentMeasureIndex)
    }
  }

  setOnRenderFinished(callback: () => void) {
    this.onRenderFinished = callback
  }

  getMeasureBounds(): AlphaTabMeasureBounds[] {
    if (!this.api) {
      return []
    }
    const renderer: any = (this.api as any).renderer
    const lookup = renderer?.boundsLookup
    if (!lookup?.staffSystems) {
      return []
    }

    const results: AlphaTabMeasureBounds[] = []
    for (const system of lookup.staffSystems as any[]) {
      const bars = system?.bars ?? []
      for (const mb of bars) {
        const rect = mb?.realBounds ?? mb?.visualBounds
        if (!rect) continue
        results.push({
          index: typeof mb.index === 'number' ? mb.index : results.length,
          x: rect.x ?? 0,
          y: rect.y ?? 0,
          width: rect.w ?? rect.width ?? 0,
          height: rect.h ?? rect.height ?? 0,
        })
      }
    }
    results.sort((a, b) => a.index - b.index)
    return results
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.api) {
      this.api.destroy()
      this.api = null
    }
    this.masterBarTicks = []
    this.currentMeasureIndex = -1
  }
}
