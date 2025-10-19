# Planning: Piece Archival & Bulk Actions

## Goal
Introduce first-class archival (soft delete) workflows so pieces can be hidden from the active library without data loss, and later restored individually or in bulk.

## Technical Approach
- Persist archival state in the `Piece` document (`is_archived`, `archived_at`) with indexes that keep active queries fast.
- Add backend endpoints for listing archived vs active pieces, and for toggling archival state (single + bulk) with optimistic timestamps.
- Update React Query layer with new `piecesApi` helpers and extend piece types to include archival metadata.
- Refresh the Library UI with:
  - Active/Archived filter tabs
  - Multi-select checkboxes + action bar for Archive/Unarchive Selected or All (current view)
  - Per-piece quick action in menu (Archive/Unarchive)
  - Visual badge on cards indicating archived status when browsing that tab.
- Maintain backwards compatibility for existing flows (upload, practice) by defaulting queries to active pieces.

## API Contract (draft)
- `GET /pieces?archived=false|true|all` → defaults to `false`; returns list filtered by archival state.
- `POST /pieces/{piece_id}/archive` → `{ archived: true, reason?: str }` body optional → returns updated `Piece`.
- `POST /pieces/{piece_id}/unarchive` → returns updated `Piece`.
- `POST /pieces/archive/bulk` → `{ piece_ids: [str], action: "archive"|"unarchive" }` → returns `{ updated: str[] }`.
- Extend existing `Piece` model with `"is_archived": bool`, `"archived_at": datetime | null`.

## Data Models
- Backend `Piece` Pydantic model gains `is_archived: bool = False` and `archived_at: datetime | None`.
- Frontend `Piece` type mirrors new fields; selectors default to active pieces.
- React Query cache keys incorporate archival filter (`['pieces', { archived }]`).

## Questions & Decisions
- Should archived pieces remain reachable via practice URL? → Yes; endpoint still returns piece even if archived, but UI will warn user.
- Bulk action semantics for "All": operate on currently filtered set (active or archived) for UX clarity.
- Indexing: consider compound index on `{"is_archived": 1, "created_at": -1}` for scaling; evaluate once data volume grows.

---

# Planning: Upload Conversion QA & Preview Modal

## Goal
Ensure every uploaded score immediately reports conversion readiness (MIDI, MXL unzip, staff↔TAB) and surfaces that feedback in a preview workspace so editors can debug without leaving the upload flow.

## Technical Approach
- Backend `POST /upload`: augment response with `conversion_checks` map capturing status, duration, and error text for each conversion target (midi, mxl_extract, staff_to_tab, tab_to_staff, pdf_to_mxl, image_to_musicxml).
- MusicXML parsing: reuse existing extractor; detect notation type (TAB/staff) to decide which conversions to attempt; wrap converter functions so missing MuseScore reports a friendly status instead of 500.
- Conversions flagged WIP (pdf/image) return `status: 'unavailable'` + guidance constant until future implementation.
- Persist sanitized MusicXML + generated MIDI as today; store any successful conversions in GridFS (naming convention `<basename>__tab.musicxml`, etc.) for future retrieval.
- Frontend upload page: introduce "Conversion Preview" modal that shows status cards, provides inline XML viewer (existing `MusicXMLEditor`) and playback preview hooks (reuse OSMD/Tone.js via lazy-loaded component).
- UI: Summary banner inline, modal grid with status badges + action buttons (View XML, Play MIDI, Download).

## API Contract (draft)
Extend existing upload response:
```jsonc
{
  "...": "... existing fields ...",
  "conversion_checks": {
    "midi": { "status": "success|failed|skipped", "duration_ms": 1200, "error": null },
    "staff_to_tab": { "status": "pending|failed|success|unavailable", "error": "MuseScore missing" },
    "tab_to_staff": { "status": "skipped", "reason": "Source already staff-only" },
    "pdf_to_mxl": { "status": "unavailable", "note": "WIP" },
    "image_to_musicxml": { "status": "unavailable" }
  },
  "preview_assets": {
    "musicxml_file_id": "abc",
    "midi_file_id": "def",
    "tab_musicxml_file_id": "ghi" // optional
  }
}
```

## Data Models
- New `ConversionCheckResult` Pydantic model in backend upload schema.
- Frontend `types/upload.ts`: mirror structure for type-safe UI.
- GridFS metadata extended with `conversion_kind` for converted variants.

## Questions & Decisions
- Should we queue long-running conversions asynchronously? → For now run inline with 30s timeout; surface `timeout` status if overrun.
- Where to store generated conversions for reuse? → GridFS alongside originals with metadata link.
- How to trigger modal automatically? → Auto-open after successful parse if conversions attempted; allow manual reopen via button.
- Future: when pdf/image support lands, reuse `conversion_checks` slots without schema change.

---

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

| Risk                         | Mitigation                                      |
| ---------------------------- | ----------------------------------------------- |
| music21 parsing errors       | Validate MusicXML schema; graceful error msgs   |
| OSMD cursor sync drift       | Use Tone.Transport.scheduleRepeat for precision |
| Example file has no TAB data | Display staff only; add TAB gen in v1 (Week 3)  |

## 7) Decisions Log

| Date       | Decision                       | Type (1-way/2-way) | Why/Link                                               |
| ---------- | ------------------------------ | ------------------ | ------------------------------------------------------ |
| 2025-01-16 | Use OSMD (not alphaTab)        | 2-way              | MusicXML-first; alphaTab's MusicXML is experimental    |
| 2025-01-16 | Use Tone.js for playback       | 2-way              | Metronome + precise scheduling; no built-in OSMD audio |
| 2025-01-16 | Use music21 for parsing        | 2-way              | Battle-tested MusicXML → MIDI; Python backend          |
| 2025-01-16 | Defer automatic TAB generation | 2-way              | Display existing TAB only in v0; implement in v1       |
| 2025-01-16 | GridFS for storage             | 2-way              | Simple start; S3 later if needed                       |
| 2025-01-16 | No Guitar Pro support in v0    | 2-way              | MusicXML focus first; GP3-7 in Phase 2 with alphaTab   |

