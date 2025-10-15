# Phase 3: Full Mix (YT/YouTube Music) → Isolate Guitar → Transcribe

**Timeline**: 6-8 weeks
**Status**: Planned (Q3 2025)

## Overview

Extract guitar stems from full mixes (YouTube, multi-track recordings) and transcribe them into sheet music and tablature. This phase introduces source separation and multi-instrument audio processing.

---

## v0 (Week 1-2)

### Features

- **Ingest**: YouTube URL or local audio file (MP3/WAV)
  - Use `yt-dlp` to download audio from YouTube
  - Normalize to 44.1kHz mono for processing

- **Source Separation**:
  - Use **Demucs 4** (4-stem model: vocals, drums, bass, other)
  - Pick "guitar-ish" mix: `other` stem + mid-boost EQ
  - Output isolated guitar stem

- **Transcribe**:
  - Same pipeline as Phase 2 (basic-pitch + CREPE + librosa)
  - Stricter onset thresholding (to handle reverb/mix artifacts)

### UX Flow

1. User pastes YouTube URL or uploads mixed audio file
2. System downloads/processes (show progress: "Separating sources...")
3. Display 4 stems: vocals, drums, bass, other (guitar)
4. User selects guitar stem (or system auto-selects "other")
5. Transcription runs on isolated guitar
6. Display staff + TAB + playback

### API Endpoints

- `POST /separate` - Separate audio into stems
  - Request: `{ url: str }` or multipart/form-data with audio file
  - Response: `{ job_id, status }`
- `GET /separate/{job_id}/status` - Check separation job status
- `GET /separate/{job_id}/stems` - Download stems (vocals, drums, bass, other)
- `POST /separate/{job_id}/transcribe` - Transcribe selected stem

### Data Model

```python
# SeparationJob
{
  "id": str,
  "user_id": str,
  "source_url": str | None,     # YouTube URL
  "audio_url": str | None,      # Uploaded audio
  "stems": {
    "vocals": str,   # URL to stem file
    "drums": str,
    "bass": str,
    "other": str     # Guitar-ish
  },
  "status": Literal["pending", "processing", "completed", "failed"],
  "error": str | None,
  "created_at": datetime,
  "completed_at": datetime | None
}
```

### Quality Bar

- Guitar stem SNR (signal-to-noise ratio) +3 dB over mix on average
- Note F1 ≥75% on non-solo mixes (lower than Phase 2 due to mix artifacts)
- Processing time <5 minutes for 4-minute song

### Tech Stack

- **Source Separation**: Demucs 4 (PyTorch, GPU recommended)
- **Download**: yt-dlp
- **Audio Processing**: librosa (normalization, EQ)

---

## v1 (Week 3-4)

### Features

- **Guitar Detector**:
  - Spectral centroid + learned classifier to confirm stem actually contains guitar
  - Fallback: "mix minus vocals" if guitar detection fails

- **Noise Gating & De-Reverb**:
  - Apply noise gate to remove background bleed
  - Simple de-reverb (spectral subtraction or Wiener filter)
  - Especially useful for live/club recordings

### UX Enhancements

- Stem waveform visualizer (display all 4 stems)
- Manual stem selector (user can override auto-detection)
- Confidence meter: "Guitar detected with 85% confidence"

### Guitar Detector Algorithm

```python
# Pseudocode
def detect_guitar(stem_audio):
    features = extract_features(stem_audio)  # spectral centroid, MFCC, chroma
    confidence = classifier.predict(features)
    return confidence > 0.7  # Threshold for guitar vs non-guitar
```

Train classifier on dataset:
- Positive: isolated guitar recordings
- Negative: vocals, drums, bass, synths

---

## v2 (Week 5-6)

### Features

- **Polyphonic Lite**:
  - Voice split by register (bass vs melody)
  - Onset clustering: group simultaneous notes
  - Solve fingering per voice
  - Collision resolve: adjust positions to avoid overlaps

