# Planning: Phase 1 v0 - Core Music Library + Basic Practice

**Date**: 2025-01-16 · **Owner**: Team · **Status**: Approved (Post-Research)

## 1) TL;DR (≤3 bullets)

- Build ONE complete flow: Upload MusicXML → View in Library → Practice with playback + metronome
- Enable guitarists to import MusicXML sheet music and practice with tempo-adjustable playback and cursor sync
- Success: Upload example MusicXML, render staff (+ TAB if present), play with metronome, adjust tempo

## 2) Goals / Non-Goals

- **Goals:** MusicXML upload, music21 parsing, MIDI generation, GridFS storage, OSMD rendering (staff + TAB if present), Tone.js playback + metronome, tempo control, cursor sync
- **Non-Goals:** PDF OCR, automatic TAB generation (defer to v1), A/B loop, practice stats, auth, Guitar Pro files

## 3) Scope (In / Out)

- **In:** MusicXML parsing (music21), MIDI generation, GridFS storage, versions API, OSMD rendering (staff + existing TAB), Tone.js playback, metronome, tempo slider, cursor sync
- **Out:** PDF upload, auto TAB generation, A/B loop markers, count-in, annotations, multi-user auth, Guitar Pro support

## 4) Architecture (One paragraph + ASCII)

User uploads MusicXML → backend parses with music21 → extracts metadata + generates MIDI → stores MusicXML + MIDI in GridFS → creates piece + version in MongoDB → frontend fetches MusicXML + MIDI → OSMD renders staff (+ TAB if `<technical>` tags exist) → Tone.js loads MIDI and plays → metronome clicks on beats → OSMD cursor syncs with Tone.Transport time.

```
User → FE (Upload) → API (POST /upload) → music21 (parse + MIDI gen) → GridFS + MongoDB → API (MusicXML + MIDI URLs)
FE (Library) → API (GET /pieces) → piece cards → click → FE (Practice)
FE (Practice) → OSMD (render MusicXML) + Tone.js (play MIDI + metronome) + Cursor sync (time events)
```

## 5) Contract Snapshot (stable bits only)

```
POST /upload  v1
Req: multipart/form-data (file: MusicXML/MXL)
200: { "file_id":"abc", "musicxml_url":"/files/abc", "midi_url":"/files/abc_midi", "metadata": {...} }
Errors: FILE_TOO_LARGE | UNSUPPORTED_TYPE | PARSE_FAILED

POST /pieces/{id}/versions  v1
Req: { "file_id":"abc", "source_type":"musicxml" }
200: { "id":"v1", "piece_id":"p1", "tempo":120, "key":"G", "assets":[{musicxml}, {midi}] }
Errors: PIECE_NOT_FOUND | FILE_NOT_FOUND

GET /files/{file_id}  v1
200: (file stream with correct Content-Type)
Errors: FILE_NOT_FOUND
```

## 6) Risks & Mitigations (Top 3)

| Risk                            | Mitigation                                      |
| ------------------------------- | ----------------------------------------------- |
| music21 parsing errors          | Validate MusicXML schema; graceful error msgs   |
| OSMD cursor sync drift          | Use Tone.Transport.scheduleRepeat for precision |
| Example file has no TAB data    | Display staff only; add TAB gen in v1 (Week 3)  |

## 7) Decisions Log

| Date       | Decision                          | Type (1-way/2-way) | Why/Link                                                |
| ---------- | --------------------------------- | ------------------ | ------------------------------------------------------- |
| 2025-01-16 | Use OSMD (not alphaTab)           | 2-way              | MusicXML-first; alphaTab's MusicXML is experimental     |
| 2025-01-16 | Use Tone.js for playback          | 2-way              | Metronome + precise scheduling; no built-in OSMD audio  |
| 2025-01-16 | Use music21 for parsing           | 2-way              | Battle-tested MusicXML → MIDI; Python backend           |
| 2025-01-16 | Defer automatic TAB generation    | 2-way              | Display existing TAB only in v0; implement in v1        |
| 2025-01-16 | GridFS for storage                | 2-way              | Simple start; S3 later if needed                        |
| 2025-01-16 | No Guitar Pro support in v0       | 2-way              | MusicXML focus first; GP3-7 in Phase 2 with alphaTab    |

## 8) Open Questions (with owners)

- [x] Which renderer: alphaTab vs OSMD? → **OSMD** (MusicXML mature) — **Owner:** Team
- [x] Which audio: AlphaSynth vs Tone.js? → **Tone.js** (metronome + scheduling) — **Owner:** Team
- [ ] Does example file have TAB technical tags? → **Owner:** Backend — **Due:** Day 1
- [ ] Metronome sound: synth or sample? → **Owner:** Frontend — **Due:** Day 3
- [ ] OSMD cursor API for sync? → **Owner:** Frontend — **Due:** Day 4

