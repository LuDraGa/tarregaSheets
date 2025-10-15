# Phase 1: Library + Practice (PDF/MXL/MusicXML → Playable Staff & TAB)

**Timeline**: 6-8 weeks
**Status**: In Progress

## Overview

Build a comprehensive guitar sheet music library and practice platform. Users can import PDF, MusicXML, and MXL files, organize them into pieces and versions, and practice with intelligent playback controls.

---

## v0 (Week 1-2)

### Features

- **Import**: PDF (single-page & multi-page), MusicXML/MXL
- **Render**: Staff notation via OpenSheetMusicDisplay (OSMD)
- **Playback**:
  - MIDI synthesis with metronome
  - A/B loop selection for focused practice
  - Tempo control (50-150%)
  - Count-in (1-2 bars)
- **Project Model**:
  - Piece → Versions → Assets (PDF/MXL/MusicXML/MIDI)
  - Tags, tuning, capo position
- **Export**: MIDI, MusicXML

### UX Flow

1. User creates "New Piece"
2. Drops file(s) (PDF/MXL/MusicXML)
3. System auto-parses and displays staff notation
4. Transport bar appears with play/pause, A/B markers, tempo slider
5. User saves piece with metadata (title, composer, tags)

### Data Models

```python
# Piece
{
  "id": str,
  "title": str,
  "composer": str,
  "tags": List[str],          # e.g., ["classical", "fingerstyle", "advanced"]
  "tuning": str,              # e.g., "EADGBE"
  "capo": int,                # 0-12
  "created_at": datetime
}

# Version
{
  "id": str,
  "piece_id": str,
  "source_type": Literal["pdf", "musicxml", "mxl", "midi"],
  "tempo": int,               # BPM
  "key": str,                 # e.g., "C", "Em"
  "time_signature": str       # e.g., "4/4", "3/4"
}

# Asset
{
  "id": str,
  "version_id": str,
  "kind": Literal["pdf", "musicxml", "mxl", "midi"],
  "url": str,                 # MongoDB GridFS URL or S3
  "filename": str
}

# PracticeStat
{
  "piece_id": str,
  "user_id": str,
  "bar_id": int,              # Which bar/measure
  "seconds_played": float,
  "avg_tempo": int,           # Average tempo during this session
  "last_played_at": datetime
}
```

### API Endpoints

- `POST /pieces` - Create new piece
- `GET /pieces` - List all pieces (with filters: tag, composer, tuning)
- `GET /pieces/{id}` - Get piece details with versions
- `PUT /pieces/{id}` - Update piece metadata
- `DELETE /pieces/{id}` - Delete piece
- `POST /pieces/{id}/versions` - Add new version
- `POST /upload` - Upload PDF/MusicXML/MXL file
- `GET /pieces/{id}/practice-stats` - Get practice statistics

### Quality Bar

- Loads 95% of MXL/MusicXML without fatal errors
- Click + spacebar controls responsive <50 ms
- Playback sync with visual cursor on sheet music

### Tech Stack

- **Backend**: FastAPI, Motor (MongoDB), music21 (MusicXML parsing), mido (MIDI)
- **Frontend**: React, TypeScript, Vite, Tailwind, OSMD, Tone.js
- **Storage**: MongoDB GridFS (uploaded files)

---

## v1 (Week 3-4)

### Features

- **TAB Preview (Read-Only)**: Generate naive guitar tablature from pitches
  - Algorithm: pitch → (string, fret) mapping without position optimization
  - Display alongside staff notation
- **Sections**: Auto phrase/bar markers based on MusicXML structure
  - Quick-jump palette to navigate to specific sections
- **Annotation**:
  - Bookmarks per bar (flagged for practice)
  - Notes per bar (user annotations)

### UX Enhancements

- Split view: Staff on top, TAB on bottom (toggleable)
- Section markers overlay on transport bar
- Annotation sidebar for notes and bookmarks

### Data Model Updates

```python
# Add to Piece
{
  ...
  "annotations": List[{
    "bar_id": int,
    "note": str,
    "bookmark": bool
  }]
}
```

### Optional: PDF OCR

- Run staffline detection for scanned PDFs
- Allow manual bar alignment if OCR fails
- Library: `pdf2image` + OMR model (or punt to Phase 2)

---

## v2 (Week 5-6)

### Features

- **Editable Score Basics**:
  - Transpose (±12 semitones)
  - Re-beam rhythms (change note grouping)
  - Quantize grid (1/8, 1/16, 1/32 note snapping)
- **Practice Coach**:
  - Per-bar practice targets (e.g., "play this bar 10 times at 80 BPM")
  - Streak tracking (consecutive days practiced)
  - Time-in-bar heatmap (visualize which bars need more practice)
- **Backups & Versions**:
  - Diff between edits (show what changed)
  - Rollback to previous version

### UX Flow: Practice Coach

1. User selects bars to practice (multi-select)
2. Sets target: repetitions + tempo
3. System tracks completions and displays progress
4. Heatmap visualizes time spent per bar

### Data Model Updates

```python
# PracticeTarget
{
  "piece_id": str,
  "user_id": str,
  "bar_ids": List[int],
  "target_reps": int,
  "target_tempo": int,
  "completed_reps": int,
  "created_at": datetime
}
```

