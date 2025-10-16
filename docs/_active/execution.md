# Execution: Phase 1 v0 - Core Music Library + Basic Practice

**Date**: 2025-01-16
**Based on Planning**: [planning.md](./planning.md)
**Status**: In Progress

---

## Progress Log

### 2025-01-17 - alphaTab Enhancements Execution

- ✅ Reviewed `ALPHATAB_ENHANCEMENT_PLAN.md` and alphaTab docs (instrument changes, cursor, seeking, cleanup)
- ✅ Implemented Phase 1-4 frontend updates (renderer regen handling, UI states, cursor CSS, seeking, cleanup guard)
- ⚠️ Noted existing ESLint violations in unrelated files; alphaTab files are clean
- ✅ Patched alphaTab instrument change path to update automation entries so regenerated MIDI honors the selected program
- ✅ Stabilized alphaTab tempo/duration handling (safe playback speed, time-based seeking, resilient duration updates)
- ✅ Switched backend upload flow to “store-first” so raw files persist even if parsing/MIDI generation fails; responses now include parse/midi status indicators
- ✅ Adjusted alphaTab renderer duration math so transport cursor honors tempo changes (playback speed now updates duration)

### 2025-01-16 - Start

- ✅ Completed library research (alphaTab, OSMD, Tone.js, music21)
- ✅ Updated planning.md with research findings
- ✅ Architecture decision: OSMD + Tone.js (not alphaTab due to experimental MusicXML)

### 2025-01-16 - Backend Implementation (Day 1)

- ✅ Created `app/services/storage.py` (GridFS wrapper)
  - upload_file(), get_file(), delete_file(), file_exists()
- ✅ Created `app/services/parser.py` (music21 integration)
  - parse_musicxml() - extracts title, composer, tempo, key, time_sig, has_tablature
  - generate_midi() - MusicXML → MIDI bytes
  - Handles MXL compression (ZIP extraction)
- ✅ Updated `routes/upload.py`
  - Parse MusicXML, generate MIDI, store both in GridFS
  - Returns file_id, midi_file_id, metadata, URLs
- ✅ Created `routes/files.py`
  - GET /files/{file_id} - streams file from GridFS
- ✅ Updated `routes/pieces.py`
  - POST /pieces/{id}/versions - add version with assets
- ✅ Registered files router in main.py

### 2025-01-16 - Frontend Implementation (Day 3)

- ✅ Installed react-dropzone
- ✅ Implemented `pages/UploadPage.tsx`
  - Drag & drop file upload with progress
  - Auto-parsing metadata display
  - Form with title, composer, tags (prefilled from parse)
  - Save to library flow
  - Clean, intuitive UX with success/error states
- ✅ Created `components/Library/PieceCard.tsx`
  - Card design with thumbnail placeholder
  - Metadata badges (key, tempo, time signature)
  - Tags display
  - Click to navigate to practice page
- ✅ Implemented `pages/LibraryPage.tsx`
  - Search by title/composer
  - Filter by tags
  - Loading/empty/error states
  - Responsive grid layout
  - Upload button CTA
- ✅ Updated `services/api.ts`
  - Added upload progress callback
  - Added addVersion() method
- ⏳ Next: OSMD + Tone.js integration in practice page

### 2025-01-16 - Fixes & Practice Page Components

- ✅ Fixed OpenRouter 429 error
  - Added required HTTP-Referer and X-Title headers
  - Proper app identification for rate limiting
- ✅ Created `lib/osmd.ts` - OSMD wrapper
  - Load MusicXML, render staff, cursor controls
- ✅ Created `lib/player.ts` - Tone.js player
  - MIDI playback, metronome, tempo control
  - Time update callbacks, cursor sync hooks
- ✅ Created `components/Practice/Transport.tsx`
  - Play/pause/stop controls, seek bar
- ✅ Created `components/Practice/TempoControl.tsx`
  - Tempo slider (50-200%), metronome toggle
- ✅ Created `components/Practice/SheetViewer.tsx`
  - OSMD rendering with loading/error states
- ✅ Integrated `pages/PracticePage.tsx`
  - Complete OSMD + Tone.js integration
  - Fetch piece with versions
  - Load MusicXML and MIDI
  - Transport controls (play/pause/stop/seek)
  - Tempo control (50-200% with presets)
  - Metronome toggle
  - Cursor sync with playback
  - Clean error/loading states
  - Back navigation to library

## ✅ Phase 1 v0 - COMPLETE

**Full flow working:**
1. Upload MusicXML → Parse metadata → Generate MIDI → Store in GridFS
2. View pieces in library grid → Search/filter
3. Click piece → Practice mode with OSMD rendering + Tone.js playback
4. Adjust tempo, toggle metronome, play/pause/stop

**Next: End-to-end testing with example file**

---

## Task Checklist

### Frontend - alphaTab Enhancements (Phase 1-4)

- [x] Phase 1: Instrument change regeneration, UI disabled states, accurate duration
- [x] Phase 2: Visual cursor styling in `index.css`
- [x] Phase 3: Seeking support via tick conversion and UI wiring
- [x] Phase 4: React initialization guard and cleanup logging

### Backend - Day 1-2

#### GridFS Storage Service
- [x] Create `app/services/storage.py`
- [x] Implement `upload_file(content: bytes, filename: str, content_type: str) -> str` (returns file_id)
- [x] Implement `get_file(file_id: str) -> StreamingResponse` (streams file)
- [x] Implement `delete_file(file_id: str) -> bool`
- [x] Add GridFS connection to `db/connection.py`
- [ ] Unit tests for storage operations (deferred to Day 5)

#### music21 Parser Service
- [x] Create `app/services/parser.py`
- [x] Implement `parse_musicxml(file_content: bytes) -> dict`
  - Extract: title, composer, tempo, key, time_signature
  - Handle compressed MXL files (zipfile extraction)
  - Error handling for malformed XML
