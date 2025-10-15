# TarregaSheets

> A comprehensive guitar practice platform for storing sheet music, interactive playback, and intelligent transcription.

Named after Francisco Tárrega, the legendary Spanish classical guitarist and composer.

## Overview

TarregaSheets is a multi-phase platform designed to revolutionize guitar practice and music management:

1. **Sheet Music Library & Practice** - Import, organize, and practice with PDF/MusicXML/MXL files with intelligent playback
2. **Audio Transcription** - Convert clean solo guitar recordings to sheet music and playable tablature
3. **Source Separation** - Extract guitar from multi-instrument tracks (YouTube, recordings)
4. **Intelligent Arrangements** - Transform ensemble pieces into single-guitar arrangements

## Current Phase: Phase 1 - Library & Practice

### Features (v0)

- **Import & Parse**: PDF (single/multi-page), MusicXML, MXL formats
- **Rendering**: Staff notation via OpenSheetMusicDisplay
- **Playback**:
  - MIDI synthesis with metronome
  - A/B loop selection
  - Tempo control (50-150%)
  - Count-in functionality
- **Project Management**:
  - Organize pieces with versions and assets
  - Tag by composer, tuning, capo position
  - Track practice statistics
- **Export**: MIDI, MusicXML

### Tech Stack

#### Backend
- **Python 3.12+** with `uv` package manager
- **FastAPI** for REST API with Pydantic validation
- **MongoDB Atlas** for data persistence
- **OpenRouter + Grok4Fast** for AI-powered features
- Music libraries: `music21`, `mido`, `pretty_midi`

#### Frontend
- **React 19** with TypeScript
- **Vite** for blazing-fast development
- **Tailwind CSS** for styling
- **alphaTab** for professional guitar tablature
- **OpenSheetMusicDisplay** for sheet music rendering
- **Tone.js** for audio synthesis and playback

#### Infrastructure
- **Husky** for git hooks management
- **Vercel** deployment with CI/CD on main branch
- **MongoDB Atlas** for cloud database

## Getting Started

### Prerequisites

- **Node.js 20** (use nvm: `nvm install 20 && nvm use 20`)
- **Python 3.12+**
- **uv** package manager: `curl -LsSf https://astral.sh/uv/install.sh | sh`
- **MongoDB Atlas** account (for database)
- **OpenRouter API key** (for AI features)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd tarregaSheets
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env and fill in:
   # - MONGODB_URL (your MongoDB Atlas connection string)
   # - OPENROUTER_API_KEY (your OpenRouter API key)
   ```

3. **Backend setup** (Python with uv)
   ```bash
   cd backend

   # Activate uv virtual environment (creates .venv if not exists)
   source .venv/bin/activate

   # Install dependencies
   uv sync
   ```

4. **Frontend setup** (Node 20 with npm)
   ```bash
   cd frontend

   # Switch to Node 20 (if using nvm)
   nvm use

   # Install dependencies
   npm install
   ```

5. **Run development servers**

   **Terminal 1 - Backend:**
   ```bash
   cd backend
   source .venv/bin/activate  # Activate virtual environment
   uv run fastapi dev app/main.py
   ```
   Backend runs on: http://localhost:8000

   **Terminal 2 - Frontend:**
   ```bash
   cd frontend
   npm run dev
   ```
   Frontend runs on: http://localhost:5173

6. **Access the application**
   - Frontend UI: http://localhost:5173
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs

## Project Structure

```
tarregaSheets/
├── backend/              # Python FastAPI backend
│   ├── app/
│   │   ├── main.py      # FastAPI app
│   │   ├── config.py    # Settings & env vars
│   │   ├── models/      # Pydantic models
│   │   ├── routes/      # API endpoints
│   │   ├── services/    # Business logic
│   │   └── db/          # MongoDB schemas
│   └── pyproject.toml   # uv dependencies
├── frontend/            # React TypeScript frontend
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── services/    # API client, player
│   │   ├── types/       # TypeScript types
│   │   └── lib/         # Music rendering (alphaTab, OSMD)
│   └── package.json
├── docs/
│   ├── phases/          # Phase-by-phase roadmap
│   └── _active/         # Current planning & execution
└── package.json         # Root workspace config
```

## API Endpoints (Phase 1)

- `POST /pieces` - Create new piece
- `GET /pieces` - List all pieces (with filters)
- `GET /pieces/{id}` - Get piece details
- `PUT /pieces/{id}` - Update piece metadata
- `DELETE /pieces/{id}` - Delete piece
- `POST /pieces/{id}/versions` - Add new version
- `POST /upload` - Upload PDF/MusicXML/MXL file
- `GET /pieces/{id}/practice-stats` - Get practice statistics

## Data Models

### Piece
```python
{
  "id": str,
  "title": str,
  "composer": str,
  "tags": List[str],
  "tuning": str,  # e.g., "EADGBE"
  "capo": int,
  "created_at": datetime
}
```

### Version
```python
{
  "id": str,
  "piece_id": str,
  "source_type": Literal["pdf", "musicxml", "mxl", "midi"],
  "tempo": int,
  "key": str,
  "time_signature": str
}
```

### PracticeStat
```python
{
  "piece_id": str,
  "user_id": str,
  "bar_id": int,
  "seconds_played": float,
  "avg_tempo": int,
  "last_played_at": datetime
}
```

## Roadmap

- **Phase 1** (Current): Library & Practice - Import, organize, playback
- **Phase 2** (Q2 2025): Solo Guitar Transcription - Audio → Sheet + TAB
- **Phase 3** (Q3 2025): Source Separation - Extract guitar from mixes
- **Phase 4** (Q4 2025): Intelligent Arrangements - Ensemble → Solo guitar

See `docs/phases/` for detailed phase plans.

## Contributing

This is a personal project in active development. Design partners and early users welcome for testing and feedback.

## License

See [LICENSE](./LICENSE)

## Acknowledgments

- Francisco Tárrega - The maestro who inspired this project
- Open source music libraries: music21, alphaTab, OpenSheetMusicDisplay, Tone.js
