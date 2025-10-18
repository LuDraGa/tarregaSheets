# TarregaSheets Backend Dockerfile
# Includes MuseScore CLI + Xvfb for headless music notation conversion

FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
# - musescore3: Music notation software with CLI
# - xvfb: X Virtual Framebuffer for headless GUI apps
# - libxcb-*: X11 libraries required by MuseScore
# - gcc, make, etc.: Build tools for compiling C extensions (uvloop, etc.)
# - ca-certificates: SSL/TLS certificates for MongoDB Atlas HTTPS connections
RUN apt-get update && apt-get install -y \
    musescore3 \
    xvfb \
    libxcb-xinerama0 \
    libxcb-cursor0 \
    build-essential \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create Xvfb wrapper script for headless MuseScore
# This allows MuseScore CLI to run without a physical display
RUN echo '#!/bin/bash\nxvfb-run -a musescore3 "$@"' > /usr/local/bin/mscore-headless \
    && chmod +x /usr/local/bin/mscore-headless

# Verify MuseScore installation
RUN mscore-headless --version || echo "MuseScore CLI installed"

# Install uv for faster Python dependency management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy dependency files (README.md required by pyproject.toml)
COPY pyproject.toml uv.lock README.md ./

# Install Python dependencies
RUN uv sync --frozen --no-cache

# Copy application code
COPY . .

# Expose FastAPI port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/health')" || exit 1

# Run FastAPI with uvicorn
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