## 8) Open Questions (with owners)

- [x] Which renderer: alphaTab vs OSMD? → **OSMD** (MusicXML mature) — **Owner:** Team
- [x] Which audio: AlphaSynth vs Tone.js? → **Tone.js** (metronome + scheduling) — **Owner:** Team
- [x] Does example file have TAB technical tags? → **RESOLVED** - YES, example files contain `<technical><string><fret>` tags. See execution.md Q1 for details.
- [x] Metronome sound: synth or sample? → **RESOLVED** - Use tick/tock pleasant click sound (multiple options available, default to noticeable but pleasant)
- [x] OSMD cursor API for sync? → **RESOLVED** - YES, implemented with `cursorNext()` and `resetCursor()`. Basic sync functional. See execution.md Q2 for details.

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

- Enable bidirectional conversion between guitar tablature (TAB) and standard staff notation
- Auto-detect notation type on upload and provide conversion options for missing formats
- Success: 80% conversion accuracy with user-facing status indicators and retry mechanisms

## 2) Goals / Non-Goals

- **Goals:** Detect TAB vs staff on ingest, CLI-based conversion (MuseScore/TuxGuitar/LilyPond), store both variants in GridFS, frontend toggle (Staff/TAB/Both), conversion status tracking, QA diff viewer
- **Non-Goals:** Real-time conversion during playback, manual notation editing, AI-based conversion enhancement (Phase 2), handwritten tab recognition

## 3) Scope (In / Out)

- **In:** Notation type detection (`<technical>` tags, clef analysis), headless CLI conversion, dual-asset storage per version, frontend notation selector with "unavailable" warnings, conversion progress/retry UI, playback diff tool (Tone.js vs alphaTab)
- **Out:** Live conversion toggle during playback, batch conversion of library, user-customizable conversion rules, cloud-based conversion service

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

| Risk                                  | Mitigation                                                                                   |
| ------------------------------------- | -------------------------------------------------------------------------------------------- |
| CLI tool conversion errors (80% goal) | Graceful degradation: show "conversion unavailable", allow manual upload of alternate format |
| CLI tool not installed on server      | Docker image with pre-installed tools, installation docs                                     |
| Conversion queue backlog              | Async job processing with status polling, prioritize user-initiated conversions              |

## 7) Decisions Log

| Date       | Decision                             | Type (1-way/2-way) | Why/Link                                                 |
| ---------- | ------------------------------------ | ------------------ | -------------------------------------------------------- |
| 2025-01-17 | Use MuseScore 4 CLI (primary tool)   | 1-way              | Only viable option for headless bidirectional conversion |
| 2025-01-17 | Reject TuxGuitar, LilyPond           | 1-way              | No CLI automation (TuxGuitar), one-way only (LilyPond)   |
| 2025-01-17 | music21 pre-processing approach      | 2-way              | Flexible staff manipulation, can swap to templates later |
| 2025-01-17 | Store both formats in same version   | 2-way              | Simpler than separate versions, easy rollback            |
| 2025-01-17 | Async conversion with status polling | 2-way              | Non-blocking upload flow, scalable                       |
| 2025-01-17 | GridFS for converted assets          | 2-way              | Consistent with existing storage, S3 if growth requires  |
| 2025-01-17 | Frontend toggle vs auto-switch       | 2-way              | User control over display, "Both" view for learning      |

## 8) Open Questions (with owners)

- [x] Which CLI tool has best TAB→Staff accuracy? MuseScore vs TuxGuitar vs LilyPond — **RESOLVED: MuseScore 4** — **Owner:** Backend
- [ ] Should conversion be automatic or user-initiated? — **Owner:** Product — **Due:** 2025-01-20 auser intiated conversions
- [x] Docker image size with all CLI tools? — **RESOLVED: MuseScore only (~200MB)** — **Owner:** DevOps
- [ ] Max conversion time before timeout? — **Owner:** Backend — **Due:** 2025-01-20 (recommend 30s)
- [x] Store original_file_id for reprocessing failed conversions? — **RESOLVED: Yes** — **Owner:** Backend

## 9) Success Metrics

- ≥80% conversion success rate · Conversion time <30s · User-initiated retry works · Frontend toggle responsive <100ms · Diff viewer playback sync ±50ms

## 10) Timeline (plan, not commitment)

- **Research (0.5d):** Evaluate CLI tools, test conversion samples, Docker setup
- **Backend Ingest (1d):** Detection logic, conversion_status fields, original_file_id storage
- **Backend Conversion (1.5d):** CLI service wrapper, async job queue, status endpoint
- **Backend Assets (0.5d):** Update version model, dual-asset storage, file streaming
- **Frontend Toggle (1d):** Notation selector UI, asset loading logic, "unavailable" states
- **Frontend Diff (1d):** Side-by-side viewer, playback sync, visual comparison
- **Testing (0.5d):** End-to-end conversion flow, error handling, multiple file types

---

### Optional Annexes (link only when needed)

- **Annex A: CLI Tool Comparison** → [conversion-tools.md](/docs/features/tab-conversion/conversion-tools.md)
- **Annex B: Conversion Pipeline Architecture** → [pipeline-architecture.md](/docs/features/tab-conversion/pipeline-architecture.md)
- **Annex C: Debug Guide** → [debug-guide.md](/docs/features/tab-conversion/debug-guide.md)

---

# Planning: MXL Parse Error Debugging UI

**Date**: 2025-01-18 · **Owner**: Team · **Status**: Planning (Awaiting User Input)

## 1) TL;DR (≤3 bullets)

- Show detailed error location when MusicXML/MXL parsing fails (line number, measure, element)
- Enable inline editing of MusicXML to fix parse errors without re-uploading
- Success: Users can identify and fix parse errors in <5 minutes without external tools

## 2) Goals / Non-Goals

