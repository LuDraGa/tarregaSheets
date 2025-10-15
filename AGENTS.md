# AGENTS.md

This playbook gathers the ground rules for any coding agent operating in the TarregaSheets repository. Use it alongside the rest of the docs to stay aligned with the user's workflow and tooling expectations.

## Repository Orientation

- Guitar practice platform for sheet music storage, playback, and transcription (see `README.md` and `docs/phases/`).
- **Monorepo** structure with separate backend (Python/FastAPI) and frontend (React/TypeScript/Vite).
- Backend: `backend/app/` with FastAPI + MongoDB + music processing (music21, mido).
- Frontend: `frontend/src/` with React + alphaTab + OpenSheetMusicDisplay + Tone.js.

## Command Palette

### IMPORTANT: Dependency Management Rules

**Backend (Python/uv)**:
- **NEVER run `uv sync` or `uv install`** - User manages virtual environment activation and dependencies manually
- User activates uv virtual environment: `source .venv/bin/activate` (or equivalent)
- User runs `uv sync` when adding dependencies or after cloning
- Agents can suggest `uv add <package>` when new dependencies are needed, but user executes it

**Frontend (Node/npm)**:
- Uses **Node 20** (specified in `frontend/.nvmrc`)
- User runs `nvm use` in `frontend/` directory to switch to Node 20
- Agents can suggest `npm install` when dependencies change, user executes it
- No root `package.json` - frontend and backend are independent workspaces

### App Lifecycle (user runs these)

**Backend** (from `backend/` directory):
```bash
# User setup (first time or after dependencies change)
source .venv/bin/activate  # Activate uv virtual environment
uv sync                     # Install/sync dependencies

# Start development server
uv run fastapi dev app/main.py
```
⚠️ **Agents**: Prompt user to run backend commands; do NOT execute `uv` commands yourself.

**Frontend** (from `frontend/` directory):
```bash
# User setup (first time or after dependencies change)
nvm use        # Switch to Node 20
npm install    # Install dependencies

# Start development server
npm run dev    # Starts Vite on port 5173
```
⚠️ **Agents**: Prompt user to run frontend dev server; do NOT start it yourself.

### Quality Gates (agents may run when appropriate)

**Backend** (from `backend/` directory):
- `uv run ruff check .` – lint Python code (agents can run)
- `uv run ruff format .` – format Python code (agents can run)
- `uv run pytest` – run tests when they exist (agents can run)

**Frontend** (from `frontend/` directory):
- `npm run lint` – ESLint checks (agents can run)
- `npm run lint:fix` – autofix ESLint issues (agents can run)
- `npm run typecheck` – TypeScript compiler diagnostics (agents can run)
- `npm run build` – production build to verify no errors (agents can suggest, user runs)

## Environment Requirements

**CRITICAL**: User must create `.env` file before backend can run.

Steps (USER PERFORMS):
1. Copy `.env.example` to `.env` in project root
2. Fill in MongoDB Atlas connection URL (`MONGODB_URL`)
3. Fill in OpenRouter API key (`OPENROUTER_API_KEY`)
4. Optionally adjust `DATABASE_NAME` (defaults to `tarregasheets`)

Backend loads configuration via `app/config.py` using pydantic-settings.

## Music File Handling

- **Supported formats**: PDF, MusicXML (.xml), compressed MusicXML (.mxl), MIDI (.mid).
- **Storage**: MongoDB GridFS for uploaded files; consider S3/Vercel Blob for production.
- **Parsing**:
  - MusicXML: Use `music21.converter.parse()`.
  - MIDI: Use `mido` or `pretty_midi`.
  - PDF: Future phase will include OMR (Optical Music Recognition); for now, manual alignment.
- **Validation**: Always validate file format before processing; handle malformed MusicXML gracefully.

## Code Navigation Strategy

- **Preferred**: Use `Grep` tool with `type` parameter for structured searches.
  - Python: `pattern: "class.*Model"`, `type: "py"`
  - TypeScript: `pattern: "interface.*Props"`, `type: "ts"`
- **Glob** for file discovery: `pattern: "**/*.tsx"` or `pattern: "backend/**/*.py"`.
- Keep responses scoped to ASCII unless the file already uses other characters.

## Architecture Cheat Sheet

### Backend (FastAPI + MongoDB)

- `app/main.py` – FastAPI app entry, CORS setup, route registration.
- `app/config.py` – Environment variables and settings.
- `app/models/` – Pydantic models for Piece, Version, PracticeStat, User.
- `app/routes/` – API endpoints (pieces, upload, practice stats).
- `app/services/` – Business logic:
  - `parser.py` – MusicXML/MIDI parsing.
  - `converter.py` – Format conversion (MusicXML ↔ MIDI ↔ internal JSON).
  - `openrouter.py` – AI client for future features (OCR, chord detection).
- `app/db/` – MongoDB connection and schemas.

**Key patterns**:
- All routes return Pydantic models.
- Use dependency injection for DB connection (`Depends(get_db)`).
- Handle file uploads with `UploadFile` and validate MIME types.

### Frontend (React + TypeScript)

- `src/App.tsx` – Root component with routing and global state.
- `src/components/` – Feature-based organization:
  - `Library/` – Piece list, filters, search.
  - `Practice/` – Sheet music viewer, playback controls, A/B loop.
  - `Upload/` – File upload UI and progress.
- `src/services/` – API client and audio playback:
  - `api.ts` – Fetch wrapper for backend endpoints.
  - `player.ts` – Tone.js transport, MIDI synthesis, metronome, A/B loop.
- `src/lib/` – Music rendering:
  - `alphaTab.ts` – Guitar tablature rendering (GPX or internal JSON).
  - `osmd.ts` – Staff notation rendering (MusicXML).