## 9) Success Metrics

- Upload MusicXML → parse success ≥95% · OSMD render <2s · MIDI playback latency <50ms · Metronome sync accuracy ±10ms · Tempo change responsive <100ms

## 10) Timeline (plan, not commitment)

- **Day 1 (Backend):** music21 parser service, MIDI generation, GridFS upload
- **Day 2 (Backend):** Versions endpoint, files streaming endpoint, test with example file
- **Day 3 (Frontend):** Upload page (dropzone + progress), Library grid, OSMD integration
- **Day 4 (Frontend):** Tone.js playback, metronome, tempo slider, cursor sync
- **Day 5 (Polish):** End-to-end test, error handling, loading states, UX polish

---

### Optional Annexes (link only when needed)

- **Annex A: Library Comparison Research** → [library-research.md](/docs/features/phase1-v0/library-research.md)
- **Annex B: OSMD + Tone.js Integration** → [osmd-tonejs-integration.md](/docs/features/phase1-v0/osmd-tonejs-integration.md)
- **Annex C: music21 Parser Implementation** → [music21-parser.md](/docs/features/phase1-v0/music21-parser.md)

---

# Planning: alphaTab Enhancements Phase 1

**Date**: 2025-01-17 · **Owner**: Frontend · **Status**: Ready for Execution  
**Reference**: [ALPHATAB_ENHANCEMENT_PLAN.md](/docs/ALPHATAB_ENHANCEMENT_PLAN.md)

## Goal
- Close the functional gaps in the alphaTab-based practice flow so guitarists can reliably switch instruments, follow a visual cursor, and seek within pieces.

## Technical Approach
- Extend `frontend/src/lib/alphatab-renderer.ts` with MIDI regeneration handling, precise seeking, and cleanup guards per alphaTab docs.
- Update `frontend/src/pages/PracticePageAlphaTab.tsx` to surface regeneration state, disable controls during updates, and wire new callbacks.
- Add alphaTab cursor styling in `frontend/src/index.css` and propagate disabled states through `InstrumentSelector` and `Transport`.

## Questions & Decisions
- **Decision**: Follow existing SoundFont (sonivox.sf2); no new assets needed.
- **Open**: Verify seeking accuracy on longer scores after implementation.

---

# Planning: TAB ↔ Sheet Conversion Pipeline

**Date**: 2025-01-17 · **Owner**: Team · **Status**: Planning

## 1) TL;DR (≤3 bullets)

* Enable bidirectional conversion between guitar tablature (TAB) and standard staff notation
* Auto-detect notation type on upload and provide conversion options for missing formats
* Success: 80% conversion accuracy with user-facing status indicators and retry mechanisms

## 2) Goals / Non-Goals

* **Goals:** Detect TAB vs staff on ingest, CLI-based conversion (MuseScore/TuxGuitar/LilyPond), store both variants in GridFS, frontend toggle (Staff/TAB/Both), conversion status tracking, QA diff viewer
* **Non-Goals:** Real-time conversion during playback, manual notation editing, AI-based conversion enhancement (Phase 2), handwritten tab recognition

## 3) Scope (In / Out)

* **In:** Notation type detection (`<technical>` tags, clef analysis), headless CLI conversion, dual-asset storage per version, frontend notation selector with "unavailable" warnings, conversion progress/retry UI, playback diff tool (Tone.js vs alphaTab)
* **Out:** Live conversion toggle during playback, batch conversion of library, user-customizable conversion rules, cloud-based conversion service

## 4) Architecture (One paragraph + ASCII)

On upload, parser detects notation type (TAB if `<technical>` tags present, else staff) → flags piece for conversion if single format → conversion service queues CLI job (MuseScore/TuxGuitar) → runs headless conversion → stores converted MusicXML + MIDI in GridFS → updates version with both assets + notation_type metadata → frontend fetches available formats → notation toggle shows enabled/disabled states → diff viewer compares Tone.js (staff) vs alphaTab (TAB) playback.

```
Upload → Parser (detect TAB/staff via <technical> tags) → Flag for conversion → Conversion Queue
Conversion Service → CLI (MuseScore/TuxGuitar/LilyPond) → MusicXML output → GridFS storage
Version Model → assets: [{type:"staff", musicxml_id, midi_id}, {type:"tab", musicxml_id, midi_id}]
Frontend → Notation Toggle (Staff/TAB/Both) → Load respective assets → Render OSMD or alphaTab
Diff Viewer → Load both → Play Tone.js + alphaTab → Visual comparison
```

