# MuseScore Docker Setup for Headless Conversion

**Date**: 2025-01-17
**Purpose**: Configure MuseScore CLI in Docker for headless TAB ↔ Staff conversion

---

## Overview

MuseScore requires a graphics display even in CLI mode. For headless server environments, we use **Xvfb** (X Virtual Framebuffer) to provide a virtual display.

### Architecture

```
Docker Container
├── Ubuntu 22.04 base image
├── Xvfb (virtual display server)
├── MuseScore 4 AppImage
├── Python 3.11 + FastAPI
└── Wrapper script (mscore-headless)
```

---

## Dockerfile Strategy

### Option A: Install from Package (Recommended for Simplicity)

```dockerfile
FROM python:3.11-slim

# Install MuseScore and Xvfb from apt
RUN apt-get update && apt-get install -y \
    musescore3 \
    xvfb \
    && rm -rf /var/lib/apt/lists/*

# Create Xvfb wrapper
RUN echo '#!/bin/bash\nxvfb-run -a mscore "$@"' > /usr/local/bin/mscore-headless \
    && chmod +x /usr/local/bin/mscore-headless

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . /app
WORKDIR /app

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Pros:**
- Simple, fast to build
- Smaller image size
- Maintained by Debian/Ubuntu

**Cons:**
- May be MuseScore 3.x (older version)
- Limited control over MuseScore version

---

### Option B: Download MuseScore 4 AppImage (Latest Version)

```dockerfile
FROM python:3.11-slim

# Install dependencies for AppImage and Xvfb
RUN apt-get update && apt-get install -y \
    xvfb \
    libxcb-xinerama0 \
    libxcb-cursor0 \
    libfuse2 \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Download MuseScore 4 AppImage
RUN wget -O /tmp/musescore.AppImage \
    https://github.com/musescore/MuseScore/releases/download/v4.2.0/MuseScore-4.2.0.AppImage \
    && chmod +x /tmp/musescore.AppImage \
    && /tmp/musescore.AppImage --appimage-extract \
    && mv squashfs-root /opt/musescore \
    && rm /tmp/musescore.AppImage

# Create symlink and wrapper
RUN ln -s /opt/musescore/AppRun /usr/local/bin/mscore
RUN echo '#!/bin/bash\nxvfb-run -a mscore "$@"' > /usr/local/bin/mscore-headless \
    && chmod +x /usr/local/bin/mscore-headless

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . /app
WORKDIR /app

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Pros:**
- Latest MuseScore 4.x features
- Better MusicXML/TAB support
- Consistent across deployments

**Cons:**
- Larger image size (~300-400MB)
- Longer build time
- AppImage extraction complexity

---

## Recommended Approach: Hybrid (Package First, AppImage for Production)

**Development/Testing:** Use Option A (apt package) for quick iteration

**Production:** Use Option B (AppImage) for latest features

---

## Xvfb Wrapper Script Explained

```bash
#!/bin/bash
# mscore-headless wrapper

# xvfb-run options:
#   -a: Automatically pick a free display number
#   mscore: MuseScore CLI executable
#   "$@": Pass all arguments to mscore

xvfb-run -a mscore "$@"
```

### Alternative: Start Xvfb as Daemon

```bash
# Start Xvfb on display :99
Xvfb :99 -screen 0 1024x768x24 &
export DISPLAY=:99

# Now run MuseScore commands
mscore input.musicxml -o output.pdf
```

---

## MuseScore CLI Commands for Conversion

### Basic Export

```bash
# Convert MusicXML to PDF
mscore-headless input.musicxml -o output.pdf

# Convert MusicXML to MusicXML (re-render, applies defaults)
mscore-headless input.musicxml -o output.musicxml

# Batch conversion with JSON
mscore-headless -j job.json
```

### Batch Job JSON Format

```json
[
  {
    "in": "staff_notation.musicxml",
    "out": "converted.musicxml"
  }
]
```

---

## Conversion Workflow (Staff ↔ TAB)

### Challenge: MuseScore CLI Limitations

⚠️ **Problem**: MuseScore CLI cannot directly change staff types or add tablature via command-line flags.

### Solution: Pre/Post-Processing with music21

**Staff → TAB Workflow:**
```python
# 1. Parse with music21
score = music21.converter.parse('staff.musicxml')

# 2. Add tablature staff (linked to original)
tab_staff = music21.stream.Part()
# ... populate with TAB data ...

# 3. Export combined score
score.write('musicxml', 'both.musicxml')

# 4. Run MuseScore to render (optional, for validation)
subprocess.run(['mscore-headless', 'both.musicxml', '-o', 'output.pdf'])
```

**TAB → Staff Workflow:**
```python
# 1. Parse TAB with music21 (extracts pitches from fret/string)
score = music21.converter.parse('tab.musicxml')

# 2. Create standard staff from pitches
staff_part = music21.stream.Part()
for note in score.flatten().notes:
    staff_part.append(note)  # music21 handles pitch conversion

# 3. Export as standard notation
staff_part.write('musicxml', 'staff.musicxml')
```

