#!/bin/bash

# TarregaSheets Dev Server Launcher
# Starts both backend and frontend with hot reload

set -e

echo "🎸 Starting TarregaSheets development servers..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to cleanup background processes on exit
cleanup() {
    echo ""
    echo "🛑 Stopping servers..."
    kill $BACKEND_PID 2>/dev/null || true
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start backend in background
echo -e "${BLUE}[Backend]${NC} Starting FastAPI server..."
cd backend
source .venv/bin/activate
uv run fastapi dev app/main.py &
BACKEND_PID=$!
cd ..

# Wait a moment for backend to start
sleep 2

# Start frontend in foreground
echo -e "${GREEN}[Frontend]${NC} Starting Vite dev server..."
cd frontend
npm run dev

# If frontend exits, cleanup backend
cleanup