- **Goals:** Detailed parse error messages with line/measure/element location, MusicXML viewer with syntax highlighting, inline editing with validation, re-parse button, error history tracking, common error suggestions
- **Non-Goals:** Auto-fixing parse errors with AI (Phase 2), visual score editor (Phase 3), support for non-MusicXML formats in editor, real-time collaboration on edits

## 3) Scope (In / Out)

- **In:** Enhanced parser error reporting (music21 exception details), error location extraction (line number, measure ID, element type), MusicXML viewer component with Monaco/CodeMirror, inline editor with XML validation, "Re-parse" action, error annotation overlay, sanitization suggestion UI
- **Out:** Visual drag-drop score editing, WYSIWYG editor, multi-file comparison, version control/diff for edits, undo/redo beyond browser default

## 4) Architecture (One paragraph + ASCII)

Upload fails → backend catches music21 exception → extracts error details (line, measure, element, exception message) → returns structured error response → frontend displays error summary + "View/Edit MusicXML" button → user clicks → modal opens with Monaco editor → MusicXML loaded with syntax highlighting → error line highlighted/scrolled into view → user edits XML → clicks "Validate & Re-parse" → frontend sends edited XML to backend validation endpoint → if valid, re-runs full parse flow → if invalid, shows new errors inline.

```
Upload → Parse Fails → music21 Exception → Extract Location (line, measure, element)
↓
API Response: { "error": "PARSE_FAILED", "details": { "line": 42, "measure": "5", "element": "<note>", "message": "Invalid pitch" } }
↓
Frontend Error UI → "View/Edit MusicXML" button → Monaco Editor Modal
↓
User Edits XML → "Validate & Re-parse" → POST /validate-musicxml → Parse Success/New Errors
↓
If Success → Upload New Version → Library Updated
```

## 5) Contract Snapshot (stable bits only)

```
POST /upload  v2 (enhanced errors)
Req: multipart/form-data (file: MXL)
200: { "file_id":"abc", ... }
400: {
  "error": "PARSE_FAILED",
  "details": {
    "line": 142,
    "measure": "12",
    "element": "<note>",
    "exception_type": "music21.pitch.PitchException",
    "message": "Invalid pitch value: 'Z4'",
    "suggestion": "Check <pitch><step> element - must be A-G"
  },
  "raw_xml_preview": "<note>...</note>"  // 5 lines of context
}

POST /validate-musicxml  v1 (new endpoint)
Req: { "xml_content": "<score-partwise>...</score-partwise>" }
200: { "valid": true, "metadata": {...} }
400: { "valid": false, "errors": [{line, message}] }

POST /pieces/{id}/versions/replace  v1 (new endpoint)
Req: { "xml_content": "...", "original_version_id": "v1" }
200: { "version": {...}, "parse_status": "success" }
```

## 6) Risks & Mitigations (Top 3)

| Risk                                    | Mitigation                                                     |
| --------------------------------------- | -------------------------------------------------------------- |
| Parser doesn't provide line numbers     | Wrap music21 calls with custom parser that tracks XML position |
| Large MXL files crash browser editor    | Limit editor to <1MB files, offer download for larger files    |
| User edits break file worse than before | Always keep original_file_id backup, show diff before confirm  |

## 7) Decisions Log

| Date       | Decision                              | Type (1-way/2-way) | Why/Link                                                              |
| ---------- | ------------------------------------- | ------------------ | --------------------------------------------------------------------- |
| 2025-01-18 | CodeMirror 6 for XML editor           | 2-way              | Lightweight (200KB), mobile-friendly, with upload + semantics buttons |
| 2025-01-18 | Hybrid edit flow (inline + download)  | 2-way              | Inline for quick fixes, download for complex edits                    |
| 2025-01-18 | Auto-fix with version system          | 1-way              | Always sanitize, show diffs, version approval workflow                |
| 2025-01-18 | Show all errors with filterable UI    | 2-way              | Comprehensive view, filter/sort by type, version-aware                |

## 8) Open Questions (with owners)

**🔴 CRITICAL - USER INPUT NEEDED:**

1. **XML Editor Choice** — **Owner:** User — **Due:** Before implementation

   - Option A: **Monaco Editor** (VS Code engine, 2.8MB bundle, TypeScript support, rich features)
   - Option B: **CodeMirror 6** (Lightweight 200KB, mobile-friendly, minimal) this works, should allow a button to upload. also add a dummy button with a explainer of what it does to add semantics from instructions for adding new symbols in unique mxls so that it can be converted
   - Option C: **Simple `<textarea>` with syntax highlighting** (Minimal dependencies)
   - **YOUR ANSWER:** _[Edit this line with A/B/C and why]_

2. **Edit Flow Preference** — **Owner:** User — **Due:** Before implementation

   - Option A: **Inline modal editor** (Edit in browser, immediate validation)
   - Option B: **Download → Edit locally → Re-upload** (User uses their own XML editor)
   - Option C: **Hybrid** (Inline for small fixes, download button for complex edits)
   - **YOUR ANSWER:** _[Edit this line with A/B/C]_

3. **Error Location Granularity** — **Owner:** User — **Due:** Before implementation

   - What error details are most useful to you?
     - [x] Line number only
     - [x] Line number + measure number
     - [x] Line number + measure + element type (e.g., `<note>`)
     - [x] Full XPath to error element (e.g., `/score-partwise/part[1]/measure[12]/note[3]`)
           full path with drop down or a good ui ux to view line number only may with measure or element type and a smart ux
   - **YOUR ANSWER:** _[Check all that apply]_

4. **Auto-Sanitization Scope** — **Owner:** User — **Due:** Before implementation

   - Should the system **auto-fix** common errors (like `type="discontinue"` → `type="stop"`)?

     - Option A: **Always auto-fix silently** (faster, may hide issues)
     - Option B: **Show what would be fixed, ask user to confirm** (transparent, slower)
     - Option C: **Never auto-fix, always manual** (full control, tedious)

       auoto fix always and show the change to user like versions diff change higlighted, user should be able to go through versions if they want, choose to edit any version and have an approval flow to publish, the pujblished ones are then used in the downstream for the at music.. like for midi playing, and aplhatab and the conversion from tab to sheet and sheet to tab and other features

   - **YOUR ANSWER:** _[A/B/C and reasoning]_

