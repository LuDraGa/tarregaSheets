# CLAUDE.md

This file provides guidance to Claude Code when working with the TarregaSheets codebase.

## Application Overview

TarregaSheets is a guitar practice platform with:
- **Backend**: FastAPI (Python) with MongoDB for data persistence
- **Frontend**: React + TypeScript + Vite for interactive sheet music rendering and playback
- **Music Libraries**: alphaTab (TAB), OpenSheetMusicDisplay (staff), Tone.js (playback)

## Commands

### Development

**IMPORTANT SETUP NOTES**:
- **Backend (Python)**: User manages `uv` virtual environment activation and dependencies manually
  - Agents should NEVER run `uv sync` or `uv install` commands
  - User will activate virtual environment (`source .venv/bin/activate` or equivalent)
  - User will run `uv sync` to install dependencies when needed
- **Frontend (TypeScript/Node)**: Uses Node 20 (specified in `.nvmrc`)
  - Run `nvm use` in `frontend/` to switch to Node 20
  - Agents can suggest `npm install` when dependencies change
- **No root package.json**: This is a monorepo with independent backend (Python) and frontend (Node) workspaces

**CRITICAL: Server Management**:
- **NEVER start or restart development servers** (backend, frontend, database, etc.) without explicitly asking the user first
- User manages all server processes themselves
- Agents should only suggest when a restart may be needed, not execute it

**Backend** (from `backend/` directory - USER RUNS THESE):
```bash
# User activates uv virtual environment first
source .venv/bin/activate   # or: . .venv/bin/activate

# User installs/syncs dependencies manually
uv sync

# Development commands (agents can suggest these)
uv run fastapi dev app/main.py        # Start dev server with hot reload
uv add <package>                       # Add new dependency
uv run pytest                          # Run tests
uv run ruff check .                    # Lint
uv run ruff format .                   # Format
```

**Frontend** (from `frontend/` directory):
```bash
# Use Node 20 (specified in .nvmrc)
nvm use

# Install dependencies (run this after cloning or when package.json changes)
npm install

# Development commands
npm run dev                            # Start Vite dev server (port 5173)
npm run build                          # Production build
npm run preview                        # Preview production build
npm run lint                           # ESLint
npm run lint:fix                       # Fix ESLint issues
npm run typecheck                      # TypeScript checks
```

### Code Quality

- **Backend**: Uses Ruff for linting and formatting (configured in `pyproject.toml`)
- **Frontend**: Uses ESLint (configured in `eslint.config.js`)
- Always run linters before commits

## Environment Setup

**IMPORTANT**: User must set up `.env` file manually before running backend.

Required environment variables (see `.env.example`):
- `MONGODB_URL` - MongoDB Atlas connection string (user provides)
- `OPENROUTER_API_KEY` - OpenRouter API key for AI features (user provides)
- `DATABASE_NAME` - MongoDB database name (default: `tarregasheets`)

Steps:
1. Copy `.env.example` to `.env`
2. Fill in MongoDB URL and OpenRouter API key
3. Backend loads config via `app/config.py` using pydantic-settings

## Code Search Strategy

**Use Grep tool (PREFERRED)**:
- Search Python code: `pattern: "class.*Model"`, `type: "py"`
- Search TypeScript/React: `pattern: "interface.*Props"`, `type: "ts"`
- Cross-language searches

**Use Glob for file discovery**:
- Find files: `pattern: "**/*.tsx"`

## Project Structure

```
tarregaSheets/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app entry
│   │   ├── config.py            # Settings (env vars, MongoDB)
│   │   ├── models/              # Pydantic models
│   │   │   ├── piece.py
│   │   │   ├── version.py
│   │   │   └── practice_stat.py
│   │   ├── routes/              # API endpoints
│   │   │   ├── pieces.py
│   │   │   └── upload.py
│   │   ├── services/            # Business logic
│   │   │   ├── parser.py        # MusicXML/PDF parsing
│   │   │   ├── converter.py     # Format conversion
│   │   │   └── openrouter.py    # AI client
│   │   └── db/                  # MongoDB
│   │       ├── connection.py
│   │       └── schemas.py
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/          # React components
│   │   │   ├── Library/
│   │   │   ├── Practice/
│   │   │   └── Upload/
│   │   ├── services/            # API & player
│   │   │   ├── api.ts          # Backend API client
│   │   │   └── player.ts       # Tone.js playback
│   │   ├── types/               # TypeScript types
│   │   │   ├── piece.ts
│   │   │   └── player.ts
│   │   └── lib/                 # Music rendering
│   │       ├── alphaTab.ts
│   │       └── osmd.ts
│   └── package.json
└── docs/
    ├── phases/
    └── _active/
```