- **Confidence Heatmap**:
  - Color bars by `(note_confidence * SNR)`
  - Red = low confidence, green = high confidence
  - User can focus edits on red bars

### UX Flow: Polyphonic TAB

1. System detects polyphonic sections (multiple simultaneous notes)
2. Split into voices: bass (lower register) + melody (higher register)
3. Solve fingering for each voice independently
4. Merge: resolve collisions (adjust positions if overlap)
5. Display multi-voice TAB (stacked staves)

### Data Model Updates

```python
# Add to Note
{
  ...
  "voice": Literal["bass", "melody", "harmony"],
  "confidence": float  # 0.0-1.0, from basic-pitch
}
```

---

## Quality Bar

- Guitar stem SNR +3 dB over mix
- Note F1 ≥75% on non-solo mixes
- Polyphonic TAB: ≤5 "red" collision warnings per 100 notes
- Confidence heatmap helps users identify low-quality sections

---

## Risks & Mitigations

### Source Separation Artifacts

- **Risk**: Demucs leaves vocals/drums bleed in "other" stem
- **Mitigation**: Give users a "stem picker" and dry/wet slider; fallback to melody-only mode

### YouTube Content ID / Legal Issues

- **Risk**: Downloading copyrighted music from YouTube
- **Mitigation**: Add disclaimer; only for personal practice/education; do not redistribute

### Processing Time (Demucs is Slow)

- **Risk**: Demucs takes 5-10 minutes on CPU for 4-minute song
- **Mitigation**: Use GPU (CUDA); async job queue; show progress bar

### Guitar Detection Failures

- **Risk**: System picks wrong stem (e.g., synth instead of guitar)
- **Mitigation**: Manual stem override; confidence meter; "retry with different stem" option

---

## Tech Stack Additions

- **Demucs 4**: PyTorch-based source separation
- **yt-dlp**: YouTube download
- **GPU Support**: Optional CUDA for faster processing
- **Classifier**: scikit-learn or simple neural net for guitar detection

---

## Concrete Weekly Deliverables

### Week 1
- YouTube URL ingestion (yt-dlp integration)
- Demucs 4-stem separation
- Display stems with waveform visualizer

### Week 2
- Auto-select "other" stem as guitar
- Transcribe isolated guitar stem
- Display staff + TAB

### Week 3
- Guitar detector classifier (train on dataset)
- Fallback: "mix minus vocals"
- Manual stem selector UI

### Week 4
- Noise gating and de-reverb
- Confidence meter for guitar detection

### Week 5
- Polyphonic voice splitting (bass vs melody)
- Onset clustering and per-voice fingering solve

### Week 6
- Confidence heatmap (color by note confidence * SNR)
- User testing with YouTube songs
- Polish UX and error handling

---

## Success Metrics

- Guitar stem SNR +3 dB on average (benchmark: 20 YouTube songs)
- Note F1 ≥75% on full mixes
- Processing time <5 minutes for 4-minute song (with GPU)
- User testing: ≥70% of transcriptions are "good enough" for practice
- Design partners successfully practice with YouTube-sourced TAB

---

## Dataset Requirements

### Guitar Detector Training Set

- **Positive**: 100+ isolated guitar recordings (Phase 2 data)
- **Negative**: 100+ non-guitar stems (vocals, drums, bass, synths)
- **Validation**: 20 YouTube songs with known guitar presence

### Benchmark Test Set

- 20 YouTube songs with guitar
- Ground truth: manually verified TAB (at least for one section per song)

---

## Legal & Ethical Considerations

- Add disclaimer: "For personal practice/education only. Do not redistribute."
- Do not store YouTube audio files; only process and discard
- Respect copyright: users must own or have rights to uploaded audio

---

## Next Phase Prep

- Collect user feedback on polyphonic TAB quality
- Identify common genres/styles (fingerstyle, rock, jazz)
- Benchmark performance on different mixes (studio vs live)