5. **Error History** — **Owner:** User — **Due:** Before implementation

   - Should we track parse error history per piece?
     - [x] Yes - show "Common errors in this file" on re-upload
     - [ ] No - just show current error
   - **YOUR ANSWER:** _[Yes/No]_

6. **Multi-Error Display** — **Owner:** User — **Due:** Before implementation

   - If MusicXML has multiple errors, how should we show them?[Think from ux

     - Option A: **Show only first error** (simple, may require multiple fix cycles)
     - Option B: **Show all errors in list** (comprehensive, may be overwhelming)
     - Option C: **Show first 3 errors** (balanced)

       Think form ux and intuition and comfort of viewing so much information: put that to a test and see where we get. decide on youer own.. i need to be able to see and view things like where the errors are where the edits are what can be corrected and such in a filterable list of such tags adn the correspoding changes highlighted which can have versions, and also the changes i make and save as versions

   - **YOUR ANSWER:** _[A/B/C]_

## 9) Success Metrics

- Parse error rate <5% after UI launch · Error fix time <5 min (from error to successful re-parse) · 90% of users prefer inline editor over re-upload · Error suggestion accuracy >70%

## 10) Timeline (plan, not commitment)

- **Research (0.5d):** music21 exception handling, XML line number extraction, editor library comparison
- **Backend Error Reporting (1d):** Enhanced exception handling, line/measure/element extraction, validation endpoint
- **Frontend Error UI (0.5d):** Error detail display, "View/Edit" button, error suggestion rendering
- **Frontend XML Editor (1.5d):** Monaco/CodeMirror integration, syntax highlighting, error line highlighting
- **Validation Flow (1d):** Re-parse button, inline validation, success/failure feedback
- **Testing (0.5d):** Test with known broken MXL files, user flow validation

---

### Optional Annexes (link only when needed)

- **Annex A: music21 Exception Catalog** → [music21-exceptions.md](/docs/features/parse-errors/music21-exceptions.md)
- **Annex B: Common MusicXML Errors** → [common-errors.md](/docs/features/parse-errors/common-errors.md)
- **Annex C: XML Editor Integration Guide** → [editor-integration.md](/docs/features/parse-errors/editor-integration.md)

---

# Planning: Guitar Practice Analysis (Upload Preview Workspace)

**Date**: 2025-01-19 · **Owner**: Team · **Status**: Phase 1 Complete, Phases 2-4 Planned

## 1) TL;DR (≤3 bullets)

- Transform raw note data into guitar-focused practice insights: note frequency, chord shapes, scale patterns, progressions
- Help guitarists identify what to practice (common notes, chord transitions, scale positions)
- Success: Phase 1 (note frequency) complete with visual bar charts, Phases 2-4 planned with placeholders

## 2) Goals / Non-Goals

**Goals:**
- Note frequency analysis (which notes appear most often)
- Chord shape detection (identify chord shapes used in the piece)
- Scale pattern recognition (identify scales and positions)
- Progression analysis (track chord/scale transitions)

**Non-Goals:**
- Automatic fingering generation (future)
- Difficulty rating algorithm (future)
- Practice session tracking (separate feature)
- Real-time analysis during playback (future)

## 3) Scope (In / Out)

**In (Phase 1 - Complete):**
- Note frequency counting with percentages
- Visual bar charts showing relative frequency
- Collapsible UI sections
- Extract note data from alphaTab score parser

**Out (Deferred to Phases 2-4):**
- Chord detection algorithm (placeholder ready)
- Scale pattern matching (placeholder ready)
- Progression tracking (placeholder ready)
- Fretboard diagrams (future)
- Music theory analysis (future)

## 4) Architecture (One paragraph + ASCII)

User uploads MusicXML → alphaTab parses score → extract all notes with timestamps → analyze note frequency → display bar charts. Future phases: identify simultaneous notes (chords), detect melodic sequences (scales), track transitions (progressions). All analysis happens client-side using extracted note data.

```
MusicXML → alphaTab Parser → Note Extraction → Analysis Engine → UI Display
                                    ↓
                        [time, pitch, duration, positions]
                                    ↓
              ┌──────────────────────┴──────────────────────┐
              ↓                      ↓                       ↓
    Note Frequency          Chord Detection        Scale Matching
    (Phase 1 ✅)           (Phase 2 🔲)           (Phase 3 🔲)
                                    ↓
                           Progression Analysis
                              (Phase 4 🔲)
```

## 5) Contract Snapshot (stable bits only)

No new API contracts - all client-side analysis using existing MusicXML URLs.

**Data Structure (stable for future phases):**
```typescript
interface PracticeAnalysis {
  noteFrequency: { note: string; count: number; percentage: number }[] // ✅ Implemented
  chords: {                                                              // 🔲 Placeholder
    measure: number
    time: number
    notes: string[]
    chordName?: string
    shape?: string
    confidence: number
  }[]
  scales: {                                                              // 🔲 Placeholder
    startMeasure: number
    endMeasure: number
    notes: string[]
    scaleName?: string
    position?: string
    confidence: number
  }[]
  progressions: {                                                        // 🔲 Placeholder
    chords: string[]
    pattern?: string
    key?: string
  }[]
}
```

## 6) Risks & Mitigations (Top 3)

| Risk                           | Mitigation                                                    |
| ------------------------------ | ------------------------------------------------------------- |
| Chord detection accuracy low   | Use Tonal.js library for music theory, show confidence score  |
| Scale matching false positives | Require minimum sequence length (4+ notes), show confidence   |
| Performance on long pieces     | Lazy evaluation, only analyze when section expanded          |

## 7) Decisions Log

| Date       | Decision                                          | Type (1-way/2-way) | Why/Link                                         |
| ---------- | ------------------------------------------------- | ------------------ | ------------------------------------------------ |
| 2025-01-19 | Client-side analysis (no backend)                 | 2-way              | Faster, no server load, can switch to backend    |
| 2025-01-19 | Use alphaTab for note extraction (not music21)    | 2-way              | Already loaded for playback, consistent with UI  |
| 2025-01-19 | Collapsible placeholder sections for future work  | 1-way              | Sets user expectations, easy to build on         |
| 2025-01-19 | No raw note table for users                       | 2-way              | Focus on insights not data, can add detail view  |
| 2025-01-19 | Visual bar charts for note frequency              | 2-way              | More intuitive than numbers, easier to scan      |

## 8) Open Questions (with owners)

* [ ] **Chord detection algorithm:** Use Tonal.js or custom logic? — **Owner:** Developer — **Due:** Phase 2 start
* [ ] **Scale matching:** Pattern-based or machine learning? — **Owner:** Developer — **Due:** Phase 3 start
* [ ] **Fretboard diagrams:** Use existing library or SVG custom? — **Owner:** Designer/Developer — **Due:** Phase 3
* [ ] **Confidence scoring:** Show to users or hide low-confidence results? — **Owner:** Product/UX — **Due:** Phase 2

## 9) Success Metrics

**Phase 1 (Complete):**
- ✅ Note frequency displayed with percentages
- ✅ Visual bar charts rendering correctly
- ✅ Collapsible UI for 10+ notes
- ✅ Zero external dependencies (pure TypeScript)

**Future Phases (when implemented):**
- Chord detection accuracy >80%
- Scale detection accuracy >75%
- Analysis completes in <2s for typical piece
- User feedback: "helpful for practice planning" >70%

## 10) Timeline (plan, not commitment)

- ✅ **Phase 1: Note Frequency** (0.5d) - COMPLETE
- 🔲 **Phase 2: Chord Detection** (1d) - Integrate Tonal.js, identify simultaneous notes, map to shapes
- 🔲 **Phase 3: Scale Patterns** (1d) - Melodic sequence detection, scale library matching, position suggestions
- 🔲 **Phase 4: Progressions** (0.5d) - Track transitions, identify common patterns, practice hints

---

### Phase Implementation Details

**Phase 1: Note Frequency Analysis** ✅ COMPLETE (2025-01-19)

**Implemented:**
- Component: `PracticeAnalysisDisplay.tsx` (replaced `NoteDataDisplay.tsx`)
- Count occurrences of each unique note
- Calculate percentages: `(count / total) * 100`
- Sort by frequency (descending)
- Visual bar charts with relative widths: `width: (count / maxCount) * 100%`
- Collapsible "Show all" button for 10+ notes
- Displays: "C4: 25 times (18%)" with progress bar

**UI Design:**
```
┌─────────────────────────────────────────────┐
│ 🎵 Practice Analysis                        │
├─────────────────────────────────────────────┤
│ ▼ Note Frequency (25 unique notes)          │
│   C4: ████████ 25 times (18%)               │
│   E4: ██████ 18 times (13%)                 │
│   G4: █████ 15 times (11%)                  │
│   [+ Show 22 more notes]                    │
└─────────────────────────────────────────────┘
```

**Phase 2: Chord Shape Detection** 🔲 PLACEHOLDER (Future)

**Algorithm (planned):**
1. Group notes by time window (±50ms for simultaneous)
2. Extract unique pitch classes: `[C, E, G]` → C major triad
3. Use Tonal.js `Chord.detect()` to identify chord name
4. Map to guitar shapes using chord database (open position, barre chords)
5. Calculate confidence based on number of notes, timing consistency

**Dependencies:**
- `npm install tonal` - Music theory library for chord detection
- Or custom chord database (JSON file with common guitar chords)

**UI Mockup:**
```
▼ Chord Shapes (5 detected)
  Measure 4: C major (x32010)
    ╒═════════
    │ o o o o
    ├─────────
    │ ┃ ┃ ┃ │
    │ 1 2 3 │  [Fretboard diagram]
    ...
```

**Phase 3: Scale Pattern Detection** 🔲 PLACEHOLDER (Future)

**Algorithm (planned):**
1. Identify melodic sequences (consecutive notes, same measure or phrase)
2. Extract pitch sequence: `[C, D, E, F, G]` → ascending 5 notes
3. Match against scale library (major, minor, pentatonic, modes)
4. Calculate pattern confidence (length, completeness)
5. Suggest fretboard positions (open position, Position II-XII)

**Scale Library:**
- C major: `[C, D, E, F, G, A, B]`
- A minor pentatonic: `[A, C, D, E, G]`
- Dorian, Mixolydian, etc.

**UI Mockup:**
```
▼ Scale Patterns (3 detected)
  Measures 8-12: C major scale
    Position 1 (open position)
    [Fretboard position diagram]
    Notes: C-D-E-F-G (5/7 notes, 71% confidence)
```

**Phase 4: Progression Analysis** 🔲 PLACEHOLDER (Future)

**Algorithm (planned):**
1. Extract chord sequence from Phase 2 results
2. Identify key (most common root, chord family analysis)
3. Convert to Roman numerals: `C-F-G-C` → `I-IV-V-I` in C major
4. Match against common progressions (I-V-vi-IV, ii-V-I, etc.)
5. Identify difficult transitions (large shape changes, fret jumps)

**Progression Library:**
- Pop: I-V-vi-IV, vi-IV-I-V
- Jazz: ii-V-I, iii-vi-ii-V-I
- Blues: I-I-I-I-IV-IV-I-I-V-IV-I-I

**UI Mockup:**
```
▼ Progressions (2 detected)
  Verse: I-IV-V-I (C-F-G-C)
    Common in: Folk, Pop, Rock
    Practice tip: Focus on F→G transition (fret jump)

  Chorus: vi-IV-I-V (Am-F-C-G)
    Common in: Pop
    Practice tip: Smooth open chord changes
```

---

### Code Locations

**Implemented (Phase 1):**
- `frontend/src/components/Upload/PracticeAnalysisDisplay.tsx` - Main component
- `frontend/src/components/Upload/PlaybackPreviewPanel.tsx` - Integration

**Planned (Phases 2-4):**
- `frontend/src/lib/music-analysis.ts` - Analysis utilities (chord detection, scale matching, progression tracking)
- `frontend/src/components/Upload/ChordShapeCard.tsx` - Chord shape display with fingerings
- `frontend/src/components/Upload/ScalePatternCard.tsx` - Scale pattern display with positions
- `frontend/src/components/Upload/FretboardDiagram.tsx` - Visual fretboard component
- `frontend/src/data/chords.json` - Guitar chord shape database
- `frontend/src/data/scales.json` - Musical scale library

---

### Notes for Future Developer

**Picking up Phase 2 (Chord Detection):**
1. Install Tonal.js: `npm install tonal`
2. Create `music-analysis.ts` with `detectChords(notes: NoteData[])`
3. Group notes by time window (±50ms)
4. Use `Chord.detect()` to identify chord names
5. Map to guitar shapes using chord database
6. Update `PracticeAnalysisDisplay.tsx` to call `detectChords()` and display results
7. Replace placeholder section with actual chord cards

**Key Insight:** Note extraction is solid (Phase 1), all future phases build on top of that data structure.

**Deferred Decisions:**
- Confidence thresholds (show chords with >70% confidence?)
- Fretboard diagram library (react-fretboard vs custom SVG?)
- Scale matching algorithm (pattern-based or ML?)
- Progression template library (comprehensive vs common only?)

---

# Planning: Interactive Fretboard TAB Builder (Practice Analysis Tab 2)

**Date**: 2025-01-19 · **Owner**: Team · **Status**: Planning

## 1) TL;DR (≤3 bullets)

- Add second tab to Practice Analysis: Interactive fretboard visualization where users select note positions
- Transform passive analysis into active TAB creation: toggle notes on/off, choose from alternate positions, build custom tablature
- Success: Users can visualize all notes on fretboard, select optimal positions, generate playable TAB, edit and refine

## 2) Goals / Non-Goals

**Goals:**
- Interactive fretboard visualization (6 strings × 24 frets)
- Show all notes from piece on fretboard at their possible positions
- Toggle individual notes on/off
- Select from alternate positions for each note (checkboxes)
- Build custom TAB notation based on user selections
- Playback with user-selected positions (alphaTab integration)
- Edit mode: modify positions for any note
- Export custom TAB as MusicXML

**Non-Goals:**
- Automatic optimal fingering algorithm (future AI feature)
- Multi-track TAB editing (single guitar only)
- Real-time collaborative editing (future)
- Guitar tuning editor (stick to standard EADGBE for v1)

## 3) Scope (In / Out)

**In:**
- Visual fretboard component (6 strings, 24 frets, standard tuning)
- All extracted notes displayed at all possible positions
- Checkbox UI to select which position to use
- Toggle notes visibility (on/off)
- Generate TAB notation from selections
- Live preview with alphaTab
- Edit mode for position adjustments
- Save custom TAB as new version

**Out (Future):**
- Fingering optimization AI
- Custom tunings (drop D, DADGAD, etc.)
- Multi-guitar arrangements
- Chord shape suggestions on fretboard
- Slide/bend/hammer-on notation (use existing from source)

## 4) Architecture (One paragraph + ASCII)

User opens Practice Analysis → Tab 2 "Fretboard Builder" → Load notes from alphaTab extraction → Calculate all positions for each note (already have this) → Render interactive fretboard SVG → User toggles notes, selects positions via checkboxes → Generate TAB notation (MusicXML with `<technical><string><fret>`) → Preview with alphaTab in tab-only mode → User edits positions → Re-generate TAB → Save as new MusicXML version. All client-side except final save.

```
┌─────────────────────────────────────────────────────────────┐
│ Practice Analysis                                           │
├─────────────────────────────────────────────────────────────┤
│ [Tab 1: Insights] [Tab 2: Fretboard Builder] ◄── NEW       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Fretboard (6 strings × 24 frets)                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ E ─●─────●─────────────────────────────────────     │   │
│  │ B ───────────●─────●───────────────────────────     │   │
│  │ G ─────●───────────────●───────────────────────     │   │
│  │ D ───●─────────●─────────────────────────────      │   │
│  │ A ─────────────────●─────●─────────────────────     │   │
│  │ E ─●─────────────────────────────────────────       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Note: C4 (Time: 1.250s)                                   │
│  Positions: ☑ String 2, Fret 1  ☐ String 3, Fret 5  ...   │
│  [◀ Prev Note] [Next Note ▶]                               │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Generated TAB Preview (alphaTab)                      │   │
│  │ [Plays with selected positions]                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Save TAB]  [Export MusicXML]  [Reset to Original]        │
└─────────────────────────────────────────────────────────────┘

Data Flow:
MusicXML → alphaTab → Extract Notes → Calculate Positions
                                              ↓
                                    User Selects Positions
                                              ↓
                      Generate MusicXML with <technical> tags
                                              ↓
                         Preview with alphaTab (tab-only mode)
                                              ↓
                              User Edits → Re-generate
                                              ↓
                                 Save as New Version
```

## 5) Contract Snapshot (stable bits only)

**Internal Data Structure:**
```typescript
interface FretboardNote {
  time: number
  noteName: string
  midiPitch: number
  duration: number
  positions: NotePosition[]  // All possible positions
  selectedPosition: NotePosition | null  // User's choice
  isVisible: boolean  // Toggle on/off
}

interface NotePosition {
  string: number  // 1-6
  fret: number    // 0-24
  selected: boolean  // UI state
}

interface TabBuilder {
  notes: FretboardNote[]
  generateMusicXML(): string  // Convert selections to MusicXML
  resetToOriginal(): void
  saveAsVersion(): Promise<void>
}
```

**MusicXML Technical Tags (for TAB):**
```xml
<note>
  <pitch><step>C</step><octave>4</octave></pitch>
  <duration>4</duration>
  <technical>
    <string>2</string>  <!-- User selected -->
    <fret>1</fret>      <!-- User selected -->
  </technical>
</note>
```

## 6) Risks & Mitigations (Top 3)

| Risk                                    | Mitigation                                                    |
| --------------------------------------- | ------------------------------------------------------------- |
| Fretboard SVG performance (many notes)  | Virtual scrolling, only render visible frets, lazy load      |
| Position conflicts (same time, string)  | Validation: warn user, suggest alternate positions            |
| MusicXML generation complexity          | Use music21 on backend, or Tonal.js + template client-side    |

## 7) Decisions Log

| Date       | Decision                                          | Type (1-way/2-way) | Why/Link                                         |
| ---------- | ------------------------------------------------- | ------------------ | ------------------------------------------------ |
| 2025-01-19 | Two-tab UI: Insights + Fretboard Builder         | 2-way              | Separate concerns, clearer UX                    |
| 2025-01-19 | Standard tuning only for v1 (EADGBE)             | 2-way              | Simplify, can add tuning selector later          |
| 2025-01-19 | Client-side TAB generation                        | 2-way              | Faster UX, can offload to backend if needed      |
| 2025-01-19 | Checkboxes for position selection                 | 2-way              | Clear UI, supports multi-select (future)         |
| 2025-01-19 | Save as new MusicXML version                      | 1-way              | Preserves original, audit trail                  |

## 8) Open Questions (with owners)

* [ ] **Fretboard library:** Use existing (react-fretboard) or build custom SVG? — **Owner:** Developer — **Due:** Phase 1 start
* [ ] **MusicXML generation:** Client-side (Tonal.js) or backend (music21)? — **Owner:** Developer — **Due:** Phase 2 start
* [ ] **Conflict resolution:** Auto-suggest when positions overlap? — **Owner:** UX/Developer — **Due:** Phase 3
* [ ] **Playback sync:** Highlight current note on fretboard during playback? — **Owner:** Developer — **Due:** Phase 4
* [ ] **Export format:** MusicXML only or also Guitar Pro (.gp5)? — **Owner:** Product — **Due:** TBD

## 9) Success Metrics

**Phase 1 (Fretboard Visualization):**
- Display all notes on fretboard at all positions
- Toggle notes on/off works
- Visual clarity: easy to see which fret/string for each note
- Performance: <100ms to render fretboard with 100+ notes

**Phase 2 (Position Selection):**
- Checkbox UI for selecting positions
- Selected positions highlighted on fretboard
- Validation prevents conflicts (same time, same string)
- User can navigate through notes sequentially

**Phase 3 (TAB Generation & Preview):**
- Generate valid MusicXML with `<technical>` tags
- alphaTab renders generated TAB correctly
- Playback works with user-selected positions
- TAB matches user's visual expectations

**Phase 4 (Edit & Save):**
- User can modify positions after initial selection
- Changes reflected in TAB preview immediately
- Save as new MusicXML version works
- Export MusicXML downloads correct file

## 10) Timeline (plan, not commitment)

- 🔲 **Phase 1: Fretboard Visualization** (2d)
  - Build interactive fretboard component (SVG)
  - Display all notes at all positions
  - Toggle notes on/off
  - Navigation between notes
- 🔲 **Phase 2: Position Selection UI** (1.5d)
  - Checkbox UI for alternate positions
  - Visual feedback (highlight selected)
  - Validation logic (conflict detection)
  - State management (selected positions)
- 🔲 **Phase 3: TAB Generation & Preview** (2d)
  - Convert selections to MusicXML with `<technical>` tags
  - Integrate with alphaTab for preview
  - Playback with selected positions
  - Error handling for invalid selections
- 🔲 **Phase 4: Edit Mode & Save** (1d)
  - Edit mode UI (modify positions)
  - Re-generate TAB on changes
  - Save as new MusicXML version
  - Export functionality

**Total: ~6.5 days** for full feature

---

### Phase Implementation Details

**Phase 1: Fretboard Visualization** 🔲 PLANNED

**Components:**
- `FretboardVisualizer.tsx` - Main fretboard SVG component
  - 6 horizontal lines (strings)
  - 24 vertical lines (frets)
  - Fret markers (3, 5, 7, 9, 12, 15, 17, 19, 21, 24)
  - Note circles at positions
  - Hover tooltips (note name, time)
- `FretboardControls.tsx` - Toggle controls
  - "Show All Notes" / "Hide All Notes"
  - Individual note toggle buttons
  - "Reset to Original Positions"

**Data Flow:**
```typescript
// Input: notes from PracticeAnalysisDisplay
const notes: NoteData[] = extractedNotes

// Calculate positions (already have this)
const fretboardNotes: FretboardNote[] = notes.map(note => ({
  ...note,
  positions: calculateGuitarPositions(note.midiPitch),
  selectedPosition: null, // User hasn't chosen yet
  isVisible: true
}))

// Render on fretboard
<FretboardVisualizer notes={fretboardNotes} />
```

**UI Mockup:**
```
Fretboard (String 1 = top, String 6 = bottom)
┌────────────────────────────────────────────────────────┐
│ E (1) ●──────●────────────────────────────────────    │ ← High E
│ B (2) ─────●────●─────────────────────────────────    │
│ G (3) ──●──────────●──────────────────────────────    │
│ D (4) ●──────●────────────────────────────────────    │
│ A (5) ───────────●────●───────────────────────────    │
│ E (6) ●──────────────────────────────────────────     │ ← Low E
│       0   3   5   7   9   12  15  17  19  21  24      │
└────────────────────────────────────────────────────────┘
       Fret markers: ●   (inlays at 3, 5, 7, 9, 12...)
       Notes: Colored dots (C=red, D=orange, E=yellow, etc.)
```

**Phase 2: Position Selection UI** 🔲 PLANNED

**Components:**
- `PositionSelector.tsx` - Checkbox UI for each note
  - Lists all possible positions
  - Radio buttons or checkboxes (only one position active at a time)
  - Visual preview on fretboard (highlight selected)
- `NoteNavigator.tsx` - Navigate through notes
  - "Previous Note" / "Next Note" buttons
  - Jump to specific time
  - Show current note info (name, time, duration)

**Interaction Flow:**
```
1. User clicks note on fretboard
   ↓
2. PositionSelector shows all positions for that note
   Example: C4 at time 1.250s
     ○ String 2, Fret 1
     ○ String 3, Fret 5
     ○ String 4, Fret 10
     ○ String 5, Fret 15
   ↓
3. User selects "String 3, Fret 5"
   ↓
4. Fretboard highlights selected position (green)
   Other positions dim (gray)
   ↓
5. Move to next note (auto-advance or manual)
```

**Validation:**
- **Conflict detection:** If two notes at same time both select same string → warn user
- **Example:**
  ```
  Time 1.250s: C4 selected String 3, Fret 5
  Time 1.250s: E4 selected String 3, Fret 9  ← CONFLICT!
  → Show warning: "Strings overlap at this time"
  → Suggest: "Try String 2, Fret 5 for E4"
  ```

**Phase 3: TAB Generation & Preview** 🔲 PLANNED

**TAB Generation Algorithm:**
```typescript
function generateTabMusicXML(fretboardNotes: FretboardNote[]): string {
  // 1. Sort notes by time
  const sorted = fretboardNotes.sort((a, b) => a.time - b.time)

  // 2. Build MusicXML structure
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1">
  <part-list>
    <score-part id="P1">
      <part-name>Guitar TAB</part-name>
    </score-part>
  </part-list>
  <part id="P1">`

  // 3. Add measures and notes
  sorted.forEach(note => {
    if (!note.selectedPosition) return // Skip unselected notes

    xml += `
    <note>
      <pitch>
        <step>${note.noteName[0]}</step>
        <octave>${note.noteName[1]}</octave>
      </pitch>
      <duration>${note.duration * 4}</duration>
      <technical>
        <string>${note.selectedPosition.string}</string>
        <fret>${note.selectedPosition.fret}</fret>
      </technical>
    </note>`
  })

  xml += `
  </part>
</score-partwise>`

  return xml
}
```

**Preview Integration:**
```typescript
// After user selects all positions
const tabXML = generateTabMusicXML(fretboardNotes)

