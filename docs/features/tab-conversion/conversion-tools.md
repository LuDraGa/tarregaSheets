# CLI Tool Comparison: TAB ↔ Staff Conversion

**Date**: 2025-01-17
**Purpose**: Evaluate CLI tools for automated MusicXML tablature conversion

---

## Executive Summary

**Recommendation**: **MuseScore 4 CLI** is the primary choice for TAB ↔ Staff conversion.

- ✅ Battle-tested tablature conversion
- ✅ True CLI support with `-o` export option
- ✅ Bidirectional conversion (staff → TAB and TAB → staff)
- ✅ MusicXML round-trip support
- ⚠️ Requires minimal graphics driver (Xvfb on Linux)

**Fallback**: None viable for headless automation. TuxGuitar lacks CLI, LilyPond is one-way only.

---

## Tool Comparison Matrix

| Feature                  | MuseScore 4           | TuxGuitar 1.6        | LilyPond musicxml2ly |
| ------------------------ | --------------------- | -------------------- | -------------------- |
| **CLI Support**          | ✅ Yes (`-o` flag)    | ❌ GUI only          | ✅ Yes               |
| **Headless Mode**        | ⚠️ Needs Xvfb         | ❌ No                | ✅ Yes               |
| **MusicXML Input**       | ✅ Yes                | ✅ Yes               | ✅ Yes               |
| **MusicXML Output**      | ✅ Yes                | ⚠️ Incomplete        | ❌ No (.ly only)     |
| **Staff → TAB**          | ✅ Automatic          | ✅ GUI only          | ✅ Preserves TAB     |
| **TAB → Staff**          | ✅ Automatic          | ✅ GUI only          | ✅ Preserves Staff   |
| **Batch Conversion**     | ✅ JSON jobs (`-j`)   | ✅ GUI batch tool    | ✅ Script loop       |
| **Conversion Quality**   | 🟢 High               | 🟡 Medium            | 🟡 Medium            |
| **Installation**         | AppImage/Package      | AppImage/Package     | apt/brew             |
| **Docker-Friendly**      | ✅ Yes                | ⚠️ GUI required      | ✅ Yes               |
| **Guitar TAB Maturity**  | 🟢 Excellent          | 🟢 Excellent         | 🟡 Basic             |

---

## Tool 1: MuseScore 4

### Overview
MuseScore is a professional music notation software with mature tablature support and CLI export capabilities.

### Installation
```bash
# Ubuntu/Debian
apt install musescore3  # Note: v4 via AppImage or Snap

# macOS
brew install --cask musescore

# Docker
# Use official AppImage in Dockerfile
```

### CLI Syntax

**Single file export:**
```bash
mscore input.mscz -o output.musicxml
mscore input.musicxml -o output.pdf
```

**Batch conversion with JSON:**
```bash
mscore -j conversion_job.json
```

Example `conversion_job.json`:
```json
[
  {
    "in": "staff_notation.musicxml",
    "out": "tablature.musicxml"
  },
  {
    "in": "tablature.musicxml",
    "out": ["output.pdf", "output.midi"]
  }
]
```

### Staff ↔ TAB Conversion Process

**Staff → TAB:**
1. Load MusicXML (staff notation)
2. MuseScore detects guitar/string instrument
3. Apply staff type change to TAB (requires score manipulation)
4. Export to MusicXML (TAB embedded as `<technical>` tags)

**TAB → Staff:**
1. Load MusicXML (with `<fret>` and `<string>` elements)
2. MuseScore parses TAB and infers pitches
3. Convert staff type to standard notation
4. Export to MusicXML

**⚠️ Important**: MuseScore CLI cannot directly change staff types. The automatic conversion happens through:
- **Option A**: Use MuseScore plugin system (headless plugin execution)
- **Option B**: Pre-create template scores with linked staves (staff+TAB), then import data
- **Option C**: Use Python `music21` to manipulate MusicXML before/after MuseScore processing

### Pros
- ✅ Industry-standard guitar tablature support
- ✅ Linked staves feature (edit one, update both)
- ✅ Mature MusicXML import/export
- ✅ Active development and community
- ✅ Handles complex guitar notation (bends, slides, harmonics)

### Cons
- ⚠️ CLI requires graphics driver (Xvfb for headless Linux)
- ⚠️ No direct staff type change via CLI
- ⚠️ AppImage distribution can complicate Docker setup
- ⚠️ Some MuseScore 3 CLI options removed in v4