## Technical Architecture

### Backend (FastAPI + MongoDB)

- **FastAPI** for async REST API
- **Motor** for async MongoDB access
- **Pydantic** for request/response validation
- **Music21** for MusicXML parsing and manipulation
- **Mido** for MIDI generation

**Key patterns**:
- All routes return Pydantic models
- Use dependency injection for DB connection
- Handle file uploads with `UploadFile`
- Store files in MongoDB GridFS or external storage

### Frontend (React + TypeScript)

- **React 19** with functional components and hooks
- **React Query** for API state management
- **Zustand** for local state (player, UI)
- **Tailwind CSS** for styling

**Key patterns**:
- Components organized by feature (Library, Practice, Upload)
- `services/api.ts` centralizes all backend calls
- `services/player.ts` manages Tone.js transport and MIDI playback
- Music rendering happens in `lib/` with alphaTab and OSMD wrappers

## Development Workflow

### Planning-First Development

ALL significant development work MUST follow this workflow:

1. **Begin with Planning**: Update `docs/_active/planning.md` (lean 1-page format)
   - Start with TL;DR (≤3 bullets): what, why, success metric
   - Define Goals/Non-Goals and Scope (In/Out)
   - Sketch architecture (1 paragraph + ASCII diagram)
   - List top 3 risks with mitigations
   - Add open questions with owners
   - Set success metrics & rough timeline
   - Link to annexes ONLY if needed (detailed context, complex models, diagrams)

2. **Move to Execution**: Update `docs/_active/execution.md`
   - List concrete implementation tasks with status indicators
   - Track completion status in real-time
   - Log decisions made during implementation
   - Record bugs/fixes, code locations, lessons learned

