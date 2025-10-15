# Phase 2: Solo Guitar → Staff + Playable TAB

**Timeline**: 6-8 weeks
**Status**: Planned (Q2 2025)

## Overview

Transcribe clean solo guitar recordings into sheet music and optimized, playable guitar tablature. This phase introduces audio processing, pitch/onset detection, and intelligent fingering solvers.

---

## v0 (Week 1-2)

### Features

- **Ingest**: WAV/MP3 upload
- **Pitch & Onset Detection**:
  - Use `basic-pitch` (Spotify's ML model) for note detection
  - Use `CREPE` for f0 refinement on sustained notes
- **Beat/Tempo Extraction**:
  - Use `librosa.beat.beat_track()` for beat detection
  - Dynamic tempo map (handle rubato)
- **Staff Build**:
  - Convert detected notes to `music21` stream
  - Export as MusicXML (time/key signatures, ties, dots)

### UX Flow

1. User uploads WAV/MP3 of solo guitar recording
2. System processes audio (show progress: "Detecting notes...")
3. Display detected notes as sheet music (OSMD)
4. User can manually correct errors (add/remove/adjust notes)
5. Save as new piece with generated staff

### API Endpoints

- `POST /transcribe` - Upload audio file for transcription
  - Request: multipart/form-data with WAV/MP3
  - Response: `{ piece_id, version_id, notes: [...], confidence: 0.0-1.0 }`
- `GET /transcribe/{job_id}/status` - Check transcription job status (async processing)

### Data Model

```python
# TranscriptionJob
{
  "id": str,
  "user_id": str,
  "audio_url": str,
  "status": Literal["pending", "processing", "completed", "failed"],
  "piece_id": str | None,  # Set after completion
  "confidence": float,     # Overall transcription confidence (0.0-1.0)
  "error": str | None,
  "created_at": datetime,
  "completed_at": datetime | None
}
```

### Quality Bar

- Note F1 ≥85% on melody test set (benchmark: 10 solo guitar recordings)
- Rhythm F1 ≥80% (±30 ms tolerance)
- Processing time <2 minutes for 3-minute recording

### Tech Stack

- **Audio Processing**: librosa, basic-pitch, CREPE
- **Backend**: Celery or RQ for async job queue
- **Storage**: Store uploaded audio in MongoDB GridFS or S3

---

## v1 (Week 3-4)

### Features

- **Fingering/TAB Solver v1 (Monophonic)**:
  - State: `(string s, fret f, position p)`
  - Cost function:
    ```
    cost = w1*Δfret + w2*string_jump + w3*position_shift + w4*stretch_penalty + w5*open_pref
    ```
  - Hard constraints:
    - `0 ≤ f ≤ 22` (fret range)
    - Reachable stretch ≤4 frets
    - Sustain-compatible positions (no overlap)
  - Algorithm: Dynamic Programming (DP) with Viterbi-like state transitions

- **Tuning/Capo Search**:
  - Score each candidate tuning from preset set:
    - Standard (EADGBE)
    - Drop D (DADGBE)
    - DADGAD
    - Eb standard
    - Open G
  - Choose (tuning, capo) that minimizes global cost

- **Interactive TAB Refinement**:
  - User can adjust capo position with slider
  - System re-solves fingering in real-time (<500 ms for 1000 notes)
  - Show "easier fingering at Capo 3" suggestions

### UX Flow

1. After transcription, system auto-generates TAB
2. Display staff + TAB side-by-side
3. Show capo slider: "Try Capo 0-7"
4. As user adjusts capo, TAB updates in real-time
5. Highlight "red" positions (high strain, stretch >4 frets)
6. User can manually override specific fingerings

### Fingering Solver Algorithm (DP)

```python
# Pseudocode
def solve_fingering(notes, tuning, capo):
    states = []  # [(string, fret, position), ...]
    dp = {}      # dp[(note_idx, state)] = (min_cost, prev_state)

    for note_idx, note in enumerate(notes):
        for state in get_reachable_states(note, tuning, capo):
            if note_idx == 0:
                dp[(note_idx, state)] = (0, None)
            else:
                min_cost = inf
                best_prev = None
                for prev_state in states[note_idx - 1]:
                    cost = transition_cost(prev_state, state, note)
                    if dp[(note_idx - 1, prev_state)][0] + cost < min_cost:
                        min_cost = dp[(note_idx - 1, prev_state)][0] + cost
                        best_prev = prev_state
                dp[(note_idx, state)] = (min_cost, best_prev)
        states.append([s for (i, s) in dp if i == note_idx])

    # Backtrack to get optimal path
    return backtrack(dp, notes)
```

### Quality Bar

- TAB has ≤3 "red" positions (high strain) per 100 notes
- Re-solve time <500 ms for 1000 notes (real-time capo adjustment)
- User testing: ≥80% of TAB positions are playable without manual edits

---

## v2 (Week 5-6)

### Features

- **Right-Hand Hints (PIMA)**:
  - Heuristics based on note direction and string reuse
  - Label fingers: `p` (thumb), `i` (index), `m` (middle), `a` (ring)
  - Editable by user

- **Vibrato/Slide/Hammer/Pull Detection**:
  - Classify near-legato onsets within Δt threshold (e.g., <50 ms)
  - Suggest ornaments (editable):
    - `~` (vibrato)
    - `/` or `\` (slide)
    - `h` (hammer-on)
    - `p` (pull-off)

- **Playback Alignment**:
  - MIDI follows detected tempo map (handles rubato)
  - Visual cursor syncs with original audio playback

### UX Enhancements

- Ornament overlay on TAB (toggle visibility)
- Right-hand fingering labels above notes
- Split playback: original audio vs synthesized MIDI (A/B compare)

### Data Model Updates

```python
# Add to Note
{
  ...
  "ornament": Literal["vibrato", "slide_up", "slide_down", "hammer", "pull"] | None,
  "right_hand_finger": Literal["p", "i", "m", "a"] | None
}
```

---

## Quality Bar

- Note F1 ≥85% on melody test set
- Rhythm F1 ≥80% (±30 ms tolerance)
- TAB playability: ≤3 "red" positions per 100 notes
- Ornament detection precision ≥70% (minimize false positives)

---

## Risks & Mitigations

### Vibrato/Ornaments → False Extra Notes

- **Risk**: Vibrato causes pitch wobble, leading to false note detections
- **Mitigation**: Use harmonic-percussive separation (librosa) + local smoothing on f0 curve

### Tuning Mis-Detection

- **Risk**: System chooses wrong tuning, making TAB unplayable
- **Mitigation**: Expose manual tuning override; re-solve fast (<500 ms for 1k notes)

### Polyphonic Complexity

- **Risk**: Fingerstyle with multiple simultaneous voices is hard
- **Mitigation**: Start with melody-only (monophonic); defer polyphonic to later v2 or Phase 2.5

### Processing Time

- **Risk**: Audio processing takes >5 minutes for long recordings
- **Mitigation**: Use async job queue (Celery/RQ); show progress bar; allow cancellation

---

## Tech Stack Additions

- **Audio Processing**:
  - `basic-pitch` (Spotify): Note detection
  - `CREPE`: Pitch refinement
  - `librosa`: Beat tracking, tempo, harmonic-percussive separation
- **Fingering Solver**: Custom DP implementation (Python)
- **Async Jobs**: Celery (with Redis) or RQ (Redis Queue)

---

## Concrete Weekly Deliverables

### Week 1
- Audio upload endpoint
- basic-pitch integration for note detection
- Display detected notes as staff (MusicXML)

### Week 2
- Beat tracking and tempo map
- Async job queue setup
- Transcription status polling

### Week 3
- Fingering solver DP implementation
- Tuning/capo search
- Generate TAB from notes

### Week 4
- Interactive capo slider with real-time re-solve
- Highlight "red" positions (high strain)
- Manual fingering override UI

### Week 5
- Right-hand fingering heuristics (PIMA)
- Ornament detection (vibrato, slide, hammer, pull)

### Week 6
- Playback alignment with tempo map
- A/B compare: original audio vs synthesized MIDI
- User testing and refinement

---

## Success Metrics

- ≥85% note F1 on benchmark test set (10 solo guitar recordings)
- TAB playability: ≤3 "red" positions per 100 notes
- Processing time <2 minutes for 3-minute recording
- User testing: ≥75% of transcriptions require ≤5 manual edits
- Design partners successfully practice with generated TAB

---

## Next Phase Prep

- Collect user feedback on ornament detection accuracy
- Benchmark polyphonic transcription (multiple simultaneous notes)
- Identify common edge cases (e.g., slides, bends, harmonics)