### Docker Setup
```dockerfile
FROM ubuntu:22.04

# Install dependencies
RUN apt-get update && apt-get install -y \
    xvfb \
    libxcb-xinerama0 \
    libxcb-cursor0 \
    wget

# Download MuseScore AppImage
RUN wget https://github.com/musescore/MuseScore/releases/download/v4.2.0/MuseScore-4.2.0.AppImage \
    && chmod +x MuseScore-4.2.0.AppImage \
    && ./MuseScore-4.2.0.AppImage --appimage-extract \
    && ln -s /squashfs-root/AppRun /usr/bin/mscore

# Wrapper script with Xvfb
RUN echo '#!/bin/bash\nxvfb-run -a mscore "$@"' > /usr/bin/mscore-headless \
    && chmod +x /usr/bin/mscore-headless
```

### Conversion Quality
- 🟢 **High**: Tablature conversion is core MuseScore functionality
- Guitar-specific notation preserved (fingerings, string numbers, positions)
- Automatic fret calculation based on tuning
- Known issue: Some import/export bugs with third-party MusicXML files

---

## Tool 2: TuxGuitar

### Overview
TuxGuitar is a guitar tablature editor with strong Guitar Pro compatibility.

### Installation
```bash
# Ubuntu/Debian
apt install tuxguitar

# macOS
brew install --cask tuxguitar

# Requires Java runtime
```

### CLI Capabilities
❌ **No headless CLI mode**

TuxGuitar provides:
- GUI batch converter: `Tools → Batch File Converter`
- Command-line file opening: `tuxguitar /path/to/file.gp5`
- No export/conversion without GUI