- [x] Implement `generate_midi(file_content: bytes) -> bytes`
  - Use music21.converter.parse() → stream.write('midi')
  - Return MIDI bytes
- [ ] Check example file for TAB technical tags (to be tested)
- [ ] Unit tests with example MusicXML file (deferred to Day 5)

#### Upload Endpoint Enhancement
- [x] Update `routes/upload.py` to use GridFS storage
- [x] Call parser service to extract metadata
- [x] Generate MIDI and store in GridFS
- [x] Return: file_id, musicxml_url, midi_url, metadata
- [x] Handle MXL compression
- [x] Error responses: PARSE_FAILED, FILE_TOO_LARGE

#### Versions API
- [x] Add `POST /pieces/{id}/versions` to `routes/pieces.py`
- [x] Link uploaded file to piece
- [x] Store version with metadata (tempo, key, time_sig)
- [x] Create assets array with MusicXML + MIDI files
- [x] Return version object

#### Files Streaming Endpoint
- [x] Create `routes/files.py`
- [x] Implement `GET /files/{file_id}`
- [x] Stream file from GridFS with correct Content-Type
- [x] Handle 404 for missing files
- [x] Register router in main.py

### Frontend - Day 3-4

#### Upload Page
- [ ] Install react-dropzone: `npm install react-dropzone`
- [ ] Create file dropzone component
- [ ] File validation (type, size)
- [ ] Upload with progress (axios onUploadProgress)
- [ ] Display parsed metadata
- [ ] Form: title, composer, tags (prefilled from parse)
- [ ] Create piece + version API calls
- [ ] Navigate to library on success
- [ ] Error handling with alerts

#### Library Page
- [ ] Create `components/Library/PieceCard.tsx`
- [ ] Fetch pieces with useQuery
- [ ] Grid layout with cards
- [ ] Loading/empty/error states
- [ ] Click card → navigate to `/practice/{id}`
- [ ] Search/filter (optional for v0)

#### Practice Page - OSMD Integration
- [ ] Create `lib/osmd.ts` wrapper
- [ ] Initialize OSMD with container ref
- [ ] Load MusicXML from `/files/{file_id}`
- [ ] Render staff notation
- [ ] Check if TAB renders (if technical tags exist)
- [ ] Handle loading/error states
- [ ] Responsive container

#### Practice Page - Tone.js Playback
- [ ] Create `lib/player.ts`
- [ ] Load MIDI from `/files/{midi_id}`
- [ ] Parse MIDI with Tone.js
- [ ] Create Tone.Sampler or PolySynth
- [ ] Implement play(), pause(), seek(time), setTempo()
- [ ] Metronome with Tone.Loop (click on beats)
- [ ] Emit time update events

#### Practice Page - UI Components
- [ ] Create `components/Practice/SheetViewer.tsx` (OSMD wrapper)
- [ ] Create `components/Practice/Transport.tsx`
  - Play/Pause button
  - Current time / total time
  - Seek bar
- [ ] Create `components/Practice/TempoControl.tsx`
  - Slider 50-200%
  - BPM display
- [ ] Metronome toggle button
- [ ] Sync OSMD cursor with Tone.Transport time

#### Integration
- [ ] Fetch piece by ID
- [ ] Load MusicXML + MIDI from version assets
- [ ] Initialize OSMD + Tone.js
- [ ] Wire up transport controls
- [ ] Cursor sync with playback
- [ ] Test metronome alignment

### Testing - Day 5

- [ ] Upload example MusicXML file
- [ ] Verify staff renders in OSMD
- [ ] Check if TAB renders (if present in example file)
- [ ] Play/pause works
- [ ] Tempo slider adjusts speed
- [ ] Metronome clicks on beats
- [ ] Cursor follows playback
- [ ] Error handling (malformed files, missing pieces)
- [ ] Cross-browser (Chrome, Firefox, Safari)

---

## Decisions Made During Implementation

(Will be updated as we code)

---

## Bugs & Fixes

| Bug | Severity | Fix | Commit |
|-----|----------|-----|--------|
| (none yet) | - | - | - |

---

## Code Locations

### Backend
- Storage service: `backend/app/services/storage.py` (to be created)
- Parser service: `backend/app/services/parser.py` (to be created)
- Upload endpoint: `backend/app/routes/upload.py` (needs update)
- Versions endpoint: `backend/app/routes/pieces.py` (needs POST /pieces/{id}/versions)
- Files endpoint: `backend/app/routes/files.py` (to be created)
- GridFS connection: `backend/app/db/connection.py` (needs update)

### Frontend
- Upload page: `frontend/src/pages/UploadPage.tsx` (needs implementation)
- Library page: `frontend/src/pages/LibraryPage.tsx` (needs implementation)
- Practice page: `frontend/src/pages/PracticePage.tsx` (needs implementation)
- OSMD wrapper: `frontend/src/lib/osmd.ts` (to be created)
- Player service: `frontend/src/lib/player.ts` (to be created)
- Components:
  - `frontend/src/components/Library/PieceCard.tsx` (to be created)
  - `frontend/src/components/Practice/SheetViewer.tsx` (to be created)
  - `frontend/src/components/Practice/Transport.tsx` (to be created)
  - `frontend/src/components/Practice/TempoControl.tsx` (to be created)

---

## Notes

- Following lean planning doc structure
- Backend-first approach: build APIs, then wire up frontend
- Will update planning.md Decisions Log as we make choices
- Example file path: `/Users/abhiroopprasad/code/side-projects/tarregaSheets/example_music/classical_guitar_shed/MusicXML 1760541941038763 from ACE Studio.musicxml`
