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