## 5) Contract Snapshot (stable bits only)

```
POST /pieces/{id}/convert  v1
Req: { "from_notation":"staff", "to_notation":"tab" }
200: { "conversion_id":"c123", "status":"queued", "estimated_time":30 }
Errors: NOTATION_NOT_AVAILABLE | CONVERSION_FAILED | UNSUPPORTED_CONVERSION

GET /pieces/{id}/versions/{version_id}  v2 (extended)
200: {
  "id":"v1",
  "assets": [
    {"notation_type":"staff", "musicxml_file_id":"abc", "midi_file_id":"def"},
    {"notation_type":"tab", "musicxml_file_id":"ghi", "midi_file_id":"jkl", "conversion_status":"completed"}
  ],
  "original_notation":"staff"
}

GET /conversions/{conversion_id}  v1
200: { "id":"c123", "status":"completed|failed|in_progress", "progress":75, "error_message":null }
```

## 6) Risks & Mitigations (Top 3)

| Risk                                  | Mitigation                                                |
| ------------------------------------- | --------------------------------------------------------- |
| CLI tool conversion errors (80% goal) | Graceful degradation: show "conversion unavailable", allow manual upload of alternate format |
| CLI tool not installed on server      | Docker image with pre-installed tools, installation docs |
| Conversion queue backlog              | Async job processing with status polling, prioritize user-initiated conversions |

## 7) Decisions Log

| Date       | Decision                              | Type (1-way/2-way) | Why/Link                                                     |
| ---------- | ------------------------------------- | ------------------ | ------------------------------------------------------------ |
| 2025-01-17 | Use MuseScore 4 CLI (primary tool)    | 1-way              | Only viable option for headless bidirectional conversion     |
| 2025-01-17 | Reject TuxGuitar, LilyPond            | 1-way              | No CLI automation (TuxGuitar), one-way only (LilyPond)       |
| 2025-01-17 | music21 pre-processing approach       | 2-way              | Flexible staff manipulation, can swap to templates later     |
| 2025-01-17 | Store both formats in same version    | 2-way              | Simpler than separate versions, easy rollback                |
| 2025-01-17 | Async conversion with status polling  | 2-way              | Non-blocking upload flow, scalable                           |
| 2025-01-17 | GridFS for converted assets           | 2-way              | Consistent with existing storage, S3 if growth requires      |
| 2025-01-17 | Frontend toggle vs auto-switch        | 2-way              | User control over display, "Both" view for learning          |

## 8) Open Questions (with owners)

* [x] Which CLI tool has best TAB→Staff accuracy? MuseScore vs TuxGuitar vs LilyPond — **RESOLVED: MuseScore 4** — **Owner:** Backend
* [ ] Should conversion be automatic or user-initiated? — **Owner:** Product — **Due:** 2025-01-20
* [x] Docker image size with all CLI tools? — **RESOLVED: MuseScore only (~200MB)** — **Owner:** DevOps
* [ ] Max conversion time before timeout? — **Owner:** Backend — **Due:** 2025-01-20 (recommend 30s)
* [x] Store original_file_id for reprocessing failed conversions? — **RESOLVED: Yes** — **Owner:** Backend

## 9) Success Metrics

* ≥80% conversion success rate · Conversion time <30s · User-initiated retry works · Frontend toggle responsive <100ms · Diff viewer playback sync ±50ms

## 10) Timeline (plan, not commitment)

* **Research (0.5d):** Evaluate CLI tools, test conversion samples, Docker setup
* **Backend Ingest (1d):** Detection logic, conversion_status fields, original_file_id storage
* **Backend Conversion (1.5d):** CLI service wrapper, async job queue, status endpoint
* **Backend Assets (0.5d):** Update version model, dual-asset storage, file streaming
* **Frontend Toggle (1d):** Notation selector UI, asset loading logic, "unavailable" states
* **Frontend Diff (1d):** Side-by-side viewer, playback sync, visual comparison
* **Testing (0.5d):** End-to-end conversion flow, error handling, multiple file types

---

### Optional Annexes (link only when needed)

* **Annex A: CLI Tool Comparison** → [conversion-tools.md](/docs/features/tab-conversion/conversion-tools.md)
* **Annex B: Conversion Pipeline Architecture** → [pipeline-architecture.md](/docs/features/tab-conversion/pipeline-architecture.md)
* **Annex C: Debug Guide** → [debug-guide.md](/docs/features/tab-conversion/debug-guide.md)