---

## Docker Compose Setup

**File: `docker-compose.yml`**

```yaml
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      - MONGODB_URL=${MONGODB_URL}
      - DATABASE_NAME=${DATABASE_NAME}
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
    volumes:
      - ./backend:/app
      - /tmp/.X11-unix:/tmp/.X11-unix  # For Xvfb socket (optional)
    env_file:
      - .env
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "5173:5173"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    environment:
      - VITE_API_URL=http://localhost:8000
    command: npm run dev -- --host

  mongo:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db
    environment:
      - MONGO_INITDB_DATABASE=tarregasheets

volumes:
  mongo_data:
```

---

## Testing MuseScore in Docker

### 1. Build Container

```bash
cd backend
docker build -t tarregasheets-backend .
```

### 2. Test MuseScore CLI

```bash
# Run container interactively
docker run -it --rm tarregasheets-backend bash

# Inside container, test MuseScore
mscore-headless --version
# Should output: MuseScore 3.x or 4.x

# Test conversion
mscore-headless /path/to/test.musicxml -o /tmp/test.pdf
```

### 3. Test Conversion from Python

```python
# Inside container Python shell
import subprocess

result = subprocess.run(
    ['mscore-headless', 'test.musicxml', '-o', 'output.musicxml'],
    capture_output=True,
    text=True,
    timeout=30
)

print("Return code:", result.returncode)
print("Stdout:", result.stdout)
print("Stderr:", result.stderr)
```

---

## Environment Variables

**Required in `.env`:**
```bash
# MongoDB (use local for Docker Compose)
MONGODB_URL=mongodb://mongo:27017

# Or MongoDB Atlas for cloud
MONGODB_URL=mongodb+srv://user:pass@cluster.mongodb.net/

DATABASE_NAME=tarregasheets
OPENROUTER_API_KEY=sk-or-v1-...
```

---

## Troubleshooting

### Issue: "cannot open display"

**Symptom:**
```
Error: cannot open display:
```

**Solution:**
Ensure Xvfb wrapper is used:
```bash
# NOT: mscore input.xml -o output.xml
# USE: mscore-headless input.xml -o output.xml
```

Or start Xvfb manually:
```bash
Xvfb :99 -screen 0 1024x768x24 &
export DISPLAY=:99
mscore input.xml -o output.xml
```

---

### Issue: MuseScore CLI hangs

**Symptom:**
Conversion never completes, process hangs.

**Solution:**
Add timeout to subprocess:
```python
result = subprocess.run(
    ['mscore-headless', 'input.xml', '-o', 'output.xml'],
    timeout=30,  # 30 second timeout
    capture_output=True
)
```

---

### Issue: AppImage FUSE error

**Symptom:**
```
AppImages require FUSE to run.
```

**Solution:**
Extract AppImage instead of running directly:
```bash
./MuseScore.AppImage --appimage-extract
./squashfs-root/AppRun --version
```

---

### Issue: Missing dependencies

**Symptom:**
```
error while loading shared libraries: libxcb-xinerama.so.0
```

**Solution:**
Install required X11 libraries:
```bash
apt-get install -y libxcb-xinerama0 libxcb-cursor0 libxcb-icccm4 libxcb-keysyms1
```

---

## Performance Considerations

### Conversion Time

- **Simple score (1 page):** ~2-5 seconds
- **Complex score (5+ pages):** ~10-20 seconds
- **Timeout recommendation:** 30 seconds

### Memory Usage

- **Xvfb:** ~50MB
- **MuseScore:** ~200-300MB per conversion
- **Recommended:** 1GB RAM minimum for container

### Concurrent Conversions

Current implementation (single worker):
- 1 conversion at a time
- Queue additional requests

Future scaling:
- Multiple workers (set `max_workers=3`)
- Separate conversion service
- Use Celery + Redis for distributed queue

---

## Deployment Checklist

- [ ] Dockerfile builds successfully
- [ ] `mscore-headless` wrapper works in container
- [ ] Python can call subprocess and get output
- [ ] Timeout handling prevents hung processes
- [ ] GridFS storage accessible from container
- [ ] Environment variables configured
- [ ] MongoDB connection works
- [ ] Test conversion with real MusicXML file
- [ ] Monitor memory usage under load

---

## Next Steps

1. ✅ Choose Dockerfile approach (Option A for dev, Option B for prod)
2. ⏳ Build and test Docker image locally
3. ⏳ Update `converter.py` to use real MuseScore CLI
4. ⏳ Test end-to-end conversion with queue
5. ⏳ Deploy to production (Vercel, Railway, or AWS)

---

## References

- MuseScore CLI docs: https://musescore.org/en/handbook/4/command-line-usage
- MuseScore GitHub releases: https://github.com/musescore/MuseScore/releases
- Xvfb man page: https://linux.die.net/man/1/xvfb
- Docker best practices: https://docs.docker.com/develop/dev-best-practices/