---

## Cross-Cutting Primitives

### Internal Score JSON (Canonical Format)

All music files (MusicXML, MIDI, PDF OCR) convert to this internal JSON for consistent processing:

```json
{
  "meta": {
    "title": "Asturias",
    "composer": "Albéniz",
    "tempo_map": [[0, 120], [64, 100]],  // [(beat, bpm), ...]
    "key": "C",
    "time_signature": "4/4",
    "tuning": "EADGBE",
    "capo": 0
  },
  "voices": [
    {
      "id": "melody",
      "notes": [
        {"t": 1.0, "dur": 0.5, "pitch": 64, "vel": 90}
      ]
    },
    {
      "id": "bass",
      "notes": [...]
    }
  ],
  "tab": [
    {"t": 1.0, "string": 2, "fret": 3}
  ]
}
```

### Conversion Adapters

- **MusicXML → JSON**: Use `music21.converter.parse()` + custom extractor
- **JSON → MusicXML**: Use `music21` stream builder
- **JSON → MIDI**: Use `mido` or `pretty_midi`
- **JSON → alphaTab GPX**: Custom serializer for alphaTab

### Metrics

- **Note/Onset F1**: Accuracy of parsed notes vs ground truth
- **Rhythm F1**: Timing accuracy (±30 ms tolerance)
- **Playability Cost**: Fret jumps, stretches, position shifts (for TAB)
- **User Edit Distance**: How much users manually fix parsed content

---

## UI Layout (Minimal, Shared)

### Home View

- Library grid with cards (thumbnail, title, composer, tags)
- Filters: composer, tuning, difficulty
- Search bar

### Piece View (Tabs)

1. **Overview**: Metadata, tags, versions list
2. **Practice**: Sheet music + transport + playback controls
3. **Edit**: Score editing tools (transpose, quantize, re-beam)
4. **Versions**: Version history with diffs
5. **Exports**: Download MIDI, MusicXML, PDF (future)

### Practice Tab Layout

```
┌─────────────────────────────────────────────────┐
│  [Title]               [Tempo: 120]  [Metronome]│
├─────────────────────────────────────────────────┤
│  Sheet Music (OSMD)                             │
│  ┌───────────────────────────────────────────┐  │
│  │  Staff notation with playback cursor      │  │
│  └───────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────┐  │
│  │  Guitar TAB (alphaTab)                    │  │
│  └───────────────────────────────────────────┘  │
├─────────────────────────────────────────────────┤
│  Transport: [<-][Play/Pause][->] [A|──────|B]   │
│  Section Jump: [Intro][Verse][Chorus]           │
├─────────────────────────────────────────────────┤
│  Practice Heatmap (time per bar visualization)  │
└─────────────────────────────────────────────────┘
```

---

## Concrete Weekly Deliverables

### Week 1
- Import MXL/MusicXML → playback + loop + tempo
- MongoDB schema + DB setup
- Basic frontend layout

### Week 2
- Projects/versions CRUD
- Basic export (MIDI, MusicXML)
- Practice stats tracking
- Tags and filters

### Week 3
- Naive TAB from pitches (pitch → string/fret)
- Section markers (auto-detect from MusicXML)
- Bookmarks and annotations

### Week 4
- Quantize grid for editing
- Transpose functionality
- Version diffs
- Backup/rollback

### Week 5
- Per-bar practice targets
- Streak tracking
- Time-in-bar heatmap

### Week 6
- Polish UX
- Performance optimization
- User testing with design partners

---

## Key Resources (Tight, Battle-Tested)

- **Parse/Render**: OpenSheetMusicDisplay, alphaTab, music21
- **Audio/Playback**: Tone.js, mido, pretty_midi
- **Infra**: FastAPI, Motor, MongoDB, Vercel
- **Testing**: pytest (backend), Vitest (frontend)

---

## Risks & De-Risking

### PDF → MusicXML OCR is Hard
- **Risk**: OCR for scanned PDFs is complex and error-prone
- **Mitigation**: Punt to manual alignment first; schedule OCR for later in Phase 1 or Phase 2

### TAB Quality vs Speed
- **Risk**: Naive TAB (pitch → fret) may be unplayable
- **Mitigation**: Use DP (dynamic programming) first; defer ILP (integer linear programming) to Phase 2 for hard bars only

### MusicXML Quirks
- **Risk**: Not all exporters follow the spec; malformed files
- **Mitigation**: Validate XML first; graceful error handling with user feedback

### Performance (Large Scores)
- **Risk**: Rendering 100+ bar scores may lag
- **Mitigation**: Virtualize rendering (only render visible bars); use web workers for parsing

---

## Success Metrics

- 95% of uploaded MusicXML/MXL files parse without errors
- Playback latency <50 ms (click to sound)
- Users can practice a full piece with A/B loop and tempo control
- Design partners report smooth, intuitive UX
- At least 3 real pieces uploaded and practiced daily

---

## Next Phase Prep

- Collect user feedback on TAB readability (informs Phase 2 fingering solver)
- Identify common MusicXML errors to improve parser robustness
- Benchmark parsing speed for large files (optimize before Phase 2 audio work)