- `src/types/` – TypeScript interfaces for Piece, Version, Player state.

**Key patterns**:
- Functional components with TypeScript; explicit return types.
- React Query for API state management (fetching, caching, mutations).
- Zustand for local state (player controls, UI state).
- Tailwind CSS for styling (no CSS modules).

## Workflow Expectations

1. **Plan first** – Create `docs/_active/planning.md` describing intent, alternatives, API contracts, UX flows.
2. **Execution log** – Track concrete tasks in `docs/_active/execution.md` with live status updates.
3. **Post-commit** – Husky post-commit hook archives active docs to `docs/archived/YYYY-MM-DD/`.

### Planning Document Structure

For significant features, the planning doc should include:

```markdown
# Planning: [Feature Name]

## Goal
What are we building and why?

## Technical Approach
- Libraries/tools to use
- Data models
- API endpoints
- UX flow

## API Contract (if applicable)
Endpoint, request/response shapes, status codes

## Data Models (if applicable)
Pydantic/TypeScript schemas

## Questions & Decisions
- Open questions to resolve
- Design alternatives considered
```

## Music Processing Guidelines

### MusicXML Parsing
- Always validate XML before parsing.
- Handle missing time signatures, keys, or tempo marks with sensible defaults.
- Use `music21` for parsing and manipulation; it has excellent MusicXML support.

### MIDI Generation
- Use `mido` for low-level MIDI I/O.
- Use `pretty_midi` for higher-level composition.
- Default to General MIDI instrument 24 (acoustic guitar, nylon strings).

### Tablature Generation (Future Phase 2)
- Requires fingering solver (dynamic programming with position costs).
- Constraints: fret range 0-22, stretch ≤4 frets, capo compatibility.
- For Phase 1, display naive TAB (pitch → string/fret without optimization).

### Audio Transcription (Future Phase 2)
- Use `basic-pitch` (Spotify) for onset/pitch detection.
- Use `CREPE` for f0 refinement on sustained notes.
- Use `librosa` for beat tracking and tempo estimation.

## Collaboration Etiquette

- Never revert user-authored changes unless explicitly instructed.
- Highlight when manual commands/tests should be run instead of running them yourself (especially `npm run dev`, `fastapi dev`).
- Add concise explanatory comments only when code is non-obvious (e.g., complex music algorithms).
- Stop immediately and alert the user if unexpected external modifications appear.

## Testing Expectations

### Backend
- Write unit tests for services (parser, converter).
- Use `pytest` with async support (`pytest-asyncio`).
- Mock MongoDB with `mongomock` or test fixtures.
- Test API endpoints with `httpx.AsyncClient`.

### Frontend
- Write component tests with React Testing Library.
- Use Vitest for unit tests.
- Mock API calls with MSW (Mock Service Worker).
- E2E tests with Playwright (future).

## Deployment Notes

- **Vercel** hosts both frontend and backend (serverless functions).
- **MongoDB Atlas** is the production database.
- CI/CD: Auto-deploy on push to `main` branch.
- `vercel.json` handles monorepo routing (frontend at root, backend at `/api/*`).

## Performance & Optimization

- **Lazy load** heavy libraries (alphaTab, OpenSheetMusicDisplay) using dynamic imports.
- **Web workers** for heavy parsing (MusicXML, PDF) to avoid blocking UI.
- **IndexedDB** for caching rendered sheet music (avoid re-rendering).
- **Virtualization** for long lists (library view with hundreds of pieces).

## Common Pitfalls

1. **MusicXML quirks**: Not all exporters follow the spec; always validate and handle errors.
2. **Tone.js timing**: Use `Tone.context.currentTime` for scheduling, not `Date.now()`.
3. **MongoDB async**: All Motor operations return promises; always `await`.
4. **CORS**: FastAPI needs explicit CORS middleware for local dev (frontend on 5173, backend on 8000).
5. **File upload validation**: Check MIME type and file extension before processing.

## AI Feature Integration

- **Model**: Grok4Fast via OpenRouter (fast, cost-effective).
- **Use cases** (current/future):
  - PDF OCR assistance (Phase 1, later).
  - Chord detection from audio (Phase 2).
  - Fingering suggestions (Phase 2).
  - Genre/style tagging (Phase 3).
- **Client**: `backend/app/services/openrouter.py` wraps API calls.
- **Error handling**: Always handle API failures gracefully; log errors and return fallback.

## Phase-Specific Context

### Phase 1 (Current): Library & Practice
- Focus: Import, organize, render, playback.
- No transcription or audio processing yet.
- PDF parsing is basic (no OCR); manual bar alignment if needed.
- TAB rendering is naive (pitch → string/fret, no optimization).

### Future Phases (Reference Only)
- **Phase 2**: Audio transcription (solo guitar → sheet + optimized TAB).
- **Phase 3**: Source separation (YouTube/multi-track → isolated guitar).
- **Phase 4**: Intelligent arrangements (ensemble → solo guitar arrangement).

See `docs/phases/` for detailed roadmaps.

## Useful Resources

- **FastAPI**: https://fastapi.tiangolo.com
- **MongoDB Motor**: https://motor.readthedocs.io
- **music21**: https://web.mit.edu/music21/
- **mido**: https://mido.readthedocs.io
- **alphaTab**: https://alphatab.net
- **OpenSheetMusicDisplay**: https://opensheetmusicdisplay.org
- **Tone.js**: https://tonejs.github.io
- **Vercel Monorepo**: https://vercel.com/docs/monorepos

## Final Notes

- This is a personal project with high quality standards.
- Design partners and early users will test features; prioritize robustness and UX polish.
- Music data is precious; always validate before write operations to MongoDB.
- Stay mindful of the user's tooling constraints and confirm next steps (tests, commits, builds) after significant changes.
