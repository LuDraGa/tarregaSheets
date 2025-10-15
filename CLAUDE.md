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

1. **Begin with Planning**: Create `docs/_active/planning.md`
   - Document the "why" behind decisions
   - Explore design alternatives and get user approval
   - Include API contracts, data models, UX flows

2. **Move to Execution**: Create `docs/_active/execution.md`
   - List concrete implementation tasks with status indicators
   - Track completion status in real-time
   - Update as you discover new tasks

3. **Post-Commit**: Husky hook archives both to `docs/archived/YYYY-MM-DD/`

### Example Planning Doc

```markdown
# Planning: Add PDF Upload Support

## Goal
Allow users to upload PDF sheet music and parse it into playable format.

## Approach
- Use pdf2image to convert PDF pages to images
- Use OMR (Optical Music Recognition) library or AI model
- Fall back to manual bar alignment if parsing fails

## API Contract
POST /upload
Request: multipart/form-data with PDF file
Response: { piece_id, version_id, parse_status }

## Questions
- Which OMR library? (Audiveris vs AI model)
- Storage: MongoDB GridFS or S3?
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