// Create blob URL
const blob = new Blob([tabXML], { type: 'application/xml' })
const url = URL.createObjectURL(blob)

// Load in alphaTab (tab-only mode)
<AlphaTabPreview
  musicXmlUrl={url}
  displayMode="tab-only"
  onPlaybackState={handlePlayback}
/>
```

**Phase 4: Edit Mode & Save** 🔲 PLANNED

**Edit Mode Features:**
- Click any note on TAB preview → edit its position
- Drag notes to different string/fret
- Undo/Redo stack
- "Reset to Original" button

**Save Flow:**
```typescript
async function saveCustomTab() {
  const tabXML = generateTabMusicXML(fretboardNotes)

  // Option A: Save locally (download)
  downloadFile(tabXML, 'custom-tab.musicxml')

  // Option B: Save as new version (future - requires backend)
  await api.saveTabVersion({
    pieceId: piece.id,
    xmlContent: tabXML,
    notes: 'Custom TAB built with Fretboard Builder'
  })
}
```

---

### Code Locations

**New Files (Phase 1):**
- `frontend/src/components/Upload/FretboardVisualizer.tsx` - Interactive fretboard SVG
- `frontend/src/components/Upload/FretboardControls.tsx` - Toggle/visibility controls
- `frontend/src/components/Upload/FretboardTab.tsx` - Tab 2 container

**New Files (Phase 2):**
- `frontend/src/components/Upload/PositionSelector.tsx` - Checkbox UI for positions
- `frontend/src/components/Upload/NoteNavigator.tsx` - Navigate between notes
- `frontend/src/hooks/useFretboardState.ts` - State management for selections

**New Files (Phase 3):**
- `frontend/src/lib/tab-generator.ts` - Generate MusicXML from selections
- `frontend/src/lib/tab-validator.ts` - Validate positions (conflict detection)

**Modified Files:**
- `frontend/src/components/Upload/PracticeAnalysisDisplay.tsx` - Add tab navigation
- `frontend/src/components/Upload/PlaybackPreviewPanel.tsx` - Include FretboardTab

**Libraries to Consider:**
- `react-fretboard` - Existing fretboard component (evaluate)
- `vexflow` - Music notation rendering (alternative to custom SVG)
- `tonal` - Music theory utilities (chord/scale helpers)

---

### Notes for Future Developer

**Why This Feature:**
- Guitarists need to choose optimal fingering positions for playability
- Automated TAB generation often picks unplayable positions
- Visual fretboard makes position selection intuitive
- Custom TAB becomes practice tool (slow down, loop difficult sections)

**Key Insights:**
- Position calculation already exists (Phase 1 of Practice Analysis)
- alphaTab can render TAB notation (tab-only mode)
- MusicXML `<technical>` tags are the key to TAB notation
- Client-side generation is fast enough for typical pieces

**Integration Points:**
- Reuses note extraction from PracticeAnalysisDisplay
- Reuses alphaTab renderer with tab-only mode
- Can export to ConversionPreviewModal for editing
- Saves as MusicXMLVersion (when backend endpoints ready)

**Future Enhancements:**
- AI-suggested optimal fingerings (ML model)
- Multi-track TAB (bass + rhythm + lead)
- Real-time playback highlighting on fretboard
- Guitar tuning selector (drop D, open tunings)
- Share custom TABs with other users