### MusicXML Support
- ✅ Import: `.xml` files supported
- ⚠️ Export: MusicXML available but "missing symbols and notation" (GitHub issue #289)
- TAB data preserved on import
- Staff notation can be generated in GUI

### Pros
- ✅ Excellent Guitar Pro file support (.gp3, .gp4, .gp5, .gpx)
- ✅ Native tablature editor
- ✅ Playback engine for testing

### Cons
- ❌ No CLI automation
- ⚠️ Incomplete MusicXML export
- ⚠️ Requires GUI even for batch operations
- ⚠️ Java dependency

### Use Case
**Not suitable for backend automation.** Could be used for:
- Manual batch conversion (user-initiated)
- Guitar Pro → MusicXML conversion (then MuseScore for TAB generation)

---

## Tool 3: LilyPond musicxml2ly

### Overview
LilyPond's MusicXML importer converts `.xml` → `.ly` (LilyPond format).

### Installation
```bash
# Ubuntu/Debian
apt install lilypond

# macOS
brew install lilypond
```

### CLI Syntax
```bash
musicxml2ly input.xml -o output.ly
musicxml2ly --compressed input.mxl -o output.ly
```

Options:
- `-r, --relative`: Relative pitch mode (default)
- `-a, --absolute`: Absolute pitch mode
- `-l, --language=LANG`: Set pitch name language
- `-m, --midi`: Activate MIDI block
- `-z, --compressed`: Handle zip-compressed MusicXML

### Tablature Support
✅ Detects `clef sign="tab"` in MusicXML and creates `TabStaff`
✅ Extracts string tunings from staff attributes
✅ Preserves `<fret>` and `<string>` elements

### Conversion Flow
```
MusicXML (TAB or Staff) → musicxml2ly → .ly file → lilypond → PDF/MIDI
```

**No LilyPond → MusicXML export** (one-way conversion only)

### Pros
- ✅ True headless operation
- ✅ Excellent tablature support in LilyPond format
- ✅ High-quality engraving output
- ✅ Maintained by GNU project

### Cons
- ❌ No reverse conversion (.ly → MusicXML)
- ❌ Cannot be used for bidirectional TAB ↔ Staff workflow
- ⚠️ Learning curve for .ly format manipulation
- ⚠️ Would require custom .ly parser to extract staff/TAB

### Use Case
**Not suitable for round-trip conversion.** Could be used for:
- Final rendering (MusicXML → PDF via LilyPond)
- Preservation format (archive as .ly)

---

## Decision: MuseScore 4 as Primary Tool

### Rationale
1. **Only viable option** for headless bidirectional conversion
2. **Mature tablature** support with active community
3. **MusicXML round-trip** preserves guitar notation
4. **Docker-compatible** with Xvfb wrapper
5. **Fallback options**: Can integrate with music21 for pre/post-processing

### Implementation Strategy

**Phase 1: MuseScore CLI Integration**
```python
# backend/app/services/converter.py

import subprocess
import tempfile
from pathlib import Path

def convert_with_musescore(
    input_musicxml: bytes,
    from_notation: str,
    to_notation: str
) -> bytes:
    """
    Convert between staff and TAB using MuseScore CLI.

    Args:
        input_musicxml: MusicXML file content
        from_notation: "staff" or "tab"
        to_notation: "staff" or "tab"

    Returns:
        Converted MusicXML bytes
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        input_path = Path(tmpdir) / "input.musicxml"
        output_path = Path(tmpdir) / "output.musicxml"

        # Write input
        input_path.write_bytes(input_musicxml)

        # Run MuseScore conversion
        # Note: Requires pre-processing to embed staff type change
        cmd = [
            "mscore-headless",  # Xvfb wrapper
            str(input_path),
            "-o", str(output_path)
        ]

        result = subprocess.run(
            cmd,
            timeout=30,
            capture_output=True,
            check=False
        )

        if result.returncode != 0:
            raise ConversionError(f"MuseScore failed: {result.stderr}")

        return output_path.read_bytes()
```

**Phase 2: Staff Type Manipulation**

Since MuseScore CLI can't directly change staff types, we need to:

**Option A: music21 Pre-processing**
```python
import music21

def prepare_for_tab_conversion(musicxml_bytes: bytes) -> bytes:
    """Convert staff notation to be TAB-ready."""
    score = music21.converter.parse(musicxml_bytes)

    # Add TAB staff as linked staff
    # music21 can manipulate MusicXML structure
    # Then MuseScore will render TAB on import

    return score.write('musicxml.xml')
```

**Option B: Template-Based Conversion**
```python
# Pre-create MuseScore template with linked staves
# Import user's MusicXML into template
# Export TAB staff only
```

### Docker Deployment
```dockerfile
FROM python:3.11-slim

# Install MuseScore dependencies
RUN apt-get update && apt-get install -y \
    xvfb \
    libxcb-xinerama0 \
    libxcb-cursor0 \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Install MuseScore 4 AppImage
RUN wget https://github.com/musescore/MuseScore/releases/download/v4.2.0/MuseScore-4.2.0.AppImage \
    && chmod +x MuseScore-4.2.0.AppImage \
    && ./MuseScore-4.2.0.AppImage --appimage-extract \
    && ln -s /squashfs-root/AppRun /usr/bin/mscore

# Create Xvfb wrapper
RUN echo '#!/bin/bash\nxvfb-run -a mscore "$@"' > /usr/bin/mscore-headless \
    && chmod +x /usr/bin/mscore-headless

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app
COPY . /app
WORKDIR /app

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## Alternative Approach: music21-Only Conversion

If MuseScore proves too complex, consider using **music21** directly:

```python
import music21

def staff_to_tab_music21(musicxml_bytes: bytes) -> bytes:
    """Convert staff to TAB using music21."""
    score = music21.converter.parse(musicxml_bytes)

    # Create TabStaff
    from music21 import tablature
    tab_staff = tablature.TablatureStaff()

    # Transfer notes with fret/string calculation
    for note in score.flatten().notes:
        tab_note = tablature.TabNote(note.pitch)
        tab_note.fret = calculate_fret(note.pitch, tuning)
        tab_note.string = calculate_string(note.pitch, tuning)
        tab_staff.append(tab_note)

    return tab_staff.write('musicxml')
```

**Pros**: Pure Python, no external dependencies
**Cons**: Manual fret/string calculation, complex for chords

---

## Testing Strategy

### Test Files Needed
1. **Staff-only MusicXML**: Classical guitar piece (no TAB)
2. **TAB-only MusicXML**: Guitar Pro export with `<technical>` tags
3. **Mixed MusicXML**: Both staff and TAB staves (linked)

### Conversion Quality Metrics
- ✅ Notes match (pitch-perfect)
- ✅ Fret numbers playable (no fret >24)
- ✅ String assignments sensible (prefer lower strings for melody)
- ✅ Timing preserved (rhythms, measures, repeats)
- ✅ Articulations preserved (bends, slides, harmonics)
- ⚠️ Fingerings may be lost (acceptable degradation)

### Validation Script
```bash
# Test MuseScore conversion
./test_conversion.sh staff_input.musicxml tab_output.musicxml

# Compare MIDI output (should be identical)
music21 staff_input.musicxml --to midi > staff.mid
music21 tab_output.musicxml --to midi > tab.mid
diff staff.mid tab.mid  # Should be identical
```

---

## Conclusion

**Primary Tool**: MuseScore 4 CLI with Xvfb
**Fallback**: music21 for edge cases
**TuxGuitar**: Not suitable for automation
**LilyPond**: One-way only, not viable

**Next Steps**:
1. ✅ Install MuseScore 4 locally and test conversion
2. ⏳ Create Docker image with MuseScore + Xvfb
3. ⏳ Test conversion quality with example files
4. ⏳ Implement Python wrapper service
5. ⏳ Update planning.md with final decision