3. **Update Planning During Execution**:
   - Add decisions to Decisions Log (with date & 1-way/2-way flag)
   - Mark open questions as resolved
   - Add new risks if discovered
   - Keep the 1-pager current (don't let it go stale!)

4. **Create Annexes Only When Needed**:
   - `docs/features/[feature-name]/context.md` - Detailed background, user research
   - `docs/features/[feature-name]/models.md` - Full Pydantic/TS schemas
   - `docs/features/[feature-name]/diagrams.md` - Sequence diagrams, C4 models
   - Link annexes from planning.md "Optional Annexes" section

5. **Post-Commit**: Husky hook archives both to `docs/archived/YYYY-MM-DD/`

### Workflow Benefits

✅ **planning.md stays lean (1 page)** - Easy to scan, quick to update
✅ **Cross-session continuity** - New agents/humans get up to speed fast
✅ **Decision tracking** - Decisions Log captures "why" with dates
✅ **Opt-in detail** - Deep specs in annexes, not cluttering main doc
✅ **Human-friendly** - Designed for quick human updates between sessions

**Read `docs/_active/README.md` for full documentation structure details.**

### Example Planning Doc

```markdown
# Planning: Add PDF Upload Support

**Date**: 2025-01-16 · **Owner**: Team · **Status**: In Review

## 1) TL;DR (≤3 bullets)

* Add PDF upload to allow users to import scanned sheet music
* Enables practice for users who only have PDF files (no MusicXML)
* Success: 80% of uploaded PDFs parse successfully with minimal manual fixes

## 2) Goals / Non-Goals

* **Goals:** Upload PDF → parse to MusicXML → render staff + TAB
* **Non-Goals:** Handwriting recognition, chord detection (Phase 2)

## 3) Scope (In / Out)

* **In:** Multi-page PDFs, OMR library integration, manual alignment fallback
* **Out:** Real-time preview during upload, AI-based correction

## 4) Architecture (One paragraph + ASCII)

User uploads PDF via frontend → backend splits pages with pdf2image → OMR library parses staff/notes → converts to internal JSON → stores in MongoDB → frontend renders with OSMD.

```
User → FE (Upload) → API (POST /upload) → pdf2image → OMR → JSON → MongoDB → FE (OSMD)
```

## 5) Contract Snapshot (stable bits only)

```
POST /api/upload  v1
Req: multipart/form-data (file: PDF)
200: { "piece_id":"abc123", "parse_status":"success", "pages_parsed":3 }
Errors: INVALID_FILE | PARSE_FAILED | FILE_TOO_LARGE
```

## 6) Risks & Mitigations (Top 3)

| Risk                  | Mitigation                         |
| --------------------- | ---------------------------------- |
| OMR parsing errors    | Manual alignment UI as fallback    |
| Large file upload     | Limit to 10MB, async processing    |
| Storage costs (GridFS)| Evaluate S3 if >100 uploads/month  |

## 7) Decisions Log

| Date       | Decision              | Type (1-way/2-way) | Why/Link     |
| ---------- | --------------------- | ------------------ | ------------ |
| 2025-01-16 | Use Audiveris for OMR | 2-way              | Can swap later if accuracy is low |
| 2025-01-16 | MongoDB GridFS first  | 2-way              | S3 if needed |

## 8) Open Questions (with owners)

* [ ] Which OMR library? Audiveris vs AI model — **Owner:** Backend lead — **Due:** 2025-01-18
* [ ] Storage limit per user? — **Owner:** Product — **Due:** TBD

## 9) Success Metrics

* ≥80% parse success rate · Upload + parse <5s · ≤5% manual alignment needed

## 10) Timeline (plan, not commitment)

* Research OMR: 0.5d · Backend upload: 1d · Frontend UI: 0.5d · Testing: 0.5d

---

### Optional Annexes (link only when needed)

* **Annex A: OMR Library Comparison** → [context.md](/docs/features/pdf-upload/context.md)
```

## File Conventions

### Backend (Python)
- Use type hints everywhere
- Pydantic models for all data structures
- Async/await for I/O operations
- Docstrings for public functions

### Frontend (TypeScript)
- Functional components with TypeScript
- Props interfaces for all components
- Export named functions/interfaces (avoid default exports)
- Use `React.FC` sparingly; prefer explicit return types

## Music Library Integration

### alphaTab (Guitar TAB)
- Render guitar tablature from internal JSON or GPX
- Located in `frontend/src/lib/alphaTab.ts`
- Supports interactive playback sync

### OpenSheetMusicDisplay (Staff notation)
- Render staff from MusicXML
- Located in `frontend/src/lib/osmd.ts`
- Provides cursor for playback sync

### Tone.js (Playback)
- MIDI synthesis with `Tone.Sampler`
- Transport controls (play/pause/seek)
- Metronome via `Tone.Loop`
- A/B loop via custom markers

## MongoDB Schema Patterns

Use embedded documents for tightly coupled data:
```python
# Piece with embedded versions
{
  "_id": ObjectId,
  "title": "Asturias",
  "composer": "Albéniz",
  "versions": [
    {
      "id": "v1",
      "source_type": "musicxml",
      "assets": [...]
    }
  ]
}
```

Use references for loosely coupled data:
```python
# PracticeStat references piece
{
  "piece_id": ObjectId,
  "user_id": ObjectId,
  "stats": {...}
}
```

## Error Handling

### Backend
- Use `HTTPException` for API errors
- Return proper status codes (400, 404, 500)
- Log errors with structured logging

### Frontend
- Use React Error Boundaries for component errors
- Display user-friendly messages via toast/modal
- Log errors to console in dev, external service in prod

## Deployment

- **Vercel**: Frontend + backend (serverless functions)
- **MongoDB Atlas**: Database
- **CI/CD**: Automatic deploys on push to `main`

Vercel configuration in `vercel.json` handles monorepo routing.

## Performance Considerations

- Lazy load music libraries (alphaTab, OSMD) to reduce initial bundle size
- Use web workers for heavy parsing (MusicXML, PDF)
- Virtualize long piece lists in library view
- Cache rendered sheet music in IndexedDB

## Testing Strategy

### Backend
- `pytest` for unit tests
- `httpx` for API integration tests
- Test fixtures for MongoDB

### Frontend
- Vitest for unit tests
- React Testing Library for component tests
- Playwright for E2E tests (future)

## Post-Commit Hook Setup

Husky manages git hooks. After commit, active docs are archived:

```bash
.husky/post-commit
#!/bin/sh
timestamp=$(date +"%Y-%m-%d")
mkdir -p docs/archived/$timestamp
mv docs/_active/* docs/archived/$timestamp/
git add docs/archived/$timestamp
```

This keeps `docs/_active/` clean for the next task while preserving history.

## AI Features (OpenRouter)

- AI model: Grok4Fast for speed
- Use cases: PDF OCR assistance, chord detection, fingering suggestions
- Client in `backend/app/services/openrouter.py`
- Always handle API failures gracefully

## Common Pitfalls

1. **MongoDB async**: Use `await` for all Motor operations
2. **CORS**: Configure FastAPI CORS middleware for frontend origin
3. **File uploads**: Validate file types before processing
4. **Music parsing**: MusicXML can be malformed; always validate
5. **Tone.js timing**: Use `Tone.context.currentTime` for scheduling, not `Date.now()`

## Useful Resources

- FastAPI docs: https://fastapi.tiangolo.com
- MongoDB Motor: https://motor.readthedocs.io
- alphaTab: https://alphatab.net
- OpenSheetMusicDisplay: https://opensheetmusicdisplay.org
- Tone.js: https://tonejs.github.io
